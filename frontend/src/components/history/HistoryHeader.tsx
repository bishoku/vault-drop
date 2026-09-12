import React from 'react';
import { useTranslation } from 'react-i18next';
import { History, X, Trash2 } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

interface HistoryHeaderProps {
  count: number;
  totalVolume: number;
  confirmClear: boolean;
  onClear: () => void;
  onClose: () => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({
  count,
  totalVolume,
  confirmClear,
  onClear,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      className="flex items-center justify-between border-b border-border/70 pb-3 sm:px-5 sm:py-4"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <History size={18} />
        </div>
        <div>
          <h2 id="history-title" className="text-base font-bold text-text-primary">
            {t('history.title')}
          </h2>
          <p className="text-xs text-text-tertiary">
            {count} {t('history.transfers_count')} • {formatFileSize(totalVolume)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
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
          onClick={onClose}
          className="rounded-xl p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
          aria-label="Close history"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
