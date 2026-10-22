import { useEffect, useCallback } from 'react';

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

let wakeLockSentinel: WakeLockSentinel | null = null;
let shouldHoldWakeLock = false;

export function useWakeLock(): WakeLockState {
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const request = useCallback(async () => {
    shouldHoldWakeLock = true;
    if (!isSupported) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
    } catch {
      // Wake lock request failed (e.g., low battery, background tab)
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    shouldHoldWakeLock = false;
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again during an active transfer
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldHoldWakeLock && !wakeLockSentinel) {
        request().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported, request]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }
    };
  }, []);

  return {
    isSupported,
    isActive: wakeLockSentinel !== null,
    request,
    release,
  };
}
