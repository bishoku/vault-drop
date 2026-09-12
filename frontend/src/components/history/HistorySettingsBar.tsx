import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, AlertCircle } from 'lucide-react';

interface HistorySettingsBarProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const HistorySettingsBar: React.FC<HistorySettingsBarProps> = ({ isEnabled, onToggle }) => {
  const { t } = useTranslation();

  return (
    <>
      <div
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        className="flex items-center justify-between border-b border-border/50 bg-surface-alt/60 py-2.5 sm:px-5 text-xs"
      >
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock size={14} className="text-accent" />
          <span className="font-medium">{t('history.save_history_toggle')}</span>
        </div>

        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full bg-border peer-checked:bg-accent transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-4" />
        </label>
      </div>

      {!isEnabled && (
        <div
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
          className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 py-2 sm:px-5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
        >
          <AlertCircle size={13} className="shrink-0" />
          <span>{t('history.saving_disabled_hint')}</span>
        </div>
      )}
    </>
  );
};
