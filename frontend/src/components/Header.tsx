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
    let animate = '';

    switch (connectionState) {
      case 'p2p':
        dotColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]';
        label = t('header.connection.p2p');
        break;
      case 'relay':
        dotColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]';
        label = t('header.connection.relay');
        break;
      case 'connecting':
        dotColor = 'bg-blue-500';
        label = t('header.connection.connecting');
        animate = 'animate-pulse';
        break;
      case 'waiting':
      case 'idle':
      default:
        dotColor = 'bg-rose-500';
        label = t('header.connection.waiting');
        break;
    }

    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-xs">
        <span className={`h-2 w-2 rounded-full ${dotColor} ${animate}`} />
        <span>{label}</span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/70 bg-surface/85 px-4 py-3.5 backdrop-blur-xl sm:px-8">
      {/* Brand & E2EE badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <img
            src="./logo-128x128.png"
            alt="VaultDrop Logo"
            className="h-9 w-9 rounded-xl object-cover shadow-sm ring-1 ring-border/50"
            width={36}
            height={36}
          />
          <span className="text-xl font-black tracking-tight text-text-primary">
            VaultDrop
          </span>
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold text-accent sm:inline-flex">
          <Lock size={12} strokeWidth={2.5} />
          <span>{t('header.e2ee')}</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {renderConnectionStatus()}

        <div className="flex items-center gap-1 border-l border-border pl-2 sm:pl-3">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="relative rounded-xl p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={t('history.title')}
            aria-label={t('history.title')}
          >
            <History size={18} />
            {history.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
            )}
          </button>

          <button
            onClick={handleLanguageToggle}
            className="flex items-center gap-1 rounded-xl p-2 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={i18n.language?.startsWith('tr') ? 'Switch to English' : 'Türkçeye geç'}
            aria-label="Toggle language"
          >
            <Globe size={18} />
            <span className="uppercase">{i18n.language?.startsWith('tr') ? 'TR' : 'EN'}</span>
          </button>

          <button
            onClick={toggleTheme}
            className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};
