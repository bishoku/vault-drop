import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ShieldCheck, ArrowRight, Download, HardDrive, Share2, Image as ImageIcon } from 'lucide-react';
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
  const receivedFile = useTransferStore((s) => s.receivedFile);

  const [canNativeShare, setCanNativeShare] = useState(false);

  const fileName = file?.name || fileManifest?.fileName || t('progress.unknown_file');
  const isCompleted = transferState === 'completed';

  const isImageOrVideo = Boolean(
    receivedFile &&
      (receivedFile.type?.startsWith('image/') ||
        receivedFile.type?.startsWith('video/') ||
        /\.(jpe?g|png|gif|webp|heic|mp4|mov|webm|avif)$/i.test(fileName)),
  );

  useEffect(() => {
    if (!receivedFile || typeof navigator === 'undefined' || !navigator.canShare) {
      setCanNativeShare(false);
      return;
    }

    try {
      const fileObj =
        receivedFile instanceof File
          ? receivedFile
          : new File([receivedFile], fileName, { type: receivedFile.type || 'application/octet-stream' });
      setCanNativeShare(navigator.canShare({ files: [fileObj] }));
    } catch {
      setCanNativeShare(false);
    }
  }, [receivedFile, fileName]);

  const handleNativeShare = async () => {
    if (!receivedFile || typeof navigator === 'undefined' || !navigator.share) return;
    try {
      const fileObj =
        receivedFile instanceof File
          ? receivedFile
          : new File([receivedFile], fileName, { type: receivedFile.type || 'application/octet-stream' });
      await navigator.share({
        files: [fileObj],
        title: fileName,
      });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.warn('[ProgressBar] navigator.share error:', err);
      }
    }
  };

  if (isCompleted) {
    return (
      <div className="flex w-full flex-col items-center gap-4 sm:gap-5 rounded-3xl border border-border bg-surface p-5 sm:p-8 text-center shadow-md">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-success-light text-success shadow-xs">
          <Check size={32} className="sm:w-9 sm:h-9" />
        </div>

        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-text-primary">
            {t('progress.completed')}
          </h3>
          <p className="mt-1 font-medium text-text-secondary text-xs sm:text-sm truncate max-w-xs sm:max-w-md">
            {fileName}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3.5 py-1 text-xs font-semibold">
          {hashVerified === null ? (
            <span className="text-text-secondary">{t('progress.verifying')}</span>
          ) : hashVerified ? (
            <>
              <ShieldCheck size={15} className="text-success" />
              <span className="text-success">{t('progress.verified')}</span>
            </>
          ) : (
            <>
              <X size={15} className="text-danger" />
              <span className="text-danger">{t('errors.hashMismatch')}</span>
            </>
          )}
        </div>

        <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-bold text-accent-text text-sm shadow-md transition-all hover:bg-accent-hover active:scale-95 cursor-pointer"
            >
              {isImageOrVideo ? <ImageIcon size={16} /> : <Share2 size={16} />}
              <span>{isImageOrVideo ? t('progress.save_to_gallery') : t('progress.share_file')}</span>
            </button>
          )}

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={fileName}
              className={`inline-flex items-center justify-center gap-2 rounded-xl ${
                canNativeShare
                  ? 'border border-border bg-surface-alt px-5 py-2.5 font-semibold text-text-primary text-sm hover:bg-border'
                  : 'bg-accent px-5 py-2.5 font-bold text-accent-text text-sm shadow-md hover:bg-accent-hover'
              } transition-all active:scale-95`}
            >
              <Download size={16} />
              <span>{t('progress.download_file')}</span>
            </a>
          )}

          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-alt px-5 py-2.5 font-semibold text-text-primary text-sm hover:bg-border transition-all active:scale-95 cursor-pointer"
          >
            <span>{t('progress.transfer_another')}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-8 shadow-md">
      <div className="flex items-center justify-between gap-3">
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
          <p className="truncate font-semibold text-text-primary text-sm sm:text-lg mt-0.5">
            {fileName}
          </p>
        </div>

        <button
          onClick={onCancel}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger-light"
        >
          {t('progress.cancel')}
        </button>
      </div>

      <div className="relative h-2.5 sm:h-3 w-full overflow-hidden rounded-full bg-surface-alt border border-border">
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

      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-text-secondary">
        <span className="font-bold text-text-primary text-sm">{progress.percentage.toFixed(0)}%</span>
        <span>{formatSpeed(progress.speed)}</span>
        <span>{t('progress.remaining')}: {formatETA(progress.eta)}</span>
      </div>
    </div>
  );
};
