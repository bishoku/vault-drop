import {
  type FileManifest,
  encryptChunk,
  decryptChunk,
  serializeChunk,
  deserializeChunk,
  importKeyFromRaw,
  bytesToHex,
} from '../crypto';
import { StreamingSHA256 } from '../sha256';

type WorkerInMessage =
  | { type: 'start-send'; file: File; rawKey: Uint8Array; salt: Uint8Array }
  | { type: 'start-receive'; rawKey: Uint8Array }
  | { type: 'chunk-received'; data: ArrayBuffer }
  | { type: 'pause' }
  | { type: 'drain' }
  | { type: 'abort' };

type WorkerOutMessage =
  | { type: 'manifest'; manifest: FileManifest }
  | { type: 'encrypted-chunk'; data: ArrayBuffer }
  | { type: 'decrypted-chunk'; data: Uint8Array; chunkIndex: number }
  | { type: 'progress'; sent: number; total: number; speed: number }
  | { type: 'sent-all-chunks'; sha256: string }
  | { type: 'complete'; sha256: string }
  | { type: 'error'; message: string };

// 128 KB chunks: optimal for high-throughput WebRTC SCTP without RAM or IPC bloat
const CHUNK_SIZE = 128 * 1024;

let aborted = false;
let isBackpressurePaused = false;
let drainResolver: (() => void) | null = null;

interface ReceiverContext {
  encryptionKey: CryptoKey;
  manifest: FileManifest | null;
  hasher: StreamingSHA256;
  receivedChunks: number;
  receivedBytes: number;
  startTime: number;
  lastProgressTime: number;
  lastProgressPercent: number;
  pendingFileChunks: Map<number, ArrayBuffer>;
}

let receiverCtx: ReceiverContext | null = null;
const earlyChunkBuffer: ArrayBuffer[] = [];

const ctx = self as unknown as {
  postMessage: (msg: WorkerOutMessage, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<WorkerInMessage>) => void) | null;
};

function post(msg: WorkerOutMessage, transfer?: Transferable[]): void {
  if (transfer) {
    ctx.postMessage(msg, transfer);
  } else {
    ctx.postMessage(msg);
  }
}

function waitForDrain(): Promise<void> {
  if (!isBackpressurePaused) return Promise.resolve();
  return new Promise((resolve) => {
    drainResolver = resolve;
  });
}

