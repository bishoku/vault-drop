import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ShieldCheck, ArrowRight, Download, HardDrive } from 'lucide-react';
import { useTransferStore } from '../store';
import { formatFileSize } from './DropZone';

export const formatSpeed = (bytesPerSec: number): string => {
  return `${formatFileSize(bytesPerSec)}/s`;
};

export const formatETA = (seconds: number): string => {
  if (seconds < 1) return '< 1s';
  if (seconds === Infinity || isNaN(seconds)) return '--';

  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);

  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

interface ProgressBarProps {
  onCancel: () => void;
  onReset: () => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ onCancel, onReset }) => {
  const { t } = useTranslation();
  const transferState = useTransferStore((s) => s.transferState);
  const progress = useTransferStore((s) => s.progress);
  const file = useTransferStore((s) => s.file);
  const fileManifest = useTransferStore((s) => s.fileManifest);
  const hashVerified = useTransferStore((s) => s.hashVerified);
  const downloadUrl = useTransferStore((s) => s.downloadUrl);

  if (transferState === 'idle') return null;

  const fileName = file?.name || fileManifest?.fileName || t('progress.unknown_file');
  const isCompleted = transferState === 'completed';

  if (isCompleted) {
    return (
      <div className="flex w-full flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-md">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-light text-success shadow-xs">
          <Check size={36} />
        </div>

        <div>
          <h3 className="text-2xl font-extrabold text-text-primary">
            {t('progress.completed')}
          </h3>
          <p className="mt-1 font-medium text-text-secondary text-sm">
            {fileName}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-4 py-1.5 text-xs font-semibold">
          {hashVerified === null ? (
            <span className="text-text-secondary">{t('progress.verifying')}</span>
          ) : hashVerified ? (
            <>
              <ShieldCheck size={16} className="text-success" />
              <span className="text-success">{t('progress.verified')}</span>
            </>
          ) : (
            <>
              <X size={16} className="text-danger" />
              <span className="text-danger">{t('errors.hashMismatch')}</span>
            </>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={fileName}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-text text-sm shadow-md transition-all hover:bg-accent-hover active:scale-95"
            >
              <Download size={16} />
              <span>{t('progress.download_file')}</span>
            </a>
          )}
          <button
            onClick={onReset}
            className={`inline-flex items-center gap-2 rounded-xl ${
              downloadUrl
                ? 'border border-border bg-surface-alt px-5 py-2.5 font-semibold text-text-primary text-sm hover:bg-border'
                : 'bg-accent px-6 py-3 font-bold text-accent-text text-sm shadow-md hover:bg-accent-hover'
            } transition-all active:scale-95`}
          >
            <span>{t('progress.transfer_another')}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-accent">
              {transferState === 'sending' ? t('progress.sending') : t('progress.receiving')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              <HardDrive size={11} />
              <span>{t('progress.streaming_to_disk')}</span>
            </span>
          </div>
          <p className="truncate font-semibold text-text-primary text-base sm:text-lg">
            {fileName}
          </p>
        </div>

        <button
          onClick={onCancel}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-light"
        >
          {t('progress.cancel')}
        </button>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-alt border border-border">
        <div
          className="relative h-full transition-all duration-300 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, progress.percentage))}%`,
            backgroundColor: 'var(--color-accent)',
          }}
        >
          <div className="progress-shimmer absolute inset-0" />
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-text-secondary">
        <span className="font-bold text-text-primary text-sm">{progress.percentage.toFixed(0)}%</span>
        <span>{formatSpeed(progress.speed)}</span>
        <span>{t('progress.remaining')}: {formatETA(progress.eta)}</span>
      </div>
    </div>
  );
};
