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

export class RoomDO extends DurableObject {
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

    // First connection in room is sender, subsequent is receiver
    let role: 'sender' | 'receiver' = senders.length === 0 ? 'sender' : 'receiver';

    // If receiver reconnected (e.g. page refresh), evict previous receiver socket
    if (role === 'receiver' && receivers.length > 0) {
      for (const oldRecv of receivers) {
        try {
          oldRecv.close(1000, "Replaced by new connection");
        } catch {}
      }
    } else if (role === 'sender' && senders.length > 0 && receivers.length === 0) {
      // If sender refreshed before receiver joined, replace old sender socket
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
    }

    // Set inactivity alarm
    await this.resetAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const meta = ws.deserializeAttachment() as SocketMetadata | null;
    const roomId = meta?.roomId || "default";
    const connections = this.ctx.getWebSockets(roomId);

    await this.resetAlarm();

    if (typeof message === "string") {
      try {
        const _data = JSON.parse(message) as SignalMessage;

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

  private async resetAlarm() {
    // Set alarm for 10 minutes from now
    const TIMEOUT = 10 * 60 * 1000;
    await this.ctx.storage.setAlarm(Date.now() + TIMEOUT);
  }
}
