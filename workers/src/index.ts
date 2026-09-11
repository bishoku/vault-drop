import { RoomDO, Env } from "./RoomDO";

export { RoomDO };

const ALLOWED_ORIGINS = [
  "https://bishoku.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isOriginAllowed(origin) ? origin! : "https://bishoku.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Upgrade",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check endpoint (open for monitoring)
    if (pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", timestamp: Date.now() }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const roomMatch = pathname.match(/^\/api\/room\/([a-zA-Z0-9_-]+)\/ws$/);
    if (roomMatch) {
      // Protect WebSocket endpoint against unauthorized origins
      if (!isOriginAllowed(origin)) {
        return new Response("Forbidden: Unauthorized Origin", {
          status: 403,
          headers: corsHeaders,
        });
      }

      const roomId = roomMatch[1];
      const id = env.ROOM.idFromName(roomId);
      const roomObject = env.ROOM.get(id);

      return roomObject.fetch(request);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
