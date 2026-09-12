import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  History,
  X,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Zap,
  Globe2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useTransferStore } from '../store';
import { formatFileSize } from './DropZone';
import { formatSpeed } from './ProgressBar';

export const TransferHistoryDrawer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    isHistoryOpen,
    setIsHistoryOpen,
    history,
    loadHistory,
    deleteHistoryItem,
    clearAllHistory,
    isHistoryEnabled,
    setIsHistoryEnabled,
  } = useTransferStore();

  const [activeTab, setActiveTab] = useState<'all' | 'sender' | 'receiver'>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (isHistoryOpen) {
      loadHistory();
      setConfirmClear(false);
    }
  }, [isHistoryOpen, loadHistory]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryOpen, setIsHistoryOpen]);

  if (!isHistoryOpen) return null;

  const filteredHistory = history.filter((item) => {
    if (activeTab === 'all') return true;
    return item.role === activeTab;
  });

  const totalVolume = history.reduce((sum, item) => sum + (item.fileSize || 0), 0);
  const isTr = i18n.language?.startsWith('tr');

  const formatDuration = (ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 1) return isTr ? '< 1 sn' : '< 1s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}${isTr ? ' dk' : 'm'} ${s}${isTr ? ' sn' : 's'}`;
    return `${s}${isTr ? ' sn' : 's'}`;
  };

  const formatTimestamp = (timestamp: number): string => {
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
  };

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    await clearAllHistory();
    setConfirmClear(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300"
      onClick={() => setIsHistoryOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
    >
      {/* Drawer Container (Desktop: Right slide-over, Mobile: Bottom Sheet) */}
      <div
        className="flex w-full flex-col border-border bg-surface shadow-2xl transition-transform duration-300 max-sm:mt-auto max-sm:max-h-[90dvh] max-sm:rounded-t-3xl max-sm:border-t sm:h-full sm:max-w-md sm:border-l"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Drag indicator */}
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border sm:hidden" />

        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <History size={18} />
            </div>
            <div>
              <h2 id="history-title" className="text-base font-bold text-text-primary">
                {t('history.title')}
              </h2>
              <p className="text-xs text-text-tertiary">
                {history.length} {t('history.transfers_count')} • {formatFileSize(totalVolume)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  confirmClear
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-text-tertiary hover:bg-surface-hover hover:text-rose-500'
                }`}
                title={t('history.clear_all')}
              >
                <Trash2 size={15} />
                <span>{confirmClear ? t('history.confirm_clear') : t('history.clear_btn')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsHistoryOpen(false)}
              className="rounded-xl p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
              aria-label="Close history"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Settings Bar: History Recording Toggle */}
        <div className="flex items-center justify-between border-b border-border/50 bg-surface-alt/60 px-5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-text-secondary">
            <Clock size={14} className="text-accent" />
            <span className="font-medium">{t('history.save_history_toggle')}</span>
          </div>

          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isHistoryEnabled}
              onChange={(e) => setIsHistoryEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-border peer-checked:bg-accent transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-4" />
          </label>
        </div>

        {!isHistoryEnabled && (
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <AlertCircle size={13} className="shrink-0" />
            <span>{t('history.saving_disabled_hint')}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 border-b border-border/70 px-5 py-3">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface-alt text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            {t('history.tabs.all')} ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sender')}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold transition-colors ${
              activeTab === 'sender'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface-alt text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <ArrowUpRight size={13} />
            <span>{t('history.tabs.sent')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receiver')}
            className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold transition-colors ${
              activeTab === 'receiver'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface-alt text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <ArrowDownLeft size={13} />
            <span>{t('history.tabs.received')}</span>
          </button>
        </div>

        {/* Transfer Records List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt text-text-tertiary mb-3">
                <History size={26} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-bold text-text-primary">{t('history.empty_title')}</p>
              <p className="mt-1 max-w-xs text-xs text-text-tertiary">
                {t('history.empty_desc')}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-2xl border border-border/80 bg-surface-alt/60 p-3.5 transition-all hover:border-border hover:bg-surface-alt hover:shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Direction & File Info */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        item.role === 'sender'
                          ? 'bg-accent/15 text-accent'
                          : 'bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {item.role === 'sender' ? (
                        <ArrowUpRight size={18} strokeWidth={2.5} />
                      ) : (
                        <ArrowDownLeft size={18} strokeWidth={2.5} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-text-primary" title={item.fileName}>
                          {item.fileName}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary font-medium">
                        <span>{formatFileSize(item.fileSize)}</span>
                        <span>•</span>
                        <span>{formatDuration(item.durationMs)}</span>
                        {item.avgSpeedBytesPerSec > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-text-secondary font-semibold">
                              {formatSpeed(item.avgSpeedBytesPerSec)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <span className="text-[10px] text-text-tertiary font-medium">
                      {formatTimestamp(item.timestamp)}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteHistoryItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 rounded-lg p-1 text-text-tertiary hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                      title={t('history.delete_item')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Bottom badges: Connection & SHA-256 */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2 text-[10px]">
                  <div className="flex items-center gap-2">
                    {/* Connection Type */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold ${
                        item.connectionType === 'p2p'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.connectionType === 'p2p' ? (
                        <>
                          <Zap size={10} />
                          <span>{t('header.connection.p2p')}</span>
                        </>
                      ) : (
                        <>
                          <Globe2 size={10} />
                          <span>{t('header.connection.relay')}</span>
                        </>
                      )}
                    </span>

                    {/* Verified badge */}
                    {item.sha256 && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 font-semibold text-accent"
                        title={`SHA-256: ${item.sha256}`}
                      >
                        <ShieldCheck size={10} />
                        <span>SHA-256 ✓</span>
                      </span>
                    )}
                  </div>

                  <span className="text-text-tertiary font-medium">
                    {item.role === 'sender' ? t('history.role_sent') : t('history.role_received')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info note */}
        <div className="border-t border-border/70 bg-surface-alt/40 px-5 py-3 text-center text-[11px] text-text-tertiary">
          <p>{t('history.privacy_note')}</p>
        </div>
      </div>
    </div>
  );
};
