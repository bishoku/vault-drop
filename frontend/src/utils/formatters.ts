/**
 * Utility functions for formatting file sizes, speeds, durations, and timestamps.
 */

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatFileSize(bytesPerSec)}/s`;
}

export function formatETA(seconds: number): string {
  if (seconds < 1) return '< 1s';
  if (seconds === Infinity || isNaN(seconds)) return '--';

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDuration(ms: number, isTr: boolean): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 1) return isTr ? '< 1 sn' : '< 1s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}${isTr ? ' dk' : 'm'} ${s}${isTr ? ' sn' : 's'}`;
  return `${s}${isTr ? ' sn' : 's'}`;
}

export function formatTimestamp(timestamp: number, isTr: boolean): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return isTr ? 'Az önce' : 'Just now';
  if (diff < hour) {
    const mins = Math.floor(diff / minute);
    return isTr ? `${mins} dk önce` : `${mins}m ago`;
  }
  if (diff < day) {
    const hrs = Math.floor(diff / hour);
    return isTr ? `${hrs} saat önce` : `${hrs}h ago`;
  }
  return new Date(timestamp).toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
