export interface RelayConfig {
  signalingUrl: string;
  roomId: string;
  onData: (data: ArrayBuffer) => void;
  onStateChange: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private config: RelayConfig;
  private retries = 0;

  constructor(config: RelayConfig) {
    this.config = config;
    this.connect();
  }

  private connect() {
    this.config.onStateChange('connecting');
    this.ws = new WebSocket(`${this.config.signalingUrl}?roomId=${this.config.roomId}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.retries = 0;
      this.config.onStateChange('connected');
    };

    this.ws.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        this.config.onData(event.data);
      }
    };

    this.ws.onclose = () => {
      this.config.onStateChange('disconnected');
      if (this.retries < 1) {
        this.retries++;
        setTimeout(() => this.connect(), 2000);
      }
    };

    this.ws.onerror = () => {
      this.config.onStateChange('error');
    };
  }

  public sendRelayStart(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'relay-start' }));
    }
  }

  public send(data: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
