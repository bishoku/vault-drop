import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clipboard, Share, Loader2, Check } from 'lucide-react';
import QRCode from 'qrcode';

interface ShareCardProps {
  shareUrl: string;
  roomId: string;
  isReceiverConnected: boolean;
  isWaitingForAcceptance?: boolean;
}

export const ShareCard: React.FC<ShareCardProps> = ({
  shareUrl,
  roomId: _roomId,
  isReceiverConnected,
  isWaitingForAcceptance,
}) => {
  const { t } = useTranslation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Error generating QR code', err));
    }
  }, [shareUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VaultDrop',
          text: t('share.description'),
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:gap-6 rounded-3xl border border-border bg-surface p-4 sm:p-8 shadow-md">
      <div className="text-center">
        <h3 className="text-lg sm:text-xl font-bold text-text-primary">
          {t('share.title')}
        </h3>
        <p className="mt-1 text-xs text-text-secondary sm:text-sm max-w-sm">
          {t('share.description')}
        </p>
      </div>

      {qrCodeUrl && (
        <div className="rounded-2xl border border-border bg-white p-2.5 sm:p-3 shadow-xs">
          <img src={qrCodeUrl} alt="QR Code" className="h-40 w-40 rounded-xl sm:h-48 sm:w-48" />
        </div>
      )}

      <div className="w-full space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 min-w-0 overflow-hidden rounded-xl border border-border bg-surface-alt p-3 font-mono text-xs text-text-primary">
            <p className="truncate">{shareUrl}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-initial flex h-10 sm:h-11 items-center justify-center gap-1.5 rounded-xl bg-surface-hover px-4 font-semibold text-text-primary text-xs sm:text-sm transition-colors hover:bg-border active:scale-95"
              title={t('share.copy_link')}
            >
              {copied ? (
                <>
                  <Check size={16} className="text-success" />
                  <span className="text-success">{t('share.copied')}</span>
                </>
              ) : (
                <>
                  <Clipboard size={16} />
                  <span>{t('share.copy_link')}</span>
                </>
              )}
            </button>

            {typeof navigator.share !== 'undefined' && (
              <button
                onClick={handleNativeShare}
                className="flex-1 sm:flex-initial flex h-10 sm:h-11 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-accent-text font-semibold text-xs sm:text-sm transition-all hover:bg-accent-hover active:scale-95"
                title={t('share.native_share')}
              >
                <Share size={16} />
                <span className="sm:hidden">{t('share.native_share')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center gap-2 border-t border-border pt-4">
        {isWaitingForAcceptance ? (
          <>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Loader2 size={14} className="animate-spin" />
            </div>
            <span className="font-semibold text-amber-600 dark:text-amber-400 text-sm">
              {t('share.receiver_waiting_approval')}
            </span>
          </>
        ) : isReceiverConnected ? (
          <>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-light text-success">
              <Check size={14} />
            </div>
            <span className="font-semibold text-success text-sm">
              {t('share.receiver_connected')}
            </span>
          </>
        ) : (
          <>
            <Loader2 size={18} className="animate-spin text-accent" />
            <span className="font-medium text-text-secondary text-sm">
              {t('share.waiting_receiver')}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
