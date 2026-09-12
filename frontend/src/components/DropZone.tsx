import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, File as FileIcon, X, ArrowRight, FolderPlus } from 'lucide-react';
import { formatFileSize } from '../utils/formatters';
export { formatFileSize };
interface DropZoneProps {
  onSendFile: (file: File) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onSendFile }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      if (f) setSelectedFile(f);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      if (f) setSelectedFile(f);
    }
  };

  const handleContainerClick = () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-border bg-surface p-4 sm:p-10 shadow-lg shadow-slate-900/5 transition-all duration-200 ${
          isDragging
            ? 'scale-[1.01] ring-4 ring-accent/20 border-accent'
            : 'hover:shadow-xl hover:shadow-slate-900/10 hover:border-accent/40'
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleContainerClick}
      >
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        {!selectedFile ? (
          <div
            className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed py-8 px-4 sm:py-12 sm:px-6 text-center transition-all duration-200 ${
              isDragging
                ? 'border-accent bg-accent/5'
                : 'border-slate-300 dark:border-slate-700 bg-surface-alt/40 group-hover:border-accent/60 group-hover:bg-accent/5'
            }`}
          >
            <div className="mb-4 sm:mb-5 flex h-13 w-13 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/30 transition-transform duration-200 group-hover:scale-110">
              <Upload size={26} className="sm:w-[30px] sm:h-[30px]" strokeWidth={2.2} />
            </div>

            <h3 className="mb-1.5 sm:mb-2 text-lg sm:text-xl font-bold text-text-primary tracking-tight">
              <span className="hidden sm:inline">{t('dropzone.title')}</span>
              <span className="inline sm:hidden">{t('dropzone.title_mobile')}</span>
            </h3>

            <p className="mb-4 sm:mb-5 text-xs sm:text-sm font-medium text-text-secondary">
              <span className="hidden sm:inline">{t('dropzone.subtitle')}</span>
              <span className="inline sm:hidden">{t('dropzone.subtitle_mobile')}</span>
            </p>

            <div className="flex items-center gap-2 rounded-xl bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-accent shadow-xs border border-border group-active:scale-95 transition-transform">
              <FolderPlus size={16} />
              <span className="hidden sm:inline">{t('dropzone.browse')}</span>
              <span className="inline sm:hidden">{t('dropzone.browse_mobile')}</span>
            </div>

            <span className="mt-4 sm:mt-5 text-[11px] sm:text-xs text-text-tertiary">
              <span className="hidden sm:inline">{t('dropzone.hint')}</span>
              <span className="inline sm:hidden">{t('dropzone.hint_mobile')}</span>
            </span>
          </div>
        ) : (
          <div
            className="flex w-full items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border bg-surface-alt p-3.5 sm:p-5 shadow-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <FileIcon size={24} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-text-primary text-sm sm:text-base">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] sm:text-xs font-medium text-text-secondary mt-0.5">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedFile(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface hover:text-danger"
              title={t('dropzone.change')}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {selectedFile && (
        <button
          onClick={() => onSendFile(selectedFile)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 sm:py-4 text-sm sm:text-base font-bold text-white shadow-lg shadow-accent/25 transition-all duration-200 hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/35 active:scale-[0.99]"
        >
          <span>{t('dropzone.send_file')}</span>
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
};
