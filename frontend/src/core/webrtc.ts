export interface WebRTCConfig {
  onSignal: (signal: SignalMessage) => void;
  onData: (data: ArrayBuffer) => void;
  onMessage?: (message: string) => void;
  onStateChange: (state: ConnectionState) => void;
  onChannelReady: () => void;
  onBackpressure?: (isPaused: boolean) => void;
}

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'failed' | 'closed';

export interface SignalMessage {
  type: 'offer' | 'answer' | 'candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

const HIGH_WATERMARK = 2 * 1024 * 1024; // 2 MB: pause worker chunk production
const LOW_WATERMARK = 512 * 1024;       // 512 KB: resume worker chunk production

export class PeerManager {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private config: WebRTCConfig;
  private checkInterval: number = 0;
  private isChannelReadyFired = false;
  private isBackpressurePaused = false;

  constructor(config: WebRTCConfig) {
    this.config = config;
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.config.onSignal({
          type: 'candidate',
          payload: event.candidate.toJSON(),
        });
      }
    };

    let checkingStartTime: number | null = null;

    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc.iceConnectionState;
      console.log('[PeerManager] ICE connection state:', iceState);

      if (iceState === 'checking') {
        checkingStartTime = Date.now();
        if (!this.checkInterval) {
          this.checkInterval = window.setInterval(() => {
            if (this.pc.iceConnectionState === 'checking' && Date.now() - (checkingStartTime || 0) > 8000) {
              console.warn('[PeerManager] ICE checking timeout (8s)');
              this.config.onStateChange('failed');
              this.close();
            }
          }, 1000);
        }
      } else {
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = 0;
        }
      }

      if (iceState === 'failed') {
        this.config.onStateChange('failed');
      } else if (iceState === 'connected' || iceState === 'completed') {
        this.config.onStateChange('connected');
      } else if (iceState === 'closed') {
        this.config.onStateChange('closed');
      } else if (iceState === 'new' || iceState === 'checking') {
        this.config.onStateChange('connecting');
      }
    };

    this.pc.onconnectionstatechange = () => {
      const connState = this.pc.connectionState;
      console.log('[PeerManager] PeerConnection state:', connState);
      if (connState === 'connected') {
        this.config.onStateChange('connected');
      } else if (connState === 'failed') {
        this.config.onStateChange('failed');
      } else if (connState === 'closed') {
        this.config.onStateChange('closed');
      }
    };

    this.pc.ondatachannel = (event) => {
      console.log('[PeerManager] ondatachannel event received, channel readyState:', event.channel.readyState);
      this.dc = event.channel;
      this.setupDataChannel();
    };
  }

  public async createOffer(): Promise<void> {
    console.log('[PeerManager] Creating offer DataChannel...');
    this.dc = this.pc.createDataChannel('transfer', { ordered: true });
    this.setupDataChannel();

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.config.onSignal({
      type: 'offer',
      payload: offer,
    });
  }

  public async handleSignal(signal: SignalMessage): Promise<void> {
    if (signal.type === 'offer') {
      console.log('[PeerManager] Handling remote offer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.config.onSignal({
        type: 'answer',
        payload: answer,
      });
    } else if (signal.type === 'answer') {
      console.log('[PeerManager] Handling remote answer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
    } else if (signal.type === 'candidate') {
      await this.pc.addIceCandidate(new RTCIceCandidate(signal.payload as RTCIceCandidateInit));
    }
  }

  private triggerChannelReady() {
    if (this.isChannelReadyFired) return;
    this.isChannelReadyFired = true;
    console.log('[PeerManager] DataChannel is OPEN and ready for transfer');
    this.config.onChannelReady();
  }

  private setupDataChannel() {
    if (!this.dc) return;
    this.dc.binaryType = 'arraybuffer';
    this.dc.bufferedAmountLowThreshold = LOW_WATERMARK;

    this.dc.onopen = () => {
      console.log('[PeerManager] DataChannel onopen event fired');
      this.triggerChannelReady();
    };

    if (this.dc.readyState === 'open') {
      console.log('[PeerManager] DataChannel already open at setup');
      queueMicrotask(() => this.triggerChannelReady());
    }

    this.dc.onclose = () => {
      console.log('[PeerManager] DataChannel onclose event fired');
    };

    this.dc.onerror = (err) => {
      console.error('[PeerManager] DataChannel error:', err);
    };

    this.dc.onbufferedamountlow = () => {
      if (this.isBackpressurePaused) {
        this.isBackpressurePaused = false;
        this.config.onBackpressure?.(false);
      }
    };

    this.dc.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        this.config.onMessage?.(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.config.onData(event.data);
      } else if (event.data instanceof Blob) {
        const buffer = await event.data.arrayBuffer();
        this.config.onData(buffer);
      }
    };
  }

  public send(data: ArrayBuffer): void {
    if (!this.dc || this.dc.readyState !== 'open') {
      console.warn('[PeerManager] Cannot send, DataChannel not open, readyState:', this.dc?.readyState);
      return;
    }

    this.dc.send(data);

    // Apply hardware backpressure if buffer exceeds high watermark
    if (this.dc.bufferedAmount > HIGH_WATERMARK && !this.isBackpressurePaused) {
      this.isBackpressurePaused = true;
      this.config.onBackpressure?.(true);
    }
  }

  public sendText(text: string): void {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(text);
    } else {
      console.warn('[PeerManager] Cannot sendText, DataChannel not open, readyState:', this.dc?.readyState);
    }
  }

  public getBufferedAmount(): number {
    return this.dc ? this.dc.bufferedAmount : 0;
  }

  public close(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
      this.dc = null;
    }
    try {
      this.pc.close();
    } catch {}
    this.config.onStateChange('closed');
  }
}
