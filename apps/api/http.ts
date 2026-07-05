import type { IncomingMessage, ServerResponse } from "node:http";

export interface JsonRequest<T = unknown> {
  body: T;
  remoteKey: string;
}

export function sendJson(response: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body, null, 2));
}

export async function readJsonBody<T = unknown>(request: IncomingMessage, limitBytes = 2_000_000): Promise<JsonRequest<T>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limitBytes) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const body = raw.trim() ? JSON.parse(raw) as T : {} as T;
  const remoteKey = `${request.socket.remoteAddress ?? "local"}:${request.headers["user-agent"] ?? "unknown"}`;
  return { body, remoteKey };
}

export function bearerToken(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1];
}

export function routePath(request: IncomingMessage): { url: URL; pathname: string; segments: string[] } {
  const url = new URL(request.url ?? "/", "http://local");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  return {
    url,
    pathname,
    segments: pathname.split("/").filter(Boolean).map(decodeURIComponent),
  };
}
