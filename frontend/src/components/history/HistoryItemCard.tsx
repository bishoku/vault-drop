import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ArrowDownLeft, Trash2, Zap, Globe2, ShieldCheck } from 'lucide-react';
import type { TransferRecord } from '../../store';
import { formatFileSize, formatSpeed, formatDuration, formatTimestamp } from '../../utils/formatters';

interface HistoryItemCardProps {
  item: TransferRecord;
  onDelete: (id: string) => void;
  isTr: boolean;
}

export const HistoryItemCard: React.FC<HistoryItemCardProps> = ({ item, onDelete, isTr }) => {
  const { t } = useTranslation();

  return (
    <div className="group relative rounded-2xl border border-border/80 bg-surface-alt/60 p-3.5 transition-all hover:border-border hover:bg-surface-alt hover:shadow-xs">
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
              <span>{formatDuration(item.durationMs, isTr)}</span>
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
            {formatTimestamp(item.timestamp, isTr)}
          </span>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 rounded-lg p-1 text-text-tertiary hover:bg-rose-500/10 hover:text-rose-500 transition-all cursor-pointer"
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
  );
};
