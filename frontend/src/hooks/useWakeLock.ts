import { useEffect, useCallback } from 'react';

interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
}

let wakeLockSentinel: WakeLockSentinel | null = null;

export function useWakeLock(): WakeLockState {
  const isSupported = 'wakeLock' in navigator;

  const request = useCallback(async () => {
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
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  }, []);

  // Re-acquire wake lock when page becomes visible again
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockSentinel) {
        // Only re-acquire if we had one before (during active transfer)
        // This is handled by the component that uses this hook
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported]);

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
