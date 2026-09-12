import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import { useTransferStore } from '../store';
import { HistoryHeader } from './history/HistoryHeader';
import { HistorySettingsBar } from './history/HistorySettingsBar';
import { HistoryFilterTabs, type HistoryTab } from './history/HistoryFilterTabs';
import { HistoryItemCard } from './history/HistoryItemCard';

export const TransferHistoryDrawer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isHistoryOpen = useTransferStore((s) => s.isHistoryOpen);
  const setIsHistoryOpen = useTransferStore((s) => s.setIsHistoryOpen);
  const history = useTransferStore((s) => s.history);
  const loadHistory = useTransferStore((s) => s.loadHistory);
  const deleteHistoryItem = useTransferStore((s) => s.deleteHistoryItem);
  const clearAllHistory = useTransferStore((s) => s.clearAllHistory);
  const isHistoryEnabled = useTransferStore((s) => s.isHistoryEnabled);
  const setIsHistoryEnabled = useTransferStore((s) => s.setIsHistoryEnabled);

  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
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
  const isTr = Boolean(i18n.language?.startsWith('tr'));

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

        {/* Modular Header */}
        <HistoryHeader
          count={history.length}
          totalVolume={totalVolume}
          confirmClear={confirmClear}
          onClear={handleClear}
          onClose={() => setIsHistoryOpen(false)}
        />

        {/* Settings Bar: History Recording Toggle */}
        <HistorySettingsBar
          isEnabled={isHistoryEnabled}
          onToggle={setIsHistoryEnabled}
        />

        {/* Filter Tabs */}
        <HistoryFilterTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          totalCount={history.length}
        />

        {/* History List */}
        <div
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
          className="flex-1 overflow-y-auto py-3 sm:px-5 sm:py-4 space-y-2.5 sm:space-y-3"
        >
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
              <HistoryItemCard
                key={item.id}
                item={item}
                onDelete={deleteHistoryItem}
                isTr={isTr}
              />
            ))
          )}
        </div>

        {/* Footer info note */}
        <div
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1.25rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1.25rem, env(safe-area-inset-right, 0px))',
          }}
          className="border-t border-border/70 bg-surface-alt/40 pt-3 text-center text-[11px] text-text-tertiary"
        >
          <p>{t('history.privacy_note')}</p>
        </div>
      </div>
    </div>
  );
};

export default TransferHistoryDrawer;
