export type StorageBackend = 'file-system-access' | 'opfs' | 'blob';

export interface FileWriter {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<Blob | null>; // Returns null if written directly to disk (FSA) or Blob/File if OPFS/memory
  abort(): Promise<void>;
  backend: StorageBackend;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export function isOPFSSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

interface SaveFilePickerOptions {
  suggestedName?: string;
}

const activeBlobUrls = new Set<string>();

/**
 * Revokes all active object URLs created for downloads to promptly free browser heap memory.
 */
export function revokeActiveDownloadUrls(): void {
  for (const url of activeBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  activeBlobUrls.clear();
}

/**
 * Cleans up orphaned or expired temporary files in OPFS root.
 * Files older than maxAgeMs (default: 30 minutes) are purged.
 */
export async function cleanupOPFSTempFiles(maxAgeMs: number = 30 * 60 * 1000): Promise<void> {
  if (!isOPFSSupported()) return;

  try {
    const root = await navigator.storage.getDirectory();
    const dirHandle = root as unknown as {
      entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    };

    if (typeof dirHandle.entries === 'function') {
      const now = Date.now();
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && name.startsWith('vaultdrop_')) {
          const parts = name.split('_');
          const timestamp = parseInt(parts[1] || '0', 10);
          if (timestamp > 0 && now - timestamp > maxAgeMs) {
            try {
              await root.removeEntry(name);
              console.log('[Storage:OPFS] Purged orphaned temp file:', name);
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Storage:OPFS] Error during OPFS cleanup:', err);
  }
}

/**
 * Creates a stream writer using File System Access API (requires user gesture).
 */
export async function createFSAFileWriter(
  suggestedName: string,
): Promise<FileWriter> {
  const pickerOptions: SaveFilePickerOptions = {
    suggestedName,
  };

  const win = window as unknown as {
    showSaveFilePicker: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  };

  // User selects file location on local disk
  const handle = await win.showSaveFilePicker(pickerOptions);
  const writable = await handle.createWritable();

  return {
    backend: 'file-system-access',
    write: async (chunk: Uint8Array) => {
      await writable.write(chunk as unknown as BufferSource);
    },
    close: async () => {
      await writable.close();
      return null; // File is already saved on user's disk!
    },
    abort: async () => {
      try {
        await writable.abort();
      } catch {}
    },
  };
}

/**
 * Creates a stream writer using Origin Private File System (OPFS).
 * Supported in Safari, Firefox, and Chrome. Writes directly to disk sandbox without RAM buildup.
 */
export async function createOPFSFileWriter(
  fileName: string,
): Promise<FileWriter> {
  const root = await navigator.storage.getDirectory();
  // Unique temp file name in OPFS
  const tempName = `vaultdrop_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fileHandle = await root.getFileHandle(tempName, { create: true });
  const writable = await fileHandle.createWritable();

  return {
    backend: 'opfs',
    write: async (chunk: Uint8Array) => {
      await writable.write(chunk as unknown as BufferSource);
    },
    close: async () => {
      await writable.close();
      const file = await fileHandle.getFile();

      // Schedule cleanup of the temporary sandbox file after 3 minutes
      // so browser download has finished reading the blob/file
      setTimeout(async () => {
        try {
          await root.removeEntry(tempName);
          console.log('[Storage:OPFS] Cleaned up completed temp file:', tempName);
        } catch {}
      }, 180000);

      return file;
    },
    abort: async () => {
      try {
        await writable.abort();
        await root.removeEntry(tempName);
      } catch {}
    },
  };
}

/**
 * In-memory fallback writer for environments without FSA or OPFS.
 * Avoids duplicate Uint8Array allocations during chunk accumulation.
 */
export function createBlobFileWriter(): FileWriter {
  const chunks: Uint8Array[] = [];

  return {
    backend: 'blob',
    write: async (chunk: Uint8Array) => {
      // Avoid duplicate buffer allocation since chunk is already a fresh Uint8Array
      chunks.push(chunk);
    },
    close: async () => {
      const blob = new Blob(chunks as unknown as BlobPart[], {
        type: 'application/octet-stream',
      });
      chunks.length = 0;
      return blob;
    },
    abort: async () => {
      chunks.length = 0;
    },
  };
}

/**
 * Automatically creates the best non-interactive file writer (OPFS if available, else Blob).
 * Does not require a user gesture.
 */
export async function createAutoFileWriter(fileName: string): Promise<FileWriter> {
  if (isOPFSSupported()) {
    try {
      return await createOPFSFileWriter(fileName);
    } catch (err) {
      console.warn('[Storage] OPFS writer failed, falling back to Blob:', err);
    }
  }
  return createBlobFileWriter();
}

/**
 * Triggers a browser download for a Blob and registers it for memory cleanup.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): string {
  const url = URL.createObjectURL(blob);
  activeBlobUrls.add(url);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
  }, 1000);

  // Automatically revoke after 60 seconds to release Blob from browser RAM
  setTimeout(() => {
    if (activeBlobUrls.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
      activeBlobUrls.delete(url);
    }
  }, 60000);

  return url;
}
