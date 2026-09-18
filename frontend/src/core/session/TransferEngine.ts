import { PeerManager } from '../webrtc';
import { TransferWorkerClient } from '../worker/worker-client';
import {
  createAutoFileWriter,
  createFSAFileWriter,
  triggerBlobDownload,
  isFileSystemAccessSupported,
  cleanupOPFSTempFiles,
  revokeActiveDownloadUrls,
} from '../storage';
import {
  importKeyFromRaw,
  generateSessionKeys,
  buildShareURL,
  bytesToHex,
  type SessionKeys,
  type FileManifest,
} from '../crypto';
import { addTransferRecord } from '../history';

export type EngineConnectionState = 'idle' | 'waiting' | 'connecting' | 'p2p' | 'relay' | 'failed';
export type EngineTransferState = 'idle' | 'sending' | 'receiving' | 'completed' | 'error';

export interface TransferProgressUpdate {
  bytesSent: number;
  bytesTotal: number;
  speed: number;
  eta: number;
  percentage: number;
}

export interface TransferEngineCallbacks {
  onConnectionStateChange: (state: EngineConnectionState) => void;
  onTransferStateChange: (state: EngineTransferState) => void;
  onProgress: (progress: TransferProgressUpdate) => void;
  onFileManifest: (manifest: FileManifest | null) => void;
  onHashVerified: (verified: boolean | null) => void;
  onError: (errorKey: string | null) => void;
  onFallbackRequired: (required: boolean) => void;
  onReceivedFile: (file: File | Blob | null, downloadUrl: string | null) => void;
  onShareUrlGenerated: (url: string, roomId: string, rawKey: Uint8Array) => void;
  onHistoryUpdated: () => void;
  onAwaitingAcceptance?: (awaiting: boolean) => void;
}

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

export class TransferEngine {
  private callbacks: TransferEngineCallbacks;
  private peer: PeerManager | null = null;
  private worker: TransferWorkerClient | null = null;
  private ws: WebSocket | null = null;
  private sessionKeys: SessionKeys | null = null;
  private fileWriter: Awaited<ReturnType<typeof createAutoFileWriter>> | null = null;
  private file: File | null = null;
  private shareUrl: string | null = null;

  private isSender = false;
  private isConnecting = false;
  private isAwaitingAcceptance = false;
  private expectedSha256: string | null = null;
  private hasStartedSend = false;
  private manifest: FileManifest | null = null;
  private transferStartTime: number | null = null;
  private hasRecordedCompletion = false;

  private connectionState: EngineConnectionState = 'idle';
  private transferState: EngineTransferState = 'idle';
  private lastProgressPercentage = 0;

  constructor(callbacks: TransferEngineCallbacks) {
    this.callbacks = callbacks;
    cleanupOPFSTempFiles().catch(() => {});
  }

  public getShareUrl(): string | null {
    return this.shareUrl;
  }

  public getIsAwaitingAcceptance(): boolean {
    return this.isAwaitingAcceptance;
  }

  public canChooseSaveLocation(): boolean {
    return isFileSystemAccessSupported();
  }

  public setConnectionState(state: EngineConnectionState): void {
    this.connectionState = state;
    this.callbacks.onConnectionStateChange(state);
  }

  public setTransferState(state: EngineTransferState): void {
    this.transferState = state;
    this.callbacks.onTransferStateChange(state);
  }

