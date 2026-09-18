import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  X,
  ShieldCheck,
  FolderDown,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  FileCode,
  Check,
} from 'lucide-react';
import type { FileManifest } from '../core/crypto';
import { formatFileSize } from '../utils/formatters';

interface IncomingTransferCardProps {
  manifest: FileManifest;
  onAccept: () => void;
  onDecline: () => void;
  canChooseSaveLocation: boolean;
  onChooseSaveLocation: () => Promise<void>;
}

function getFileTypeInfo(fileName: string, mimeType?: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType?.toLowerCase() || '';

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return {
      Icon: ImageIcon,
      style: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
      badgeStyle: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'wmv'].includes(ext)) {
    return {
      Icon: Video,
      style: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
      badgeStyle: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    };
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
    return {
      Icon: Music,
      style: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
      badgeStyle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }
  if (
    mime.includes('pdf') ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'epub'].includes(ext)
  ) {
    return {
      Icon: FileText,
      style: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
      badgeStyle: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    };
  }
  if (
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)
  ) {
    return {
      Icon: Archive,
      style: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
      badgeStyle: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    };
  }
  if (
    mime.includes('javascript') ||
    mime.includes('json') ||
    mime.includes('html') ||
    ['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'html', 'css', 'sh', 'sql', 'cpp', 'rs', 'go'].includes(ext)
  ) {
    return {
      Icon: FileCode,
      style: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
      badgeStyle: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    };
  }

  return {
    Icon: FileIcon,
    style: 'bg-accent/15 text-accent border-accent/30',
    badgeStyle: 'bg-accent/10 text-accent',
  };
}

export const IncomingTransferCard: React.FC<IncomingTransferCardProps> = ({
  manifest,
  onAccept,
  onDecline,
  canChooseSaveLocation,
  onChooseSaveLocation,
}) => {
  const { t } = useTranslation();
  const [hasPickedFolder, setHasPickedFolder] = useState(false);
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  const { Icon, style, badgeStyle } = getFileTypeInfo(manifest.fileName, manifest.mimeType);
  const ext = manifest.fileName.split('.').pop()?.toUpperCase() || '';

  const handleFolderPick = async () => {
    setIsPickingFolder(true);
    try {
      await onChooseSaveLocation();
      setHasPickedFolder(true);
    } finally {
      setIsPickingFolder(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:gap-6 rounded-3xl border border-border bg-surface p-5 sm:p-8 text-center shadow-xl backdrop-blur-sm transition-all animate-in fade-in zoom-in-95 duration-200">
      {/* Top Header Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{t('receive.incoming_title')}</span>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary">
          {t('receive.incoming_title')}
        </h3>
        <p className="text-xs sm:text-sm text-text-secondary max-w-sm">
          {t('receive.incoming_desc')}
        </p>
      </div>

      {/* File Preview Card Box */}
      <div className="w-full flex items-center gap-3.5 sm:gap-4.5 rounded-2xl border border-border/80 bg-surface-alt/70 p-3.5 sm:p-4 text-left shadow-xs">
        <div
          className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border ${style}`}
        >
          <Icon size={26} className="sm:w-7 sm:h-7" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm sm:text-base font-bold text-text-primary"
            title={manifest.fileName}
          >
            {manifest.fileName}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
            <span className={`font-bold px-2 py-0.5 rounded-md ${badgeStyle}`}>
              {formatFileSize(manifest.fileSize)}
            </span>
            {ext && (
              <span className="font-semibold text-text-tertiary px-1.5 py-0.5 rounded bg-surface border border-border/50">
                {ext}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* E2EE Security Guarantee Notice */}
      <div className="w-full flex items-start gap-2.5 rounded-2xl border border-border/70 bg-surface-alt/40 p-3 text-left">
        <div className="mt-0.5 shrink-0 text-emerald-500">
          <ShieldCheck size={18} />
        </div>
        <div className="text-[11px] leading-relaxed">
          <p className="font-bold text-text-primary">{t('receive.e2ee_badge')}</p>
          <p className="text-text-tertiary mt-0.5">{t('receive.e2ee_note')}</p>
        </div>
      </div>

      {/* Optional Choose Save Location Button */}
      {canChooseSaveLocation && (
        <button
          type="button"
          onClick={handleFolderPick}
          disabled={isPickingFolder}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-semibold transition-colors cursor-pointer active:scale-98 ${
            hasPickedFolder
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-border bg-surface-alt text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          {hasPickedFolder ? (
            <>
              <Check size={14} className="text-emerald-500" />
              <span>{t('receive.location_selected')}</span>
            </>
          ) : (
            <>
              <FolderDown size={14} className="text-accent" />
              <span>{t('receive.choose_folder')}</span>
            </>
          )}
        </button>
      )}

      {/* Action Buttons: Accept & Decline */}
      <div className="flex w-full flex-col-reverse sm:flex-row items-stretch gap-2.5 pt-1 sm:pt-2">
        <button
          type="button"
          onClick={onDecline}
          className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-2xl border border-border bg-surface-alt px-5 py-3 text-xs sm:text-sm font-bold text-text-secondary hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-all cursor-pointer active:scale-95"
        >
          <X size={16} />
          <span>{t('receive.decline_file')}</span>
        </button>

        <button
          type="button"
          onClick={onAccept}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-accent/25 hover:bg-accent-hover transition-all cursor-pointer active:scale-95"
        >
          <Download size={18} />
          <span>{t('receive.download_file')}</span>
        </button>
      </div>
    </div>
  );
};
