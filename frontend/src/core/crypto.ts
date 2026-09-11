export interface SessionKeys {
  encryptionKey: CryptoKey;
  rawKey: Uint8Array;
  salt: Uint8Array;
}

export interface EncryptedChunk {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface FileManifest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  sha256: string;
}

export async function generateSessionKeys(): Promise<SessionKeys> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(4));
  const encryptionKey = await importKeyFromRaw(rawKey);
  return {
    encryptionKey,
    rawKey,
    salt,
  };
}

export async function importKeyFromRaw(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey as unknown as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function createIV(salt: Uint8Array, chunkIndex: number): Uint8Array {
  const iv = new Uint8Array(12);
  iv.set(salt, 0);
  const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
  view.setBigUint64(4, BigInt(chunkIndex), false);
  return iv;
}

export function createAAD(chunkIndex: number, isLastChunk: boolean): Uint8Array {
  const aad = new Uint8Array(9);
  const view = new DataView(aad.buffer, aad.byteOffset, aad.byteLength);
  view.setBigUint64(0, BigInt(chunkIndex), false);
  aad[8] = isLastChunk ? 1 : 0;
  return aad;
}

export async function encryptChunk(
  key: CryptoKey,
  salt: Uint8Array,
  chunkData: Uint8Array,
  chunkIndex: number,
  isLastChunk: boolean,
): Promise<EncryptedChunk> {
  const iv = createIV(salt, chunkIndex);
  const aad = createAAD(chunkIndex, isLastChunk);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as ArrayBuffer,
      additionalData: aad as unknown as ArrayBuffer,
      tagLength: 128,
    },
    key,
    chunkData as unknown as ArrayBuffer,
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertext),
  };
}

export async function decryptChunk(
  key: CryptoKey,
  iv: Uint8Array,
  encryptedData: Uint8Array,
  chunkIndex: number,
  isLastChunk: boolean,
): Promise<Uint8Array> {
  const aad = createAAD(chunkIndex, isLastChunk);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as ArrayBuffer,
      additionalData: aad as unknown as ArrayBuffer,
      tagLength: 128,
    },
    key,
    encryptedData as unknown as ArrayBuffer,
  );

  return new Uint8Array(plaintext);
}

export function encodeKeyForURL(rawKey: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < rawKey.length; i++) {
    binary += String.fromCharCode(rawKey[i]!);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeKeyFromURL(encoded: string): Uint8Array {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function parseURLFragment(): { roomId: string; rawKey: Uint8Array } | null {
  const fragment = window.location.hash.substring(1);
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const roomId = params.get('room');
  const keyStr = params.get('key');
  if (!roomId || !keyStr) return null;
  try {
    return {
      roomId,
      rawKey: decodeKeyFromURL(keyStr),
    };
  } catch (e) {
    console.error('[VaultDrop] Error parsing key from URL fragment:', e);
    return null;
  }
}

export function buildShareURL(roomId: string, rawKey: Uint8Array): string {
  const keyStr = encodeKeyForURL(rawKey);
  const url = new URL(window.location.href);
  url.hash = `room=${roomId}&key=${keyStr}`;
  return url.toString();
}

export async function computeFileHash(file: File): Promise<string> {
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const fullBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', fullBuffer as unknown as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function serializeChunk(chunkIndex: number, iv: Uint8Array, ciphertext: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(4 + 12 + ciphertext.length);
  const view = new DataView(buffer);
  view.setUint32(0, chunkIndex, false);
  const bytes = new Uint8Array(buffer);
  bytes.set(iv, 4);
  bytes.set(ciphertext, 16);
  return buffer;
}

export function deserializeChunk(buffer: ArrayBuffer): {
  chunkIndex: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
} {
  const view = new DataView(buffer);
  const chunkIndex = view.getUint32(0, false);
  const bytes = new Uint8Array(buffer);
  const iv = bytes.slice(4, 16);
  const ciphertext = bytes.slice(16);
  return { chunkIndex, iv, ciphertext };
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
