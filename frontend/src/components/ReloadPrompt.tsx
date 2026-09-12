import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export const ReloadPrompt: React.FC = () => {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registered:', r?.scope);
    },
    onRegisterError(error) {
      console.error('[PWA] Service Worker registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <aside
      role="region"
      aria-label={t('pwa.update_available')}
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        right: 'max(1rem, env(safe-area-inset-right, 0px))',
        left: 'max(1rem, env(safe-area-inset-left, 0px))',
      }}
      className="fixed z-50 max-w-sm ml-auto rounded-2xl border border-border/80 bg-surface/95 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Sparkles size={20} />
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-sm font-bold text-text-primary leading-tight">
            {t('pwa.update_available')}
          </h3>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {t('pwa.update_desc')}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-text shadow-sm transition-all hover:bg-accent-hover active:scale-95 cursor-pointer"
            >
              <RefreshCw size={13} className="animate-spin-slow" />
              <span>{t('pwa.update_now')}</span>
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-text-tertiary transition-colors hover:bg-surface-alt hover:text-text-primary cursor-pointer"
            >
              {t('pwa.dismiss')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg p-1 text-text-tertiary hover:bg-surface-alt hover:text-text-primary transition-colors cursor-pointer"
          aria-label={t('pwa.dismiss')}
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
};
