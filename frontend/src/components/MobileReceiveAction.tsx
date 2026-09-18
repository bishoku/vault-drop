import { useTranslation } from 'react-i18next';
import { QrCode, ArrowDownToLine } from 'lucide-react';

interface MobileReceiveActionProps {
  onOpenScanner: () => void;
}

export function MobileReceiveAction({ onOpenScanner }: MobileReceiveActionProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full sm:hidden">
      <button
        type="button"
        onClick={onOpenScanner}
        className="group relative flex w-full items-center justify-between gap-3.5 overflow-hidden rounded-2xl border border-accent/30 bg-surface/80 p-3.5 text-left shadow-xs backdrop-blur-sm transition-all hover:border-accent/60 hover:bg-surface active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent group-hover:scale-105 transition-transform">
            <QrCode size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-text-primary">
                {t('mobile_receive.action_title')}
              </span>
              <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary truncate">
              {t('mobile_receive.action_desc')}
            </p>
          </div>
        </div>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-border/40 text-text-secondary group-hover:bg-accent group-hover:text-white transition-colors">
          <ArrowDownToLine size={14} />
        </div>
      </button>
    </div>
  );
}