  private connectSignaling(roomId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
        this.ws = null;
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
        this.ws = ws;
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
          this.callbacks.onError('errors.roomFull');
          this.setConnectionState('failed');
        }
      };
    });
  }

  private async recordSenderSuccess(sha256?: string): Promise<void> {
    if (this.hasRecordedCompletion) return;
    this.hasRecordedCompletion = true;

    if (!this.file) {
      console.warn('[VaultDrop:Sender] Cannot record history: file is null');
      return;
    }

    const now = Date.now();
    const startTime = this.transferStartTime || now;
    const durationMs = Math.max(100, now - startTime);
    const avgSpeedBytesPerSec = durationMs > 0 ? this.file.size / (durationMs / 1000) : 0;
    const connectionType = this.connectionState === 'relay' ? 'relay' : 'p2p';

    await addTransferRecord({
      fileName: this.file.name,
      fileSize: this.file.size,
      mimeType: this.file.type,
      role: 'sender',
      status: 'completed',
      connectionType,
      durationMs,
      avgSpeedBytesPerSec,
      sha256: sha256 || this.expectedSha256 || undefined,
    });

    this.callbacks.onHistoryUpdated();
  }

  public async startSending(file: File): Promise<void> {
    this.cleanup();
    this.isSender = true;
    this.hasStartedSend = false;
    this.file = file;

    this.setConnectionState('waiting');

    const roomId = generateRoomId();
    const keys = await generateSessionKeys();
    this.sessionKeys = keys;

    const url = buildShareURL(roomId, keys.rawKey);
    this.shareUrl = url;
    this.callbacks.onShareUrlGenerated(url, roomId, keys.rawKey);

    console.log('[VaultDrop:Sender] Room:', roomId, 'rawKey prefix:', bytesToHex(keys.rawKey.slice(0, 8)));

    const ws = await this.connectSignaling(roomId);

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;

      const message = JSON.parse(event.data as string) as {
        type: string;
        payload?: RTCSessionDescriptionInit | RTCIceCandidateInit;
      };

      switch (message.type) {
        case 'peer-joined': {
          console.log('[VaultDrop:Sender] Receiver joined room, initiating WebRTC connection...');
          this.setConnectionState('connecting');

          const prepareManifestAndSendChunk0 = () => {
            if (this.hasStartedSend) return;
            this.hasStartedSend = true;
            console.log('[VaultDrop:Sender] Preparing file manifest and Chunk 0 for receiver...');

            const worker = new TransferWorkerClient();
            this.worker = worker;

            worker.onManifest = (manifest) => {
              console.log(
                '[VaultDrop:Sender] File manifest prepared:',
                manifest.fileName,
                manifest.fileSize,
                'bytes',
              );
              this.manifest = manifest;
              this.callbacks.onFileManifest(manifest);
            };

            worker.onManifestSent = () => {
              console.log('[VaultDrop:Sender] Chunk 0 (manifest) sent. Awaiting receiver approval...');
              this.isAwaitingAcceptance = true;
              this.callbacks.onAwaitingAcceptance?.(true);
            };

            worker.onEncryptedChunk = (chunkData) => {
              if (this.connectionState === 'relay' && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(chunkData);
              } else {
                this.peer?.send(chunkData);
              }
            };

            worker.onProgress = (sent, total, speed) => {
              const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
              const eta = speed > 0 ? Math.round((total - sent) / speed) : 0;
              this.lastProgressPercentage = percentage;
              this.callbacks.onProgress({ bytesSent: sent, bytesTotal: total, speed, eta, percentage });
            };

            worker.onSentAllChunks = (sha256) => {
              console.log(
                '[VaultDrop:Sender] Sent all chunks and trailer (100%), awaiting ACK from receiver. SHA-256:',
                sha256,
              );
              this.expectedSha256 = sha256;
              this.lastProgressPercentage = 100;
              this.callbacks.onProgress({
                bytesSent: file.size,
                bytesTotal: file.size,
                speed: 0,
                eta: 0,
                percentage: 100,
              });
            };

            worker.onError = (errMsg) => {
              console.error('[VaultDrop:Sender] Worker error:', errMsg);
              this.callbacks.onError(errMsg);
              this.setTransferState('error');
            };

            worker.startSend(file, keys.rawKey, keys.salt);
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
                  console.log('[VaultDrop:Sender] Receiver signaled ready, preparing and sending manifest...');
                  prepareManifestAndSendChunk0();
                } else if (ctrl.type === 'transfer-accepted') {
                  console.log('[VaultDrop:Sender] Receiver ACCEPTED transfer! Starting file stream...');
                  this.isAwaitingAcceptance = false;
                  this.callbacks.onAwaitingAcceptance?.(false);
                  this.transferStartTime = Date.now();
                  this.hasRecordedCompletion = false;
                  this.setTransferState('sending');
                  this.worker?.startStream();
                } else if (ctrl.type === 'transfer-rejected') {
                  console.log('[VaultDrop:Sender] Receiver REJECTED transfer.');
                  this.isAwaitingAcceptance = false;
                  this.callbacks.onAwaitingAcceptance?.(false);
                  this.callbacks.onError('receive.rejected_by_receiver');
                  this.cancelTransfer();
                } else if (ctrl.type === 'transfer-ack') {
                  console.log('[VaultDrop:Sender] Transfer ACK received:', ctrl);
                  if (
                    ctrl.success &&
                    (!this.expectedSha256 ||
                      ctrl.sha256?.toLowerCase() === this.expectedSha256.toLowerCase())
                  ) {
                    this.callbacks.onHashVerified(true);
                    this.setTransferState('completed');
                    this.callbacks.onFallbackRequired(false);
                    this.recordSenderSuccess(ctrl.sha256);
                  } else {
                    this.callbacks.onHashVerified(false);
                    this.callbacks.onError('errors.hashMismatch');
                    this.setTransferState('error');
                  }
                }
              } catch (err) {
                console.error('[VaultDrop:Sender] Error parsing control message:', err);
              }
            },
            onStateChange: (state) => {
              console.log('[VaultDrop:Sender] WebRTC state:', state);
              if (state === 'connected') {
                this.setConnectionState('p2p');
              } else if (state === 'failed') {
                if (this.transferState !== 'completed') {
                  this.callbacks.onFallbackRequired(true);
                }
              }
            },
            onChannelReady: () => {
              console.log('[VaultDrop:Sender] DataChannel ready on sender side');
              this.setConnectionState('p2p');
              if (!this.hasStartedSend) {
                prepareManifestAndSendChunk0();
              }
            },
            onBackpressure: (isPaused) => {
              if (isPaused) {
                console.log('[VaultDrop:Sender] Backpressure high (> 2MB), throttling worker...');
                this.worker?.notifyPause();
              } else {
                console.log('[VaultDrop:Sender] Backpressure cleared (<= 512KB), resuming worker...');
                this.worker?.notifyDrain();
              }
            },
          });

          this.peer = peer;
          peer.createOffer();
          break;
        }

        case 'offer':
        case 'answer':
        case 'candidate':
          this.peer?.handleSignal(
            message as {
              type: 'offer' | 'answer' | 'candidate';
              payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
            },
          );
          break;

        case 'transfer-accepted': {
          console.log('[VaultDrop:Sender] Receiver accepted transfer via WebSocket!');
          this.isAwaitingAcceptance = false;
          this.callbacks.onAwaitingAcceptance?.(false);
          this.transferStartTime = Date.now();
          this.hasRecordedCompletion = false;
          this.setTransferState('sending');
          this.worker?.startStream();
          break;
        }

        case 'transfer-rejected': {
          console.log('[VaultDrop:Sender] Receiver rejected transfer via WebSocket.');
          this.isAwaitingAcceptance = false;
          this.callbacks.onAwaitingAcceptance?.(false);
          this.callbacks.onError('receive.rejected_by_receiver');
          this.cancelTransfer();
          break;
        }

        case 'transfer-ack': {
          const ctrl = message as { success?: boolean; sha256?: string };
          console.log('[VaultDrop:Sender] Transfer ACK received via WebSocket:', ctrl);
          if (
            ctrl.success &&
            (!this.expectedSha256 ||
              ctrl.sha256?.toLowerCase() === this.expectedSha256.toLowerCase())
          ) {
            this.callbacks.onHashVerified(true);
            this.setTransferState('completed');
            this.callbacks.onFallbackRequired(false);
            this.recordSenderSuccess(ctrl.sha256);
          } else {
            this.callbacks.onHashVerified(false);
            this.callbacks.onError('errors.hashMismatch');
            this.setTransferState('error');
          }
          break;
        }

        case 'peer-left':
          console.warn('[VaultDrop:Sender] Receiver disconnected');
          if (this.transferState === 'completed') {
            break;
          }
          if (this.expectedSha256 && this.lastProgressPercentage >= 100) {
            console.log(
              '[VaultDrop:Sender] Receiver disconnected after 100% chunks sent; treating as completed',
            );
            this.callbacks.onHashVerified(true);
            this.setTransferState('completed');
            this.callbacks.onFallbackRequired(false);
            this.recordSenderSuccess(this.expectedSha256);
          } else {
            this.callbacks.onError('errors.connectionLost');
            this.setConnectionState('failed');
          }
          break;
      }
    };
  }

  public async startReceiving(roomId: string, rawKey: Uint8Array): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    this.cleanup();
    this.isSender = false;

    this.setConnectionState('connecting');
    console.log('[VaultDrop:Receiver] Joined room:', roomId, 'rawKey prefix:', bytesToHex(rawKey.slice(0, 8)));

    const encryptionKey = await importKeyFromRaw(rawKey);
    this.sessionKeys = { encryptionKey, rawKey, salt: new Uint8Array(0) };

    try {
      const ws = await this.connectSignaling(roomId);
      this.isConnecting = false;
      console.log('[VaultDrop:Receiver] Connected to signaling server');

      const worker = new TransferWorkerClient();
      this.worker = worker;

      worker.onManifest = (manifest) => {
        console.log(
          '[VaultDrop:Receiver] Manifest received:',
          manifest.fileName,
          `(${manifest.fileSize} bytes, ${manifest.totalChunks} chunks)`,
        );
        this.manifest = manifest;
        this.callbacks.onFileManifest(manifest);
        // Do not auto-initialize storage writer or set receiving state; wait for user consent
      };

      worker.onDecryptedChunk = async (chunkData, chunkIndex) => {
        if (this.fileWriter) {
          try {
            await this.fileWriter.write(chunkData);
          } catch (err) {
            console.error(`[VaultDrop:Receiver] Error writing chunk ${chunkIndex} to disk:`, err);
            this.callbacks.onError('receive.saveError');
            this.setTransferState('error');
            worker.abort();
          }
        }
      };

      worker.onProgress = (sent, total, speed) => {
        const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
        const eta = speed > 0 ? Math.round((total - sent) / speed) : 0;
        this.lastProgressPercentage = percentage;
        this.callbacks.onProgress({ bytesSent: sent, bytesTotal: total, speed, eta, percentage });
      };

      worker.onComplete = async (sha256) => {
        console.log('[VaultDrop:Receiver] File stream complete. Verified SHA-256:', sha256);
        const fileName = this.manifest?.fileName || 'download';
        let savedFile: File | Blob | null = null;
        let blobUrl: string | null = null;

        if (this.fileWriter) {
          try {
            const closedFile = await this.fileWriter.close();
            if (closedFile) {
              savedFile = closedFile;
              blobUrl = triggerBlobDownload(closedFile, fileName);
              console.log('[VaultDrop:Receiver] File assembled on disk and download triggered:', fileName);
            } else {
              console.log(
                '[VaultDrop:Receiver] File saved directly to user selected disk location (FSA):',
                fileName,
              );
            }
          } catch (err) {
            console.error('[VaultDrop:Receiver] Save error on close:', err);
            this.callbacks.onError('receive.saveError');
          }
        }

        this.callbacks.onReceivedFile(savedFile, blobUrl);
        this.callbacks.onHashVerified(true);
        this.setTransferState('completed');
        this.callbacks.onFallbackRequired(false);

        const ackMsg = JSON.stringify({ type: 'transfer-ack', success: true, sha256 });
        this.peer?.sendText(ackMsg);
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(ackMsg);
          } catch {}
        }

        if (!this.hasRecordedCompletion) {
          this.hasRecordedCompletion = true;
          const now = Date.now();
          const startTime = this.transferStartTime || now;
          const durationMs = Math.max(100, now - startTime);
          const fileSize = this.manifest?.fileSize || 0;
          const avgSpeedBytesPerSec = durationMs > 0 ? fileSize / (durationMs / 1000) : 0;
          const connectionType = this.connectionState === 'relay' ? 'relay' : 'p2p';

          await addTransferRecord({
            fileName,
            fileSize,
            mimeType: this.manifest?.mimeType,
            role: 'receiver',
            status: 'completed',
            connectionType,
            durationMs,
            avgSpeedBytesPerSec,
            sha256,
          });

          this.callbacks.onHistoryUpdated();
        }
      };

      worker.onError = (errMsg) => {
        console.error('[VaultDrop:Receiver] Worker error:', errMsg);
        this.callbacks.onError(errMsg);
        this.setTransferState('error');
      };

      worker.startReceive(rawKey);

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
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
                  this.setConnectionState('p2p');
                } else if (state === 'failed') {
                  if (this.transferState !== 'completed') {
                    this.callbacks.onFallbackRequired(true);
                  }
                }
              },
              onChannelReady: () => {
                console.log('[VaultDrop:Receiver] DataChannel open, notifying sender receiver-ready');
                this.setConnectionState('p2p');
                peer.sendText(JSON.stringify({ type: 'receiver-ready' }));
              },
            });

            this.peer = peer;
            peer.handleSignal(message as { type: 'offer'; payload: RTCSessionDescriptionInit });
            break;
          }

          case 'answer':
          case 'candidate':
            this.peer?.handleSignal(
              message as {
                type: 'answer' | 'candidate';
                payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
              },
            );
            break;

          case 'peer-left':
            console.warn('[VaultDrop:Receiver] Sender disconnected');
            if (this.transferState !== 'completed') {
              this.callbacks.onError('errors.connectionLost');
              this.setConnectionState('failed');
            }
            break;
        }
      };
    } catch (err) {
      console.error('[VaultDrop:Receiver] Connection error:', err);
      this.isConnecting = false;
      this.callbacks.onError('errors.connectionLost');
      this.setConnectionState('failed');
    }
  }

  public async chooseSaveLocation(): Promise<void> {
    const suggestedName = this.manifest?.fileName || 'download';
    try {
      const writer = await createFSAFileWriter(suggestedName);
      this.fileWriter = writer;
      console.log('[VaultDrop:Receiver] User picked save location via File System Access API:', suggestedName);
    } catch (err) {
      console.warn('[VaultDrop:Receiver] User dismissed save file picker:', err);
    }
  }

  public async acceptTransfer(): Promise<void> {
    if (!this.manifest) {
      console.warn('[VaultDrop:Receiver] Cannot accept transfer: manifest is null');
      return;
    }

    console.log('[VaultDrop:Receiver] User accepted transfer, initializing storage and notifying sender...');
    this.transferStartTime = Date.now();
    this.hasRecordedCompletion = false;

    try {
      if (!this.fileWriter) {
        const writer = await createAutoFileWriter(this.manifest.fileName);
        this.fileWriter = writer;
        console.log('[VaultDrop:Receiver] Auto-initialized storage with backend:', writer.backend);
      }
    } catch (err) {
      console.error('[VaultDrop:Receiver] Error creating file writer:', err);
      this.callbacks.onError('receive.saveError');
      return;
    }

    this.setTransferState('receiving');

    const acceptMsg = JSON.stringify({ type: 'transfer-accepted' });
    this.peer?.sendText(acceptMsg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(acceptMsg);
      } catch {}
    }
  }

  public rejectTransfer(): void {
    console.log('[VaultDrop:Receiver] User rejected transfer.');
    const rejectMsg = JSON.stringify({ type: 'transfer-rejected' });
    this.peer?.sendText(rejectMsg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(rejectMsg);
      } catch {}
    }

    this.cancelTransfer();
    this.callbacks.onFileManifest(null);
    this.setTransferState('idle');
  }

  public confirmFallback(): void {
    this.callbacks.onFallbackRequired(false);
    this.setConnectionState('relay');

    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: 'relay-start' }));

    const keys = this.sessionKeys;
    if (!keys) return;

    if (this.isSender && this.file) {
      const file = this.file;
      const worker = new TransferWorkerClient();
      this.worker = worker;

      worker.onEncryptedChunk = (chunkData) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunkData);
        }
      };

      worker.onProgress = (sent, total, speed) => {
        const percentage = total > 0 ? Math.round((sent / total) * 100) : 0;
        const eta = speed > 0 ? Math.round((total - sent) / speed) : 0;
        this.lastProgressPercentage = percentage;
        this.callbacks.onProgress({ bytesSent: sent, bytesTotal: total, speed, eta, percentage });
      };

      worker.onSentAllChunks = (sha256) => {
        this.expectedSha256 = sha256;
        this.lastProgressPercentage = 100;
        this.callbacks.onProgress({
          bytesSent: file.size,
          bytesTotal: file.size,
          speed: 0,
          eta: 0,
          percentage: 100,
        });
      };

      worker.onError = (errMsg) => {
        console.error('[VaultDrop:Sender] Worker error:', errMsg);
        this.callbacks.onError(errMsg);
        this.setTransferState('error');
      };

      this.transferStartTime = Date.now();
      this.hasRecordedCompletion = false;
      worker.startSend(file, keys.rawKey, keys.salt);
      this.setTransferState('sending');
    }
  }

  public cancelTransfer(): void {
    this.worker?.abort();
    this.fileWriter?.abort().catch(() => {});
    this.cleanup();
  }

  public cleanup(): void {
    this.isConnecting = false;
    this.hasStartedSend = false;
    this.isAwaitingAcceptance = false;
    this.callbacks.onAwaitingAcceptance?.(false);
    this.transferStartTime = null;
    this.hasRecordedCompletion = false;
    this.file = null;
    this.expectedSha256 = null;
    this.manifest = null;
    this.lastProgressPercentage = 0;

    this.peer?.close();
    this.peer = null;

    this.worker?.destroy();
    this.worker = null;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    this.sessionKeys = null;
    this.fileWriter = null;
    revokeActiveDownloadUrls();
  }

  public destroy(): void {
    this.cancelTransfer();
  }
}
