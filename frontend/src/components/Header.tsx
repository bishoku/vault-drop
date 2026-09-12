import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Globe, Sun, Moon, History } from 'lucide-react';
import { useTransferStore } from '../store';

export const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { connectionState, theme, toggleTheme, history, setIsHistoryOpen } = useTransferStore();

  const handleLanguageToggle = () => {
    const nextLang = i18n.language === 'tr' ? 'en' : 'tr';
    i18n.changeLanguage(nextLang);
  };

  const renderConnectionStatus = () => {
    let dotColor = 'bg-rose-500';
    let label = t('header.connection.waiting');
    let shortLabel = t('header.connection.waiting_short');
    let animate = '';

    switch (connectionState) {
      case 'p2p':
        dotColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]';
        label = t('header.connection.p2p');
        shortLabel = t('header.connection.p2p_short');
        break;
      case 'relay':
        dotColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]';
        label = t('header.connection.relay');
        shortLabel = t('header.connection.relay_short');
        break;
      case 'connecting':
        dotColor = 'bg-blue-500';
        label = t('header.connection.connecting');
        shortLabel = t('header.connection.connecting_short');
        animate = 'animate-pulse';
        break;
      case 'waiting':
      case 'idle':
      default:
        dotColor = 'bg-rose-500';
        label = t('header.connection.waiting');
        shortLabel = t('header.connection.waiting_short');
        break;
    }

    return (
      <div
        className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-border bg-surface px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-text-secondary shadow-xs whitespace-nowrap shrink-0"
        title={label}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor} ${animate}`} />
        <span className="hidden sm:inline">{label}</span>
        <span className="inline sm:hidden">{shortLabel}</span>
      </div>
    );
  };

  return (
    <header
      style={{
        paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
      }}
      className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-border/70 bg-surface/85 pb-2.5 sm:px-8 sm:py-3.5 backdrop-blur-xl"
    >
      {/* Brand & E2EE badge */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <img
            src="./logo-128x128.png"
            alt="VaultDrop Logo"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover shadow-sm ring-1 ring-border/50 shrink-0"
            width={36}
            height={36}
          />
          <span className="text-lg sm:text-xl font-black tracking-tight text-text-primary shrink-0">
            VaultDrop
          </span>
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold text-accent md:inline-flex">
          <Lock size={12} strokeWidth={2.5} />
          <span>{t('header.e2ee')}</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
        {renderConnectionStatus()}

        <div className="flex items-center gap-0.5 sm:gap-1 border-l border-border pl-1.5 sm:pl-3">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={t('history.title')}
            aria-label={t('history.title')}
          >
            <History size={17} className="sm:w-[18px] sm:h-[18px]" />
            {history.length > 0 && (
              <span className="absolute top-1 right-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
            )}
          </button>

          <button
            onClick={handleLanguageToggle}
            className="flex h-8 sm:h-9 items-center gap-1 rounded-xl px-2 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={i18n.language?.startsWith('tr') ? 'Switch to English' : 'Türkçeye geç'}
            aria-label="Toggle language"
          >
            <Globe size={16} className="sm:w-[18px] sm:h-[18px]" />
            <span className="uppercase text-[11px] sm:text-xs">{i18n.language?.startsWith('tr') ? 'TR' : 'EN'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun size={17} className="text-amber-400 sm:w-[18px] sm:h-[18px]" />
            ) : (
              <Moon size={17} className="sm:w-[18px] sm:h-[18px]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
