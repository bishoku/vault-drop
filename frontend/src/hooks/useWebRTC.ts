/// <reference types="vite/client" />

import { useRef, useCallback, useEffect, useState } from 'react';
import { useTransferStore } from '../store';
import { TransferEngine, type TransferEngineCallbacks } from '../core/session/TransferEngine';
import { parseURLFragment } from '../core/crypto';

interface UseWebRTCReturn {
  startSending: (file: File) => Promise<void>;
  startReceiving: () => Promise<void>;
  chooseSaveLocation: () => Promise<void>;
  acceptTransfer: () => Promise<void>;
  rejectTransfer: () => void;
  confirmFallback: () => void;
  cancelTransfer: () => void;
  shareUrl: string | null;
  canChooseSaveLocation: boolean;
}

export function useWebRTC(): UseWebRTCReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const engineRef = useRef<TransferEngine | null>(null);

  // Initialize pure TypeScript TransferEngine once with decoupled store actions
  if (!engineRef.current) {
    const callbacks: TransferEngineCallbacks = {
      onConnectionStateChange: (state) => {
        useTransferStore.getState().setConnectionState(state);
      },
      onTransferStateChange: (state) => {
        useTransferStore.getState().setTransferState(state);
      },
      onProgress: (progress) => {
        useTransferStore.getState().setProgress(progress);
      },
      onFileManifest: (manifest) => {
        useTransferStore.getState().setFileManifest(manifest);
      },
      onHashVerified: (verified) => {
        useTransferStore.getState().setHashVerified(verified);
      },
      onError: (errorKey) => {
        useTransferStore.getState().setError(errorKey);
      },
      onFallbackRequired: (required) => {
        useTransferStore.getState().setFallbackRequired(required);
      },
      onReceivedFile: (file, downloadUrl) => {
        useTransferStore.getState().setReceivedFile(file);
        useTransferStore.getState().setDownloadUrl(downloadUrl);
      },
      onShareUrlGenerated: (url, roomId, rawKey) => {
        setShareUrl(url);
        useTransferStore.getState().setRoomId(roomId);
        useTransferStore.getState().setRawKey(rawKey);
      },
      onHistoryUpdated: () => {
        useTransferStore.getState().loadHistory();
      },
      onAwaitingAcceptance: (awaiting) => {
        useTransferStore.getState().setIsWaitingForAcceptance(awaiting);
      },
    };

    engineRef.current = new TransferEngine(callbacks);
  }

  const startSending = useCallback(async (file: File) => {
    const store = useTransferStore.getState();
    store.setFile(file);
    store.setMode('send');
    await engineRef.current?.startSending(file);
  }, []);

  const startReceiving = useCallback(async () => {
    const fragment = parseURLFragment();
    if (!fragment) {
      useTransferStore.getState().setError('errors.invalidLink');
      return;
    }

    const store = useTransferStore.getState();
    store.setMode('receive');
    store.setRoomId(fragment.roomId);
    store.setRawKey(fragment.rawKey);

    await engineRef.current?.startReceiving(fragment.roomId, fragment.rawKey);
  }, []);

  const chooseSaveLocation = useCallback(async () => {
    await engineRef.current?.chooseSaveLocation();
  }, []);

  const acceptTransfer = useCallback(async () => {
    await engineRef.current?.acceptTransfer();
  }, []);

  const rejectTransfer = useCallback(() => {
    engineRef.current?.rejectTransfer();
  }, []);

  const confirmFallback = useCallback(() => {
    engineRef.current?.confirmFallback();
  }, []);

  const cancelTransfer = useCallback(() => {
    engineRef.current?.cancelTransfer();
    useTransferStore.getState().reset();
    setShareUrl(null);
  }, []);

  // Auto-detect receive mode from URL fragment on mount
  useEffect(() => {
    const fragment = parseURLFragment();
    if (fragment) {
      startReceiving();
    }
    return () => {
      engineRef.current?.destroy();
    };
  }, [startReceiving]);

  return {
    startSending,
    startReceiving,
    chooseSaveLocation,
    acceptTransfer,
    rejectTransfer,
    confirmFallback,
    cancelTransfer,
    shareUrl,
    canChooseSaveLocation: engineRef.current?.canChooseSaveLocation() ?? false,
  };
}
