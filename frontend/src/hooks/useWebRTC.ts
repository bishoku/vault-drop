/// <reference types="vite/client" />

import { useRef, useCallback, useEffect } from 'react';
import { useTransferStore } from '../store';
import { PeerManager } from '../core/webrtc';
import { TransferWorkerClient } from '../core/worker/worker-client';
import {
  createAutoFileWriter,
  createFSAFileWriter,
  triggerBlobDownload,
  isFileSystemAccessSupported,
} from '../core/storage';
import {
  importKeyFromRaw,
  parseURLFragment,
  generateSessionKeys,
  buildShareURL,
  bytesToHex,
  type SessionKeys,
  type FileManifest,
} from '../core/crypto';
import { addTransferRecord } from '../core/history';

const DEFAULT_PROD_SIGNALING_URL = 'wss://vaultdrop-signaling.barishoku.workers.dev';
const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL ||
  (import.meta.env.PROD ? DEFAULT_PROD_SIGNALING_URL : 'ws://localhost:8787');

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    result += chars[randomValues[i]! % chars.length];
  }
  return result;
}

interface UseWebRTCReturn {
  startSending: (file: File) => Promise<void>;
  startReceiving: () => Promise<void>;
  chooseSaveLocation: () => Promise<void>;
  confirmFallback: () => void;
  cancelTransfer: () => void;
  shareUrl: string | null;
  canChooseSaveLocation: boolean;
}

