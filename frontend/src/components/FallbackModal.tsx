import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Shield, Eye, ArrowRight, HardDrive, Ban } from 'lucide-react';
import { useTransferStore } from '../store';
import { MAX_RELAY_FILE_SIZE } from '../core/crypto';
import { formatFileSize } from '../utils/formatters';

interface FallbackModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FallbackModal: React.FC<FallbackModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const file = useTransferStore((s) => s.file);
  const fileManifest = useTransferStore((s) => s.fileManifest);

  const currentFileSize = file?.size ?? fileManifest?.fileSize ?? 0;
  const isSizeLimitExceeded = currentFileSize > MAX_RELAY_FILE_SIZE;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="fallback-modal-title"
      onClose={onCancel}
      style={{
        maxWidth: 'calc(100vw - max(2rem, env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px)))',
      }}
      className="m-auto w-full max-w-md rounded-3xl bg-transparent p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-border bg-surface text-left">
        <div className="p-5 sm:p-6">
          <div
            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
              isSizeLimitExceeded ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning'
            }`}
          >
            {isSizeLimitExceeded ? <Ban size={24} /> : <AlertTriangle size={24} />}
          </div>

          <h2 id="fallback-modal-title" className="mb-1.5 text-lg sm:text-xl font-bold text-text-primary">
            {t('fallback.title')}
          </h2>

          <p className="mb-5 text-sm text-text-secondary leading-relaxed">
            {isSizeLimitExceeded
              ? t('fallback.limit_exceeded_desc', {
                  fileSize: formatFileSize(currentFileSize),
                  maxSize: formatFileSize(MAX_RELAY_FILE_SIZE),
                })
              : t('fallback.description')}
          </p>

          <div className="space-y-3 rounded-xl border border-border bg-surface-alt p-4">
            <div className="flex items-start gap-3">
              <HardDrive
                size={18}
                className={`mt-0.5 shrink-0 ${isSizeLimitExceeded ? 'text-danger' : 'text-accent'}`}
              />
              <p className="text-xs text-text-secondary leading-normal">
                <strong className="block font-semibold text-text-primary">
                  {t('fallback.size_limit_title')}
                </strong>
                {t('fallback.size_limit_note', { maxSize: formatFileSize(MAX_RELAY_FILE_SIZE) })}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Shield size={18} className="mt-0.5 shrink-0 text-success" />
              <p className="text-xs text-text-secondary leading-normal">
                <strong className="block font-semibold text-text-primary">
                  {t('fallback.security_title')}
                </strong>
                {t('fallback.security')}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Eye size={18} className="mt-0.5 shrink-0 text-warning" />
              <p className="text-xs text-text-secondary leading-normal">
                <strong className="block font-semibold text-text-primary">
                  {t('fallback.privacy_title')}
                </strong>
                {t('fallback.metadata')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-surface-alt/50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary cursor-pointer"
          >
            {isSizeLimitExceeded ? t('common.close') : t('common.cancel')}
          </button>
          {!isSizeLimitExceeded && (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-text shadow-sm transition-all hover:bg-accent-hover active:scale-95 cursor-pointer"
            >
              <span>{t('fallback.confirm')}</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default FallbackModal;