ctx.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  try {
    if (msg.type === 'start-send') {
      await handleSend(msg.file, msg.rawKey, msg.salt);
    } else if (msg.type === 'start-receive') {
      await handleReceive(msg.rawKey);
    } else if (msg.type === 'chunk-received') {
      if (!receiverCtx) {
        earlyChunkBuffer.push(msg.data);
      } else {
        await processIncomingChunk(msg.data);
      }
    } else if (msg.type === 'pause') {
      isBackpressurePaused = true;
    } else if (msg.type === 'drain') {
      isBackpressurePaused = false;
      if (drainResolver) {
        const resolve = drainResolver;
        drainResolver = null;
        resolve();
      }
    } else if (msg.type === 'abort') {
      aborted = true;
      receiverCtx = null;
      earlyChunkBuffer.length = 0;
      if (drainResolver) {
        drainResolver();
        drainResolver = null;
      }
    }
  } catch (err) {
    console.error('[TransferWorker] Error in onmessage:', err);
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

async function handleSend(file: File, rawKey: Uint8Array, salt: Uint8Array) {
  aborted = false;
  isBackpressurePaused = false;
  console.log('[TransferWorker:Send] Starting zero-RAM streaming send for:', file.name, `(${file.size} bytes)`);

  const encryptionKey = await importKeyFromRaw(rawKey);
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  // Chunk 0: Send Manifest instantly with zero pre-read delay
  const manifest: FileManifest = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    totalChunks,
    sha256: '', // Streaming SHA-256 will be provided in final Trailer chunk
  };

  post({ type: 'manifest', manifest });

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const encManifest = await encryptChunk(encryptionKey, salt, manifestBytes, 0, false);
  const serializedManifest = serializeChunk(0, encManifest.iv, encManifest.ciphertext);
  post({ type: 'encrypted-chunk', data: serializedManifest }, [serializedManifest]);

  // Give receiver brief moment to open storage stream
  await new Promise((resolve) => setTimeout(resolve, 80));

  // Stream slices one-by-one with incremental SHA-256 and backpressure
  const hasher = new StreamingSHA256();
  let offset = 0;
  let chunkIndex = 1;
  const startTime = Date.now();
  let lastProgressTime = 0;
  let lastProgressPercent = -1;

  while (offset < file.size && !aborted) {
    if (isBackpressurePaused) {
      await waitForDrain();
    }

    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const isLastChunk = end === file.size;

    // Read only this 128KB slice
    const blobSlice = file.slice(offset, end);
    const sliceBuf = await blobSlice.arrayBuffer();
    const chunkData = new Uint8Array(sliceBuf);

    // Update running SHA-256 hash
    hasher.update(chunkData);

    // Encrypt chunk
    const enc = await encryptChunk(encryptionKey, salt, chunkData, chunkIndex, isLastChunk);
    const serialized = serializeChunk(chunkIndex, enc.iv, enc.ciphertext);

    post({ type: 'encrypted-chunk', data: serialized }, [serialized]);

    offset = end;
    chunkIndex++;

    const currentPercent = file.size > 0 ? Math.floor((offset / file.size) * 100) : 0;
    const now = Date.now();
    if (isLastChunk || now - lastProgressTime >= 100 || currentPercent !== lastProgressPercent) {
      lastProgressTime = now;
      lastProgressPercent = currentPercent;
      const elapsed = (now - startTime) / 1000;
      const speed = elapsed > 0 ? offset / elapsed : 0;
      post({ type: 'progress', sent: offset, total: file.size, speed });
    }

    // Cooperative yield: yield to worker event loop every 16 chunks (2MB) without artificial timer clamp
    if (chunkIndex % 16 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (!aborted) {
    const finalSha256 = hasher.digest();
    console.log('[TransferWorker:Send] All slices sent. Final computed SHA-256:', finalSha256);

    // Send trailer chunk (index = totalChunks + 1) containing final SHA-256
    const trailer = { type: 'trailer', sha256: finalSha256 };
    const trailerBytes = new TextEncoder().encode(JSON.stringify(trailer));
    const encTrailer = await encryptChunk(encryptionKey, salt, trailerBytes, totalChunks + 1, true);
    const serializedTrailer = serializeChunk(totalChunks + 1, encTrailer.iv, encTrailer.ciphertext);
    post({ type: 'encrypted-chunk', data: serializedTrailer }, [serializedTrailer]);

    post({ type: 'sent-all-chunks', sha256: finalSha256 });
  }
}

async function handleReceive(rawKey: Uint8Array) {
  aborted = false;
  console.log('[TransferWorker:Recv] Initializing streaming receiver, rawKey prefix:', bytesToHex(rawKey.slice(0, 8)));
  const encryptionKey = await importKeyFromRaw(rawKey);

  receiverCtx = {
    encryptionKey,
    manifest: null,
    hasher: new StreamingSHA256(),
    receivedChunks: 0,
    receivedBytes: 0,
    startTime: Date.now(),
    lastProgressTime: 0,
    lastProgressPercent: -1,
    pendingFileChunks: new Map(),
  };

  // Process any chunks received before key was ready
  while (earlyChunkBuffer.length > 0 && !aborted) {
    const data = earlyChunkBuffer.shift()!;
    await processIncomingChunk(data);
  }
}

async function processIncomingChunk(data: ArrayBuffer) {
  if (!receiverCtx || aborted) return;

  const { chunkIndex, iv, ciphertext } = deserializeChunk(data);

  // Chunk 0: Encrypted Manifest
  if (chunkIndex === 0) {
    try {
      const decryptedBytes = await decryptChunk(
        receiverCtx.encryptionKey,
        iv,
        ciphertext,
        0,
        false,
      );
      const manifestJson = new TextDecoder().decode(decryptedBytes);
      const manifest = JSON.parse(manifestJson) as FileManifest;
      receiverCtx.manifest = manifest;
      receiverCtx.startTime = Date.now();
      receiverCtx.hasher.init();

      console.log('[TransferWorker:Recv] Manifest received:', manifest.fileName, manifest.fileSize, 'bytes');
      post({ type: 'manifest', manifest });

      // Process any buffered file chunks sequentially
      for (let i = 1; i <= manifest.totalChunks + 1; i++) {
        if (receiverCtx.pendingFileChunks.has(i)) {
          const pendingData = receiverCtx.pendingFileChunks.get(i)!;
          receiverCtx.pendingFileChunks.delete(i);
          await processFileChunk(i, pendingData);
        }
      }
    } catch (err) {
      console.error('[TransferWorker:Recv] Failed to decrypt manifest:', err);
      post({ type: 'error', message: 'Failed to decrypt file manifest' });
    }
    return;
  }

  // Not manifest yet -> buffer chunk
  if (!receiverCtx.manifest) {
    receiverCtx.pendingFileChunks.set(chunkIndex, data);
    return;
  }

  await processFileChunk(chunkIndex, data);
}

async function processFileChunk(chunkIndex: number, data: ArrayBuffer) {
  if (!receiverCtx || !receiverCtx.manifest || aborted) return;

  const { iv, ciphertext } = deserializeChunk(data);
  const totalChunks = receiverCtx.manifest.totalChunks;

  // Trailer Chunk (chunkIndex === totalChunks + 1): final verification
  if (chunkIndex === totalChunks + 1) {
    try {
      const decryptedBytes = await decryptChunk(
        receiverCtx.encryptionKey,
        iv,
        ciphertext,
        chunkIndex,
        true,
      );
      const trailerJson = new TextDecoder().decode(decryptedBytes);
      const trailer = JSON.parse(trailerJson) as { sha256: string };
      const computedSha256 = receiverCtx.hasher.digest();

      console.log('[TransferWorker:Recv] Trailer received. Expected:', trailer.sha256, 'Computed:', computedSha256);

      if (computedSha256.toLowerCase() === trailer.sha256.toLowerCase()) {
        post({ type: 'complete', sha256: computedSha256 });
      } else {
        post({ type: 'error', message: 'errors.hashMismatch' });
      }
    } catch (err) {
      console.error('[TransferWorker:Recv] Failed to process trailer chunk:', err);
      post({ type: 'error', message: 'Failed to verify file integrity' });
    }
    return;
  }

  // Regular File Chunk (1..totalChunks)
  const isLastChunk = chunkIndex === totalChunks;

  try {
    const decrypted = await decryptChunk(
      receiverCtx.encryptionKey,
      iv,
      ciphertext,
      chunkIndex,
      isLastChunk,
    );

    // Update streaming SHA-256 hash with decrypted plaintext
    receiverCtx.hasher.update(decrypted);

    receiverCtx.receivedBytes += decrypted.length;
    receiverCtx.receivedChunks++;

    // Immediately post decrypted chunk to main thread for disk streaming
    // Transfer buffer directly to avoid any extra allocation or memory retention in worker
    post({ type: 'decrypted-chunk', data: decrypted, chunkIndex }, [decrypted.buffer as ArrayBuffer]);

    const total = receiverCtx.manifest.fileSize;
    const currentPercent = total > 0 ? Math.floor((receiverCtx.receivedBytes / total) * 100) : 0;
    const now = Date.now();
    if (isLastChunk || now - receiverCtx.lastProgressTime >= 100 || currentPercent !== receiverCtx.lastProgressPercent) {
      receiverCtx.lastProgressTime = now;
      receiverCtx.lastProgressPercent = currentPercent;
      const elapsed = (now - receiverCtx.startTime) / 1000;
      const speed = elapsed > 0 ? receiverCtx.receivedBytes / elapsed : 0;
      post({
        type: 'progress',
        sent: receiverCtx.receivedBytes,
        total,
        speed,
      });
    }
  } catch (err) {
    console.error(`[TransferWorker:Recv] Decryption failed for chunk ${chunkIndex}:`, err);
    post({ type: 'error', message: `Decryption error on chunk ${chunkIndex}` });
  }
}
