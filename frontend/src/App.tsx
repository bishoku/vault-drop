import { useTranslation } from 'react-i18next';
import { useTransferStore } from './store';
import { useWebRTC } from './hooks/useWebRTC';
import { useWakeLock } from './hooks/useWakeLock';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { ShareCard } from './components/ShareCard';
import { ProgressBar } from './components/ProgressBar';
import { FallbackModal } from './components/FallbackModal';
import { ReloadPrompt } from './components/ReloadPrompt';
import { Zap, ShieldCheck, HardDrive, Download, Loader2, FolderDown } from 'lucide-react';
import { useEffect } from 'react';

export default function App() {
  const { t } = useTranslation();
  const store = useTransferStore();
  const {
    startSending,
    confirmFallback,
    cancelTransfer,
    shareUrl,
    chooseSaveLocation,
    canChooseSaveLocation,
  } = useWebRTC();
  const wakeLock = useWakeLock();

  // Acquire wake lock during active transfer
  useEffect(() => {
    if (store.transferState === 'sending' || store.transferState === 'receiving') {
      wakeLock.request();
    } else {
      wakeLock.release();
    }
  }, [store.transferState, wakeLock]);

  const handleSendFile = async (file: File) => {
    try {
      await startSending(file);
    } catch {
      store.setError('errors.transferFailed');
    }
  };

  const handleReset = () => {
    cancelTransfer();
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const isSenderIdle = store.mode === 'send' && store.connectionState === 'idle' && store.transferState === 'idle';
  const isWaitingForReceiver =
    store.mode === 'send' && (store.connectionState === 'waiting' || store.connectionState === 'connecting');
  const isTransferring =
    store.transferState === 'sending' || store.transferState === 'receiving';
  const isCompleted = store.transferState === 'completed';

  const showDropZone = isSenderIdle;
  const showShareCard = isWaitingForReceiver && shareUrl;
  const showProgress = isTransferring || isCompleted;

  // Receiver waiting state: receiver has joined the room and is waiting for transfer to start
  const isReceiverWaiting =
    store.mode === 'receive' &&
    store.transferState === 'idle' &&
    !store.error;

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text-primary">
      <Header />

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-8 px-4 pt-10 pb-16 sm:pt-14 sm:pb-20">
        {/* Hero tagline for Sender */}
        {isSenderIdle && (
          <div className="text-center">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1 text-xs font-bold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span>{t('app.badge')}</span>
            </div>

            <h1 className="mb-3 text-4xl font-black tracking-tight text-text-primary sm:text-5xl">
              VaultDrop
            </h1>

            <p className="text-base font-semibold text-text-secondary sm:text-lg">
              {t('app.tagline')}
            </p>

            <p className="mt-1 text-xs text-text-tertiary sm:text-sm">
              {t('app.description')}
            </p>
          </div>
        )}

        {/* Drop Zone — file selection (Sender only) */}
        {showDropZone && (
          <div className="w-full space-y-6">
            <DropZone onSendFile={handleSendFile} />

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/70 p-3.5 backdrop-blur-sm shadow-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Zap size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary">{t('features.p2p_title')}</p>
                  <p className="text-[11px] text-text-tertiary truncate">{t('features.p2p_desc')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/70 p-3.5 backdrop-blur-sm shadow-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <ShieldCheck size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary">{t('features.crypto_title')}</p>
                  <p className="text-[11px] text-text-tertiary truncate">{t('features.crypto_desc')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface/70 p-3.5 backdrop-blur-sm shadow-xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                  <HardDrive size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary">{t('features.stream_title')}</p>
                  <p className="text-[11px] text-text-tertiary truncate">{t('features.stream_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Card — waiting for receiver (Sender only) */}
        {showShareCard && (
          <ShareCard
            shareUrl={shareUrl}
            roomId={store.roomId ?? ''}
            isReceiverConnected={
              store.connectionState === 'connecting' || store.connectionState === 'p2p'
            }
          />
        )}

        {/* Receiver waiting/connecting card */}
        {isReceiverWaiting && (
          <div className="flex w-full flex-col items-center gap-5 rounded-3xl border border-border bg-surface p-10 text-center shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              {store.connectionState === 'p2p' ? (
                <Download size={32} className="animate-bounce" />
              ) : (
                <Loader2 size={32} className="animate-spin" />
              )}
            </div>

            <div>
              <h3 className="text-xl font-bold text-text-primary">
                {store.connectionState === 'p2p'
                  ? t('receive.connected_waiting')
                  : t('header.connection.connecting')}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {store.connectionState === 'p2p'
                  ? t('receive.sender_preparing')
                  : t('receive.establishing')}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3.5 py-1 text-xs font-semibold text-text-secondary">
              <span
                className={`h-2 w-2 rounded-full ${
                  store.connectionState === 'p2p'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                    : 'bg-blue-500 animate-pulse'
                }`}
              />
              <span>
                {store.connectionState === 'p2p'
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
        {store.error && !isCompleted && (
          <div className="w-full rounded-2xl border border-danger/20 bg-danger-light p-4 text-center text-danger">
            <p className="font-semibold text-sm">{t(store.error)}</p>
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
      <footer className="border-t border-border/80 bg-surface/40 py-4 text-center text-xs text-text-tertiary backdrop-blur-sm">
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
      <FallbackModal
        isOpen={store.isFallbackRequired}
        onConfirm={confirmFallback}
        onCancel={cancelTransfer}
      />

      {/* PWA Update Toast */}
      <ReloadPrompt />
    </div>
  );
}
