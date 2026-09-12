import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export type HistoryTab = 'all' | 'sender' | 'receiver';

interface HistoryFilterTabsProps {
  activeTab: HistoryTab;
  onSelectTab: (tab: HistoryTab) => void;
  totalCount: number;
}

export const HistoryFilterTabs: React.FC<HistoryFilterTabsProps> = ({
  activeTab,
  onSelectTab,
  totalCount,
}) => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      className="flex gap-2 border-b border-border/70 py-2.5 sm:px-5 sm:py-3"
    >
      <button
        type="button"
        onClick={() => onSelectTab('all')}
        className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-colors ${
          activeTab === 'all'
            ? 'bg-accent text-white shadow-xs'
            : 'bg-surface-alt text-text-secondary hover:bg-surface-hover hover:text-text-primary'
        }`}
      >
        {t('history.tabs.all')} ({totalCount})
      </button>
      <button
        type="button"
        onClick={() => onSelectTab('sender')}
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
        onClick={() => onSelectTab('receiver')}
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
  );
};
