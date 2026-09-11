import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Shield, Eye, ArrowRight } from 'lucide-react';

interface FallbackModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FallbackModal: React.FC<FallbackModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="m-auto rounded-2xl bg-transparent p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left">
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-light text-warning">
            <AlertTriangle size={24} />
          </div>

          <h2 className="mb-1.5 text-xl font-bold text-text-primary">
            {t('fallback.title')}
          </h2>

          <p className="mb-5 text-sm text-text-secondary leading-relaxed">
            {t('fallback.description')}
          </p>

          <div className="space-y-3 rounded-xl border border-border bg-surface-alt p-4">
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
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-text shadow-sm transition-all hover:bg-accent-hover active:scale-95"
          >
            <span>{t('fallback.confirm')}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
};
