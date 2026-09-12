export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  role: 'sender' | 'receiver';
  status: 'completed' | 'failed';
  connectionType: 'p2p' | 'relay';
  durationMs: number;
  avgSpeedBytesPerSec: number;
  sha256?: string;
  timestamp: number;
}

const DB_NAME = 'vaultdrop-db';
const DB_VERSION = 1;
const STORE_NAME = 'transfers';
const HISTORY_ENABLED_KEY = 'vaultdrop-history-enabled';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('role', 'role', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open database'));
    };
  });
}

export function isHistorySavingEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(HISTORY_ENABLED_KEY) !== 'false';
}

export function setHistorySavingEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function getTransferHistory(): Promise<TransferRecord[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result as TransferRecord[]) || [];
        // Sort newest first
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to fetch transfer history'));
      };
    });
  } catch (err) {
    console.warn('[History] Could not retrieve transfer history:', err);
    return [];
  }
}

export async function addTransferRecord(
  record: Omit<TransferRecord, 'id' | 'timestamp'> & Partial<Pick<TransferRecord, 'id' | 'timestamp'>>,
): Promise<TransferRecord | null> {
  if (!isHistorySavingEnabled()) {
    console.log('[History] History saving is disabled by user preference, skipping record.');
    return null;
  }

  const newRecord: TransferRecord = {
    ...record,
    id: record.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: record.timestamp || Date.now(),
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(newRecord);

      request.onsuccess = () => {
        resolve(newRecord);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to save transfer record'));
      };
    });
  } catch (err) {
    console.warn('[History] Could not save transfer record:', err);
    return null;
  }
}

export async function deleteTransferRecord(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to delete transfer record'));
      };
    });
  } catch (err) {
    console.warn('[History] Could not delete transfer record:', err);
  }
}

export async function clearTransferHistory(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to clear transfer history'));
      };
    });
  } catch (err) {
    console.warn('[History] Could not clear transfer history:', err);
  }
}
