import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, ShieldCheck, HardDrive, ChevronDown } from 'lucide-react';

export function FeatureHighlights() {
  const { t } = useTranslation();
  const [activeMobileFeature, setActiveMobileFeature] = useState<number | null>(null);

  const features = [
    {
      id: 0,
      title: t('features.p2p_title'),
      desc: t('features.p2p_desc'),
      icon: Zap,
      color: 'text-accent',
      bg: 'bg-accent/10',
      borderActive: 'border-accent/50 bg-accent/10',
    },
    {
      id: 1,
      title: t('features.crypto_title'),
      desc: t('features.crypto_desc'),
      icon: ShieldCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      borderActive: 'border-emerald-500/50 bg-emerald-500/10',
    },
    {
      id: 2,
      title: t('features.stream_title'),
      desc: t('features.stream_desc'),
      icon: HardDrive,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      borderActive: 'border-purple-500/50 bg-purple-500/10',
    },
  ];

  const toggleFeature = (index: number) => {
    setActiveMobileFeature((prev) => (prev === index ? null : index));
  };

  return (
    <div className="w-full pt-1 sm:pt-2">
      {/* 1. Desktop & Tablet: Full 3-card grid (sm and up) */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.id}
              className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/70 p-3.5 backdrop-blur-sm shadow-xs"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${feat.bg} ${feat.color}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-text-primary">{feat.title}</p>
                <p className="text-[11px] text-text-tertiary truncate">{feat.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Mobile: Compact Segmented Bar with Collapsible Accordion (< sm) */}
      <div className="sm:hidden flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border/70 bg-surface/60 p-1.5 backdrop-blur-sm shadow-xs">
          {features.map((feat) => {
            const Icon = feat.icon;
            const isSelected = activeMobileFeature === feat.id;

            return (
              <button
                key={feat.id}
                type="button"
                onClick={() => toggleFeature(feat.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 text-center transition-all ${
                  isSelected
                    ? feat.borderActive
                    : 'text-text-secondary hover:bg-border/30 active:scale-95'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${feat.bg} ${feat.color}`}>
                    <Icon size={14} />
                  </div>
                  {isSelected && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-0.5 w-full">
                  <span className={`text-[10px] font-semibold leading-tight text-center ${isSelected ? 'text-text-primary font-bold' : 'text-text-secondary'}`}>
                    {feat.title}
                  </span>
                  <ChevronDown
                    size={10}
                    className={`shrink-0 transition-transform duration-200 ${
                      isSelected ? 'rotate-180 text-text-primary' : 'text-text-tertiary opacity-70'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Collapsible Info Drawer for Selected Mobile Feature */}
        {activeMobileFeature !== null && features[activeMobileFeature] && (
          <div className="animate-fade-in flex items-center justify-between rounded-xl border border-border/60 bg-surface/90 px-3.5 py-2.5 shadow-xs backdrop-blur-md text-left">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-[11px] font-medium text-text-secondary">
                {features[activeMobileFeature].desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveMobileFeature(null)}
              className="text-[10px] text-text-tertiary underline ml-2 shrink-0"
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
