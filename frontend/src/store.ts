import type { FileManifest } from './core/crypto';

type Theme = 'light' | 'dark';
type ConnectionState = 'idle' | 'waiting' | 'connecting' | 'p2p' | 'relay' | 'failed';
type TransferState = 'idle' | 'sending' | 'receiving' | 'completed' | 'error';
type AppMode = 'send' | 'receive';

interface TransferProgress {
  bytesSent: number;
  bytesTotal: number;
  speed: number;
  eta: number;
  percentage: number;
}

interface TransferStore {
  // App mode
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Room
  roomId: string | null;
  setRoomId: (roomId: string | null) => void;

  // Key
  rawKey: Uint8Array | null;
  setRawKey: (rawKey: Uint8Array | null) => void;

  // Connection
  connectionState: ConnectionState;
  setConnectionState: (state: ConnectionState) => void;
  isFallbackRequired: boolean;
  setFallbackRequired: (required: boolean) => void;

  // Transfer
  transferState: TransferState;
  setTransferState: (state: TransferState) => void;
  progress: TransferProgress;
  setProgress: (progress: Partial<TransferProgress>) => void;

  // File
  file: File | null;
  setFile: (file: File | null) => void;
  fileManifest: FileManifest | null;
  setFileManifest: (manifest: FileManifest | null) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;

  // Hash verification
  hashVerified: boolean | null;
  setHashVerified: (verified: boolean | null) => void;

  // Download URL (for receiver manual re-download)
  downloadUrl: string | null;
  setDownloadUrl: (url: string | null) => void;

  // Reset
  reset: () => void;
}

const initialProgress: TransferProgress = {
  bytesSent: 0,
  bytesTotal: 0,
  speed: 0,
  eta: 0,
  percentage: 0,
};

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('vaultdrop-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('vaultdrop-theme', theme);
}

// We use zustand without importing it here — the actual store creation
// is done in the component tree. This file exports the store creator.
import { create } from 'zustand';

export const useTransferStore = create<TransferStore>((set) => {
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);

  return {
    mode: 'send',
    setMode: (mode) => set({ mode }),

    theme: initialTheme,
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
    toggleTheme: () =>
      set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme(newTheme);
        return { theme: newTheme };
      }),

    roomId: null,
    setRoomId: (roomId) => set({ roomId }),

    rawKey: null,
    setRawKey: (rawKey) => set({ rawKey }),

    connectionState: 'idle',
    setConnectionState: (connectionState) => set({ connectionState }),
    isFallbackRequired: false,
    setFallbackRequired: (isFallbackRequired) => set({ isFallbackRequired }),

    transferState: 'idle',
    setTransferState: (transferState) => set({ transferState }),
    progress: { ...initialProgress },
    setProgress: (progress) =>
      set((state) => ({
        progress: { ...state.progress, ...progress },
      })),

    file: null,
    setFile: (file) => set({ file }),
    fileManifest: null,
    setFileManifest: (fileManifest) => set({ fileManifest }),

    error: null,
    setError: (error) => set({ error }),

    hashVerified: null,
    setHashVerified: (hashVerified) => set({ hashVerified }),

    downloadUrl: null,
    setDownloadUrl: (downloadUrl) => set({ downloadUrl }),

    reset: () =>
      set({
        roomId: null,
        rawKey: null,
        connectionState: 'idle',
        isFallbackRequired: false,
        transferState: 'idle',
        progress: { ...initialProgress },
        file: null,
        fileManifest: null,
        error: null,
        hashVerified: null,
        downloadUrl: null,
      }),
  };
});

export type { TransferStore, TransferProgress, ConnectionState, TransferState, Theme, AppMode };
