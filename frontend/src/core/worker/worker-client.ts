import type { FileManifest } from '../crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface WorkerMessage {
  type: string;
  manifest?: FileManifest;
  data?: any;
  chunkIndex?: number;
  sent?: number;
  total?: number;
  speed?: number;
  sha256?: string;
  message?: string;
}

export class TransferWorkerClient {
  private worker: Worker;

  public onManifest: ((manifest: FileManifest) => void) | null = null;
  public onManifestSent: ((manifest: FileManifest) => void) | null = null;
  public onEncryptedChunk: ((data: ArrayBuffer) => void) | null = null;
  public onDecryptedChunk: ((data: Uint8Array, chunkIndex: number) => void) | null = null;
  public onProgress: ((sent: number, total: number, speed: number) => void) | null = null;
  public onSentAllChunks: ((sha256: string) => void) | null = null;
  public onComplete: ((sha256: string) => void) | null = null;
  public onError: ((message: string) => void) | null = null;
  public onPause: (() => void) | null = null;

  constructor() {
    this.worker = new Worker(new URL('./transfer.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => this.handleMessage(e.data as WorkerMessage);
    this.worker.onerror = (e) => {
      if (this.onError) this.onError(e.message);
    };
  }

  private handleMessage(msg: WorkerMessage) {
    switch (msg.type) {
      case 'manifest':
        if (this.onManifest && msg.manifest) this.onManifest(msg.manifest);
        break;
      case 'manifest-sent':
        if (this.onManifestSent && msg.manifest) this.onManifestSent(msg.manifest);
        break;
      case 'encrypted-chunk':
        if (this.onEncryptedChunk && msg.data) this.onEncryptedChunk(msg.data as ArrayBuffer);
        break;
      case 'decrypted-chunk':
        if (this.onDecryptedChunk && msg.data != null && msg.chunkIndex != null)
          this.onDecryptedChunk(msg.data as Uint8Array, msg.chunkIndex);
        break;
      case 'progress':
        if (this.onProgress && msg.sent != null && msg.total != null && msg.speed != null)
          this.onProgress(msg.sent, msg.total, msg.speed);
        break;
      case 'sent-all-chunks':
        if (this.onSentAllChunks && msg.sha256) this.onSentAllChunks(msg.sha256);
        break;
      case 'complete':
        if (this.onComplete && msg.sha256) this.onComplete(msg.sha256);
        break;
      case 'error':
        if (this.onError && msg.message) this.onError(msg.message);
        break;
      case 'pause':
        if (this.onPause) this.onPause();
        break;
    }
  }

  public startSend(file: File, rawKey: Uint8Array, salt: Uint8Array): void {
    this.worker.postMessage({ type: 'start-send', file, rawKey, salt });
  }

  public startStream(): void {
    this.worker.postMessage({ type: 'start-stream' });
  }

  public startReceive(rawKey: Uint8Array): void {
    this.worker.postMessage({ type: 'start-receive', rawKey });
  }

  public feedChunk(data: ArrayBuffer): void {
    this.worker.postMessage({ type: 'chunk-received', data }, [data]);
  }

  public notifyPause(): void {
    this.worker.postMessage({ type: 'pause' });
  }

  public notifyDrain(): void {
    this.worker.postMessage({ type: 'drain' });
  }

  public abort(): void {
    this.worker.postMessage({ type: 'abort' });
  }

  public destroy(): void {
    this.abort();
    this.worker.terminate();
  }
}
