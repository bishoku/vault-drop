import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOM: DurableObjectNamespace;
}

interface SocketMetadata {
  role: 'sender' | 'receiver';
  roomId: string;
}

interface SignalMessage {
  type: string;
  payload?: unknown;
  message?: string;
}

// Maximum allowed file size for WebSocket Relay Fallback: 10 MB (+ 128 KB allowance for AES-GCM tags, IVs, manifest & trailer)
const MAX_RELAY_WIRE_BYTES = 10 * 1024 * 1024 + 128 * 1024;
const ALARM_THROTTLE_MS = 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export class RoomDO extends DurableObject {
  private lastAlarmReset = 0;
  private relayedBytes = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const url = new URL(request.url);
    const roomMatch = url.pathname.match(/^\/api\/room\/([a-zA-Z0-9_-]+)\/ws$/);
    const roomId = roomMatch ? roomMatch[1] : "default";
    const requestedRole = url.searchParams.get("role");

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Filter active sockets (OPEN: 1, CONNECTING: 0)
    const allSockets = this.ctx.getWebSockets(roomId);
    const activeConnections = allSockets.filter((ws) => {
      try {
        return ws.readyState === 0 || ws.readyState === 1;
      } catch {
        return false;
      }
    });

    const senders = activeConnections.filter((ws) => {
      const meta = ws.deserializeAttachment() as SocketMetadata | null;
      return meta?.role === 'sender';
    });

    const receivers = activeConnections.filter((ws) => {
      const meta = ws.deserializeAttachment() as SocketMetadata | null;
      return meta?.role === 'receiver';
    });

    // Determine role from explicit query param or fallback to connection order
    let role: 'sender' | 'receiver';
    if (requestedRole === 'sender' || requestedRole === 'receiver') {
      role = requestedRole;
    } else {
      role = senders.length === 0 ? 'sender' : 'receiver';
    }

    // Handle reconnections or full room
    if (role === 'receiver' && receivers.length > 0) {
      for (const oldRecv of receivers) {
        try {
          oldRecv.close(1000, "Replaced by new connection");
        } catch {}
      }
    } else if (role === 'sender' && senders.length > 0) {
      for (const oldSend of senders) {
        try {
          oldSend.close(1000, "Replaced by new connection");
        } catch {}
      }
    } else if (activeConnections.length >= 2) {
      // Third distinct connection attempt rejected
      this.ctx.acceptWebSocket(server, [roomId]);
      server.close(4001, "Room is full");
      return new Response(null, { status: 101, webSocket: client });
    }

    if (role === 'sender') {
      this.relayedBytes = 0;
    }

    this.ctx.acceptWebSocket(server, [roomId]);
    server.serializeAttachment({ role, roomId } as SocketMetadata);

    if (role === 'receiver') {
      // Notify sender that receiver has joined
      for (const ws of this.ctx.getWebSockets(roomId)) {
        const meta = ws.deserializeAttachment() as SocketMetadata | null;
        if (meta?.role === 'sender' && (ws.readyState === 0 || ws.readyState === 1)) {
          try {
            ws.send(JSON.stringify({ type: 'peer-joined' }));
          } catch {}
        }
      }
    } else if (role === 'sender' && receivers.length > 0) {
      // If receiver was already waiting in the room when sender (re)connected, notify sender immediately
      try {
        server.send(JSON.stringify({ type: 'peer-joined' }));
      } catch {}
    }

    // Set inactivity alarm (forced on initial join)
    await this.resetAlarm(true);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const meta = ws.deserializeAttachment() as SocketMetadata | null;
    const roomId = meta?.roomId || "default";
    const connections = this.ctx.getWebSockets(roomId);

    // Throttled alarm update to avoid Durable Object storage write exhaustion on binary streams
    await this.resetAlarm(false);

    if (typeof message === "string") {
      try {
        const data = JSON.parse(message) as SignalMessage;
        if (data.type === 'relay-start') {
          this.relayedBytes = 0;
        }

        // Broadcast text signal to the other peer
        for (const other of connections) {
          if (other !== ws && (other.readyState === 0 || other.readyState === 1)) {
            other.send(message);
          }
        }
      } catch (_err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
      }
    } else {
      // Enforce strict 10 MB limit in WebSocket binary relay mode
      this.relayedBytes += message.byteLength;
      if (this.relayedBytes > MAX_RELAY_WIRE_BYTES) {
        const errPayload = JSON.stringify({
          type: 'error',
          message: 'errors.relaySizeLimitExceeded',
        });
        for (const sock of connections) {
          if (sock.readyState === 0 || sock.readyState === 1) {
            try {
              sock.send(errPayload);
            } catch {}
          }
        }
        return;
      }

      // Binary relay mode - zero-copy pass-through
      for (const other of connections) {
        if (other !== ws && (other.readyState === 0 || other.readyState === 1)) {
          other.send(message);
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    this.handleDisconnect(ws);
  }

  private handleDisconnect(ws: WebSocket) {
    const meta = ws.deserializeAttachment() as SocketMetadata | null;
    if (!meta) return;

    const roomId = meta.roomId;
    const connections = this.ctx.getWebSockets(roomId);
    for (const other of connections) {
      if (other !== ws && (other.readyState === 0 || other.readyState === 1)) {
        try {
          other.send(JSON.stringify({ type: 'peer-left' }));
        } catch (_e) {
          // Ignore send errors on disconnect
        }
      }
    }
  }

  async alarm(): Promise<void> {
    // 10 minutes of inactivity - close all sockets
    const connections = this.ctx.getWebSockets();
    for (const ws of connections) {
      try {
        ws.close(1000, "Inactivity timeout");
      } catch {}
    }
  }

  private async resetAlarm(force = false) {
    const now = Date.now();
    if (!force && now - this.lastAlarmReset < ALARM_THROTTLE_MS) {
      return;
    }
    this.lastAlarmReset = now;
    await this.ctx.storage.setAlarm(now + INACTIVITY_TIMEOUT_MS);
  }
}
