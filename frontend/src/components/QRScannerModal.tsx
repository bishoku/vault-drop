import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { parseTransferUrl } from '../core/crypto';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (roomId: string, rawKey: Uint8Array) => void;
}

export function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const { t } = useTranslation();
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'vaultdrop-qr-reader';
  const hasHandledScanRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    hasHandledScanRef.current = false;
    setScannerError(null);
    setIsInitializing(true);

    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(readerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const qrCodeSuccessCallback = (decodedText: string) => {
          if (hasHandledScanRef.current) return;

          const parsed = parseTransferUrl(decodedText);
          if (parsed) {
            hasHandledScanRef.current = true;
            try {
              if (html5QrCode?.isScanning) {
                html5QrCode.stop().catch(() => {});
              }
            } catch {
              // ignore stop errors
            }
            onScanSuccess(parsed.roomId, parsed.rawKey);
            onClose();
          } else {
            setScannerError(t('qr_scanner.invalid_qr'));
          }
        };

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          qrCodeSuccessCallback,
          () => {
            // Frame scan failure (no QR in frame), silent ignore
          }
        );

        setIsInitializing(false);
      } catch (err) {
        console.error('[VaultDrop] Camera initialization error:', err);
        setIsInitializing(false);
        setScannerError(t('qr_scanner.camera_error'));
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, onClose, onScanSuccess, t]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Camera size={18} />
            </div>
            <h3 id="qr-scanner-title" className="text-sm font-bold text-text-primary">
              {t('qr_scanner.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors"
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera View Area */}
        <div className="relative flex flex-col items-center justify-center bg-black p-4 min-h-[320px]">
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 z-10 text-white">
              <RefreshCw size={24} className="animate-spin text-accent" />
              <p className="text-xs font-medium text-text-secondary">
                {t('qr_scanner.camera_starting')}
              </p>
            </div>
          )}

          {/* html5-qrcode target container */}
          <div
            id={readerElementId}
            className="w-full overflow-hidden rounded-2xl [&_video]:rounded-2xl [&_video]:object-cover"
          />

          {/* Scanner frame overlay if scanning */}
          {!scannerError && !isInitializing && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="relative h-56 w-56 rounded-2xl border-2 border-dashed border-accent/80 shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                {/* Corner accents */}
                <span className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-accent rounded-tl" />
                <span className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-accent rounded-tr" />
                <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-accent rounded-bl" />
                <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-accent rounded-br" />
                {/* Subtle animated scanline */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse top-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-3 text-center text-xs font-medium text-white/80 drop-shadow-md">
                {t('qr_scanner.align_frame')}
              </p>
            </div>
          )}

          {/* Error Message */}
          {scannerError && (
            <div className="absolute inset-x-4 top-4 z-20 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 backdrop-blur-md">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold">{scannerError}</p>
                <p className="mt-0.5 text-[11px] text-red-300/80">
                  {t('qr_scanner.permission_hint')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface flex justify-end">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-border bg-surface-raised py-2.5 text-xs font-semibold text-text-primary hover:bg-border/50 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRScannerModal;
