import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransferStore } from './store';
import { useWebRTC } from './hooks/useWebRTC';
import { useWakeLock } from './hooks/useWakeLock';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { ShareCard } from './components/ShareCard';
import { ProgressBar } from './components/ProgressBar';
import { IncomingTransferCard } from './components/IncomingTransferCard';
import { MobileReceiveAction } from './components/MobileReceiveAction';
import { FeatureHighlights } from './components/FeatureHighlights';
import { ReloadPrompt } from './components/ReloadPrompt';
import { cleanupOPFSTempFiles } from './core/storage';
import { Download, Loader2, FolderDown } from 'lucide-react';

const FallbackModal = lazy(() => import('./components/FallbackModal'));
const TransferHistoryDrawer = lazy(() => import('./components/TransferHistoryDrawer'));
const QRScannerModal = lazy(() => import('./components/QRScannerModal'));

export default function App() {
  const { t } = useTranslation();
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const mode = useTransferStore((s) => s.mode);
  const roomId = useTransferStore((s) => s.roomId);
  const connectionState = useTransferStore((s) => s.connectionState);
  const transferState = useTransferStore((s) => s.transferState);
  const fileManifest = useTransferStore((s) => s.fileManifest);
  const isWaitingForAcceptance = useTransferStore((s) => s.isWaitingForAcceptance);
  const error = useTransferStore((s) => s.error);
  const isFallbackRequired = useTransferStore((s) => s.isFallbackRequired);
  const loadHistory = useTransferStore((s) => s.loadHistory);
  const setError = useTransferStore((s) => s.setError);

  const {
    startSending,
    startReceiving,
    confirmFallback,
    cancelTransfer,
    acceptTransfer,
    rejectTransfer,
    shareUrl,
    chooseSaveLocation,
    canChooseSaveLocation,
  } = useWebRTC();
  const wakeLock = useWakeLock();

  // Load transfer history from IndexedDB and cleanup storage on mount
  useEffect(() => {
    loadHistory();
    cleanupOPFSTempFiles().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadHistory]);

  // Acquire wake lock during active transfer
  useEffect(() => {
    if (transferState === 'sending' || transferState === 'receiving') {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [transferState, wakeLock]);

  const handleSendFile = async (file: File) => {
    try {
      await startSending(file);
    } catch {
      setError('errors.transferFailed');
    }
  };

  const handleScanSuccess = async (scannedRoomId: string, scannedRawKey: Uint8Array) => {
    try {
      await startReceiving(scannedRoomId, scannedRawKey);
    } catch {
      setError('errors.transferFailed');
    }
  };

  const handleReset = () => {
    cancelTransfer();
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const isSenderIdle = mode === 'send' && connectionState === 'idle' && transferState === 'idle';
  const isWaitingForReceiver =
    mode === 'send' && transferState === 'idle' && Boolean(shareUrl);
  const isTransferring =
    transferState === 'sending' || transferState === 'receiving';
  const isCompleted = transferState === 'completed';

  const showDropZone = isSenderIdle;
  const showShareCard = isWaitingForReceiver && Boolean(shareUrl);
  const showProgress = isTransferring || isCompleted;

  // Receiver is reviewing file manifest before accepting
  const showIncomingTransferCard =
    mode === 'receive' &&
    fileManifest !== null &&
    transferState === 'idle' &&
    !error;

  // Receiver waiting state: receiver has joined the room and is waiting for manifest
  const isReceiverWaiting =
    mode === 'receive' &&
    fileManifest === null &&
    transferState === 'idle' &&
    !error;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text-primary">
      <Header />

      <main
        style={{
          paddingLeft: 'max(0.875rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.875rem, env(safe-area-inset-right, 0px))',
        }}
        className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-6 pt-6 pb-12 sm:gap-8 sm:px-4 sm:pt-14 sm:pb-20"
      >
        {/* Hero tagline for Sender */}
        {isSenderIdle && (
          <div className="text-center">
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-0.5 text-[11px] font-bold text-accent sm:mb-3 sm:px-3.5 sm:py-1 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span>{t('app.badge')}</span>
            </div>

            <h1 className="font-extrabold tracking-tight text-text-primary text-2xl sm:text-4xl">
              {t('app.title')}
            </h1>

            <p className="text-sm font-semibold text-text-secondary sm:text-lg">
              {t('app.tagline')}
            </p>

            <p className="mt-1 text-xs text-text-tertiary sm:text-sm max-w-md mx-auto">
              {t('app.description')}
            </p>
          </div>
        )}

        {/* Drop Zone — file selection (Sender only) */}
        {showDropZone && (
          <div className="w-full space-y-4 sm:space-y-6">
            <DropZone onSendFile={handleSendFile} />

            {/* Mobile Receive Action (Only visible on mobile screens) */}
            <MobileReceiveAction onOpenScanner={() => setIsQRScannerOpen(true)} />

            {/* Feature Highlights: Desktop Grid & Compact Mobile Segmented Bar */}
            <FeatureHighlights />
          </div>
        )}

        {/* Share Card — waiting for receiver (Sender only) */}
        {showShareCard && (
          <ShareCard
            shareUrl={shareUrl!}
            roomId={roomId ?? ''}
            isReceiverConnected={connectionState === 'connecting' || connectionState === 'p2p'}
            isWaitingForAcceptance={isWaitingForAcceptance}
          />
        )}

        {/* Incoming Transfer Card — receiver reviewing file before accepting */}
        {showIncomingTransferCard && (
          <IncomingTransferCard
            manifest={fileManifest}
            onAccept={acceptTransfer}
            onDecline={rejectTransfer}
            canChooseSaveLocation={canChooseSaveLocation}
            onChooseSaveLocation={chooseSaveLocation}
          />
        )}

        {/* Receiver waiting/connecting card */}
        {isReceiverWaiting && (
          <div className="flex w-full flex-col items-center gap-4 sm:gap-5 rounded-3xl border border-border bg-surface p-6 sm:p-10 text-center shadow-lg">
            <div className="flex h-13 w-13 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              {connectionState === 'p2p' ? (
                <Download size={28} className="animate-bounce sm:w-8 sm:h-8" />
              ) : (
                <Loader2 size={28} className="animate-spin sm:w-8 sm:h-8" />
              )}
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold text-text-primary">
                {connectionState === 'p2p'
                  ? t('receive.connected_waiting')
                  : t('header.connection.connecting')}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-text-secondary">
                {connectionState === 'p2p'
                  ? t('receive.sender_preparing')
                  : t('receive.establishing')}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3.5 py-1 text-xs font-semibold text-text-secondary">
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionState === 'p2p'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                    : 'bg-blue-500 animate-pulse'
                }`}
              />
              <span>
                {connectionState === 'p2p'
                  ? t('header.connection.p2p')
                  : t('header.connection.connecting')}
              </span>
            </div>

            {canChooseSaveLocation && (
              <button
                type="button"
                onClick={chooseSaveLocation}
                className="mt-1 inline-flex items-center gap-2 rounded-xl border border-border bg-surface-alt px-4 py-2 text-xs font-semibold text-text-primary hover:bg-border transition-colors cursor-pointer active:scale-95"
              >
                <FolderDown size={15} className="text-accent" />
                <span>{t('receive.choose_folder')}</span>
              </button>
            )}
          </div>
        )}

        {/* Progress Bar — active transfer or completed (both Sender and Receiver) */}
        {showProgress && <ProgressBar onCancel={cancelTransfer} onReset={handleReset} />}

        {/* Error display */}
        {error && !isCompleted && (
          <div className="w-full rounded-2xl border border-danger/20 bg-danger-light p-4 text-center text-danger">
            <p className="font-semibold text-sm">{t(error)}</p>
            <button
              onClick={handleReset}
              className="mt-3 rounded-xl bg-danger px-4 py-2 font-semibold text-xs text-white transition-opacity hover:opacity-90"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
        className="border-t border-border/80 bg-surface/40 pt-4 text-center text-xs text-text-tertiary backdrop-blur-sm"
      >
        <p>
          VaultDrop — {t('header.e2ee')} •{' '}
          <a
            href="https://github.com/bishoku/vault-drop"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            GitHub
          </a>
        </p>
      </footer>

      {/* Fallback Modal */}
      {isFallbackRequired && transferState !== 'completed' && (
        <Suspense fallback={null}>
          <FallbackModal
            isOpen={true}
            onConfirm={confirmFallback}
            onCancel={cancelTransfer}
          />
        </Suspense>
      )}

      {/* Transfer History Drawer */}
      <Suspense fallback={null}>
        <TransferHistoryDrawer />
      </Suspense>

      {/* QR Scanner Modal (Mobile receive via in-app camera) */}
      {isQRScannerOpen && (
        <Suspense fallback={null}>
          <QRScannerModal
            isOpen={isQRScannerOpen}
            onClose={() => setIsQRScannerOpen(false)}
            onScanSuccess={handleScanSuccess}
          />
        </Suspense>
      )}

      {/* PWA Update Toast */}
      <ReloadPrompt />
    </div>
  );
}