export function useWebRTC(): UseWebRTCReturn {
  const store = useTransferStore();
  const peerRef = useRef<PeerManager | null>(null);
  const workerRef = useRef<TransferWorkerClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionKeysRef = useRef<SessionKeys | null>(null);
  const shareUrlRef = useRef<string | null>(null);
  const fileWriterRef = useRef<Awaited<ReturnType<typeof createAutoFileWriter>> | null>(null);
  const isSenderRef = useRef(false);
  const isConnectingRef = useRef(false);
  const expectedSha256Ref = useRef<string | null>(null);
  const hasStartedSendRef = useRef(false);
  const manifestRef = useRef<FileManifest | null>(null);
  const transferStartTimeRef = useRef<number | null>(null);
  const hasRecordedCompletionRef = useRef<boolean>(false);

  const cleanup = useCallback(() => {
    isConnectingRef.current = false;
    hasStartedSendRef.current = false;
    transferStartTimeRef.current = null;
    hasRecordedCompletionRef.current = false;
    peerRef.current?.close();
    peerRef.current = null;
    workerRef.current?.destroy();
    workerRef.current = null;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    sessionKeysRef.current = null;
    fileWriterRef.current = null;
    expectedSha256Ref.current = null;
    manifestRef.current = null;
  }, []);

  const recordSenderSuccess = useCallback(
    async (sha256?: string) => {
      if (hasRecordedCompletionRef.current) return;
      hasRecordedCompletionRef.current = true;
      const file = store.file;
      if (!file) return;

      const now = Date.now();
      const startTime = transferStartTimeRef.current || now;
      const durationMs = Math.max(100, now - startTime);
      const avgSpeedBytesPerSec = durationMs > 0 ? (file.size / (durationMs / 1000)) : 0;
      const connectionType = store.connectionState === 'relay' ? 'relay' : 'p2p';

      await addTransferRecord({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        role: 'sender',
        status: 'completed',
        connectionType,
        durationMs,
        avgSpeedBytesPerSec,
        sha256: sha256 || expectedSha256Ref.current || undefined,
      });
      store.loadHistory();
    },
    [store],
  );

  const connectSignaling = useCallback(
    (roomId: string): Promise<WebSocket> => {
      return new Promise((resolve, reject) => {
        if (wsRef.current) {
          wsRef.current.onclose = null;
          wsRef.current.close();
          wsRef.current = null;
        }

        const wsUrl = `${SIGNALING_URL}/api/room/${roomId}/ws`;
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Signaling connection timeout'));
        }, 10000);

        ws.onopen = () => {
          clearTimeout(timeout);
          wsRef.current = ws;
          resolve(ws);
        };

        ws.onerror = (err) => {
          clearTimeout(timeout);
          console.error('[Signaling] WebSocket error:', err);
          reject(new Error('Signaling connection failed'));
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          if (event.code === 4001) {
            console.warn('[Signaling] Room is full (4001)');
            store.setError('errors.roomFull');
            store.setConnectionState('failed');
          }
        };
      });
    },
    [store],
  );

  const startSending = useCallback(
    async (file: File) => {
      cleanup();
      isSenderRef.current = true;
      hasStartedSendRef.current = false;

      store.setFile(file);
      store.setMode('send');
      store.setConnectionState('waiting');

      const roomId = generateRoomId();
      store.setRoomId(roomId);

      const keys = await generateSessionKeys();
      sessionKeysRef.current = keys;
      store.setRawKey(keys.rawKey);

      const url = buildShareURL(roomId, keys.rawKey);
      shareUrlRef.current = url;
      console.log('[VaultDrop:Sender] Room:', roomId, 'rawKey prefix:', bytesToHex(keys.rawKey.slice(0, 8)));

      const ws = await connectSignaling(roomId);

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return;

        const message = JSON.parse(event.data as string) as {
          type: string;
          payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
        };

        switch (message.type) {
          case 'peer-joined': {
            console.log('[VaultDrop:Sender] Receiver joined room, initiating WebRTC connection...');
            store.setConnectionState('connecting');

            const triggerSend = () => {
              if (hasStartedSendRef.current) return;
              hasStartedSendRef.current = true;
              transferStartTimeRef.current = Date.now();
              hasRecordedCompletionRef.current = false;
              console.log('[VaultDrop:Sender] Starting file stream transfer to receiver...');

              const worker = new TransferWorkerClient();
              workerRef.current = worker;

              worker.onManifest = (manifest) => {
                console.log('[VaultDrop:Sender] File manifest prepared:', manifest.fileName, manifest.fileSize, 'bytes');
                store.setFileManifest(manifest);
              };

              worker.onEncryptedChunk = (chunkData) => {
                peerRef.current?.send(chunkData);
              };

              worker.onProgress = (sent, total, speed) => {
                const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
                const eta = speed > 0 ? Math.round((total - sent) / speed) : 0;
                store.setProgress({ bytesSent: sent, bytesTotal: total, speed, eta, percentage });
              };

              worker.onSentAllChunks = (sha256) => {
                console.log('[VaultDrop:Sender] Sent all chunks and trailer (100%), awaiting ACK from receiver. SHA-256:', sha256);
                expectedSha256Ref.current = sha256;
                store.setProgress({
                  bytesSent: file.size,
                  bytesTotal: file.size,
                  speed: 0,
                  eta: 0,
                  percentage: 100,
                });
              };

              worker.onError = (errMsg) => {
                console.error('[VaultDrop:Sender] Worker error:', errMsg);
                store.setError(errMsg);
                store.setTransferState('error');
              };

              worker.startSend(file, keys.rawKey, keys.salt);
              store.setTransferState('sending');
            };

            const peer = new PeerManager({
              onSignal: (signal) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(signal));
                }
              },
              onData: (_data) => {
                // Sender does not expect raw data in normal flow
              },
              onMessage: (msgText) => {
                console.log('[VaultDrop:Sender] Received control message from receiver:', msgText);
                try {
                  const ctrl = JSON.parse(msgText) as {
                    type: string;
                    success?: boolean;
                    sha256?: string;
                  };

                  if (ctrl.type === 'receiver-ready') {
                    console.log('[VaultDrop:Sender] Receiver signaled ready, triggering send immediately');
                    triggerSend();
                  } else if (ctrl.type === 'transfer-ack') {
                    console.log('[VaultDrop:Sender] Transfer ACK received:', ctrl);
                    if (ctrl.success && (!expectedSha256Ref.current || ctrl.sha256?.toLowerCase() === expectedSha256Ref.current.toLowerCase())) {
                      store.setHashVerified(true);
                      store.setTransferState('completed');
                      recordSenderSuccess(ctrl.sha256);
                    } else {
                      store.setHashVerified(false);
                      store.setError('errors.hashMismatch');
                      store.setTransferState('error');
                    }
                  }
                } catch (err) {
                  console.error('[VaultDrop:Sender] Error parsing control message:', err);
                }
              },
              onStateChange: (state) => {
                console.log('[VaultDrop:Sender] WebRTC state:', state);
                if (state === 'connected') {
                  store.setConnectionState('p2p');
                } else if (state === 'failed') {
                  store.setFallbackRequired(true);
                }
              },
              onChannelReady: () => {
                console.log('[VaultDrop:Sender] DataChannel ready on sender side');
                store.setConnectionState('p2p');

                // Fallback start timer if receiver-ready missed
                setTimeout(() => {
                  if (!hasStartedSendRef.current) {
                    console.log('[VaultDrop:Sender] Fallback timer fired, starting send');
                    triggerSend();
                  }
                }, 1200);
              },
              onBackpressure: (isPaused) => {
                if (isPaused) {
                  console.log('[VaultDrop:Sender] Backpressure high (> 2MB), throttling worker...');
                  workerRef.current?.notifyPause();
                } else {
                  console.log('[VaultDrop:Sender] Backpressure cleared (<= 512KB), resuming worker...');
                  workerRef.current?.notifyDrain();
                }
              },
            });

            peerRef.current = peer;
            peer.createOffer();
            break;
          }

          case 'offer':
          case 'answer':
          case 'candidate':
            peerRef.current?.handleSignal(
              message as {
                type: 'offer' | 'answer' | 'candidate';
                payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
              },
            );
            break;

          case 'transfer-ack': {
            const ctrl = message as { success?: boolean; sha256?: string };
            console.log('[VaultDrop:Sender] Transfer ACK received via WebSocket:', ctrl);
            if (ctrl.success && (!expectedSha256Ref.current || ctrl.sha256?.toLowerCase() === expectedSha256Ref.current.toLowerCase())) {
              store.setHashVerified(true);
              store.setTransferState('completed');
              recordSenderSuccess(ctrl.sha256);
            } else {
              store.setHashVerified(false);
              store.setError('errors.hashMismatch');
              store.setTransferState('error');
            }
            break;
          }

          case 'peer-left':
            console.warn('[VaultDrop:Sender] Receiver disconnected');
            if (store.transferState !== 'completed') {
              store.setError('errors.connectionLost');
              store.setConnectionState('failed');
            }
            break;
        }
      };
    },
    [cleanup, connectSignaling, recordSenderSuccess, store],
  );

  const startReceiving = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    cleanup();
    isSenderRef.current = false;

    const fragment = parseURLFragment();
    if (!fragment) {
      store.setError('errors.invalidLink');
      isConnectingRef.current = false;
      return;
    }

    store.setMode('receive');
    store.setRoomId(fragment.roomId);
    store.setConnectionState('connecting');
    store.setRawKey(fragment.rawKey);
    console.log('[VaultDrop:Receiver] Joined room:', fragment.roomId, 'rawKey prefix:', bytesToHex(fragment.rawKey.slice(0, 8)));

    const encryptionKey = await importKeyFromRaw(fragment.rawKey);
    sessionKeysRef.current = { encryptionKey, rawKey: fragment.rawKey, salt: new Uint8Array(0) };

    try {
      const ws = await connectSignaling(fragment.roomId);
      isConnectingRef.current = false;
      console.log('[VaultDrop:Receiver] Connected to signaling server');

      // Set up receiving worker
      const worker = new TransferWorkerClient();
      workerRef.current = worker;

      worker.onManifest = async (manifest) => {
        console.log('[VaultDrop:Receiver] Manifest received:', manifest.fileName, `(${manifest.fileSize} bytes, ${manifest.totalChunks} chunks)`);
        transferStartTimeRef.current = Date.now();
        hasRecordedCompletionRef.current = false;
        manifestRef.current = manifest;
        store.setFileManifest(manifest);
        store.setTransferState('receiving');

        // Automatically initialize streaming storage to disk (OPFS if available, else Blob)
        try {
          if (!fileWriterRef.current) {
            const writer = await createAutoFileWriter(manifest.fileName);
            fileWriterRef.current = writer;
            console.log('[VaultDrop:Receiver] Auto-initialized storage with backend:', writer.backend);
          }
        } catch (err) {
          console.error('[VaultDrop:Receiver] Error creating file writer:', err);
          store.setError('receive.saveError');
        }
      };

      worker.onDecryptedChunk = async (chunkData, chunkIndex) => {
        if (fileWriterRef.current) {
          try {
            await fileWriterRef.current.write(chunkData);
          } catch (err) {
            console.error(`[VaultDrop:Receiver] Error writing chunk ${chunkIndex} to disk:`, err);
            store.setError('receive.saveError');
            store.setTransferState('error');
            worker.abort();
          }
        }
      };

      worker.onProgress = (sent, total, speed) => {
        const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
        const eta = speed > 0 ? Math.round((total - sent) / speed) : 0;
        store.setProgress({ bytesSent: sent, bytesTotal: total, speed, eta, percentage });
      };

      worker.onComplete = async (sha256) => {
        console.log('[VaultDrop:Receiver] File stream complete. Verified SHA-256:', sha256);
        const manifest = manifestRef.current || useTransferStore.getState().fileManifest;
        const fileName = manifest?.fileName || 'download';

        // Finalize saving file to disk
        if (fileWriterRef.current) {
          try {
            const savedFile = await fileWriterRef.current.close();
            if (savedFile) {
              store.setReceivedFile(savedFile);
              const blobUrl = triggerBlobDownload(savedFile, fileName);
              store.setDownloadUrl(blobUrl);
              console.log('[VaultDrop:Receiver] File assembled on disk and download triggered:', fileName);
            } else {
              console.log('[VaultDrop:Receiver] File saved directly to user selected disk location (FSA):', fileName);
            }
          } catch (err) {
            console.error('[VaultDrop:Receiver] Save error on close:', err);
            store.setError('receive.saveError');
          }
        }

        store.setHashVerified(true);
        store.setTransferState('completed');
        const ackMsg = JSON.stringify({ type: 'transfer-ack', success: true, sha256 });
        peerRef.current?.sendText(ackMsg);
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(ackMsg);
          } catch {}
        }

        if (!hasRecordedCompletionRef.current) {
          hasRecordedCompletionRef.current = true;
          const now = Date.now();
          const startTime = transferStartTimeRef.current || now;
          const durationMs = Math.max(100, now - startTime);
          const fileSize = manifest?.fileSize || 0;
          const avgSpeedBytesPerSec = durationMs > 0 ? (fileSize / (durationMs / 1000)) : 0;
          const connectionType = store.connectionState === 'relay' ? 'relay' : 'p2p';

          addTransferRecord({
            fileName,
            fileSize,
            mimeType: manifest?.mimeType,
            role: 'receiver',
            status: 'completed',
            connectionType,
            durationMs,
            avgSpeedBytesPerSec,
            sha256,
          }).then(() => {
            store.loadHistory();
          });
        }
      };

      worker.onError = (errMsg) => {
        console.error('[VaultDrop:Receiver] Worker error:', errMsg);
        store.setError(errMsg);
        store.setTransferState('error');
      };

      // Initialize worker to receive mode
      worker.startReceive(fragment.rawKey);

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          // Relay binary message fallback
          worker.feedChunk(event.data);
          return;
        }

        if (typeof event.data !== 'string') return;

        const message = JSON.parse(event.data as string) as {
          type: string;
          payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
        };

        switch (message.type) {
          case 'offer': {
            console.log('[VaultDrop:Receiver] Handling WebRTC offer from sender...');
            const peer = new PeerManager({
              onSignal: (signal) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify(signal));
                }
              },
              onData: (chunkData) => {
                worker.feedChunk(chunkData);
              },
              onStateChange: (state) => {
                console.log('[VaultDrop:Receiver] WebRTC state:', state);
                if (state === 'connected') {
                  store.setConnectionState('p2p');
                } else if (state === 'failed') {
                  store.setFallbackRequired(true);
                }
              },
              onChannelReady: () => {
                console.log('[VaultDrop:Receiver] DataChannel open, notifying sender receiver-ready');
                store.setConnectionState('p2p');
                peer.sendText(JSON.stringify({ type: 'receiver-ready' }));
              },
            });

            peerRef.current = peer;
            peer.handleSignal(message as { type: 'offer'; payload: RTCSessionDescriptionInit });
            break;
          }

          case 'answer':
          case 'candidate':
            peerRef.current?.handleSignal(
              message as {
                type: 'answer' | 'candidate';
                payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
              },
            );
            break;

          case 'peer-left':
            console.warn('[VaultDrop:Receiver] Sender disconnected');
            if (store.transferState !== 'completed') {
              store.setError('errors.connectionLost');
              store.setConnectionState('failed');
            }
            break;
        }
      };
    } catch (err) {
      console.error('[VaultDrop:Receiver] Connection error:', err);
      isConnectingRef.current = false;
      store.setError('errors.connectionLost');
      store.setConnectionState('failed');
    }
  }, [cleanup, connectSignaling, store]);

  const chooseSaveLocation = useCallback(async () => {
    const manifest = manifestRef.current || store.fileManifest;
    const suggestedName = manifest?.fileName || 'download';
    try {
      const writer = await createFSAFileWriter(suggestedName);
      fileWriterRef.current = writer;
      console.log('[VaultDrop:Receiver] User picked save location via File System Access API:', suggestedName);
    } catch (err) {
      console.warn('[VaultDrop:Receiver] User dismissed save file picker:', err);
    }
  }, [store.fileManifest]);

  const confirmFallback = useCallback(() => {
    store.setFallbackRequired(false);
    store.setConnectionState('relay');

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'relay-start' }));

    const keys = sessionKeysRef.current;
    if (!keys) return;

    if (isSenderRef.current && store.file) {
      const file = store.file;
      const worker = new TransferWorkerClient();
      workerRef.current = worker;

      worker.onEncryptedChunk = (chunkData) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunkData);
        }
      };

      worker.onProgress = (sent, total, speed) => {
        const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
        const eta = speed > 0 ? Math.round((total - sent) / speed) : 0;
        store.setProgress({ bytesSent: sent, bytesTotal: total, speed, eta, percentage });
      };

      worker.onSentAllChunks = (sha256) => {
        expectedSha256Ref.current = sha256;
        store.setProgress({
          bytesSent: file.size,
          bytesTotal: file.size,
          speed: 0,
          eta: 0,
          percentage: 100,
        });
      };

      worker.onError = (errMsg) => {
        console.error('[VaultDrop:Sender] Worker error:', errMsg);
        store.setError(errMsg);
        store.setTransferState('error');
      };

      transferStartTimeRef.current = Date.now();
      hasRecordedCompletionRef.current = false;
      worker.startSend(file, keys.rawKey, keys.salt);
      store.setTransferState('sending');
    }
  }, [store]);

  const cancelTransfer = useCallback(() => {
    workerRef.current?.abort();
    fileWriterRef.current?.abort().catch(() => {});
    cleanup();
    store.reset();
  }, [cleanup, store]);

  // Auto-detect receive mode from URL fragment on mount
  useEffect(() => {
    const fragment = parseURLFragment();
    if (fragment) {
      startReceiving();
    }
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    startSending,
    startReceiving,
    chooseSaveLocation,
    confirmFallback,
    cancelTransfer,
    shareUrl: shareUrlRef.current,
    canChooseSaveLocation: isFileSystemAccessSupported(),
  };
}
