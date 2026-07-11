import type { RuntimeConfig } from "./runtimeConfig";

const STORAGE_KEY = "aist-client-performance-traces";
const MAX_LOCAL_TRACES = 200;

export interface ClientPerformanceTrace {
  id: string;
  traceId: string;
  source: "device";
  phase: string;
  route: string;
  method: string;
  status: "ok" | "error";
  statusCode?: number;
  durationMs: number;
  requestBytes?: number;
  responseBytes?: number;
  errorCategory?: string;
  errorMessage?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  createdAt: string;
}

export function createClientTraceId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `trace_${random}`;
}

export function recordClientPerformanceTrace(trace: ClientPerformanceTrace): void {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ClientPerformanceTrace[];
    const next = [trace, ...existing].slice(0, MAX_LOCAL_TRACES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Latency logging must never break the user's request path.
  }
}

export function submitClientPerformanceTrace(
  config: RuntimeConfig,
  trace: ClientPerformanceTrace,
  authHeader?: string,
): void {
  const base = config.apiBaseUrl.replace(/\/+$/, "");
  const body = JSON.stringify(trace);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-AIST-Trace-Id": trace.traceId,
    "X-AIST-CSRF": "1",
  };
  if (authHeader) headers.Authorization = authHeader;
  void fetch(`${base}/telemetry/client`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers,
    body,
  }).catch(() => undefined);
}

export function clientNetworkMetadata(): ClientPerformanceTrace["metadata"] {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  };
  return {
    visibilityState: document.visibilityState,
    online: navigator.onLine,
    connectionType: nav.connection?.effectiveType,
    downlinkMbps: nav.connection?.downlink,
    rttMs: nav.connection?.rtt,
    saveData: nav.connection?.saveData,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGb: nav.deviceMemory,
    appVersion: typeof __COMMIT_HASH__ === "string" ? __COMMIT_HASH__ : undefined,
  };
}

/**
 * Adds a coarse, controlled cause hint without recording page content, user
 * input, URLs, or secrets. Correlated server/database/AI traces with the same
 * trace id remain the authoritative source when a request is slow.
 */
export function clientTimingMetadata(durationMs: number): ClientPerformanceTrace["metadata"] {
  const metadata = clientNetworkMetadata() ?? {};
  const connectionType = typeof metadata.connectionType === "string" ? metadata.connectionType : undefined;
  const rttMs = typeof metadata.rttMs === "number" ? metadata.rttMs : undefined;
  let causeHint: string | undefined;
  if (metadata.online === false) causeHint = "offline";
  else if (connectionType === "slow-2g" || connectionType === "2g" || (rttMs !== undefined && rttMs >= 300)) {
    causeHint = "network_quality";
  } else if (durationMs >= 1_000) {
    causeHint = "server_or_network";
  }
  return { ...metadata, causeHint };
}

export function bodyByteLength(body: BodyInit | null | undefined): number | undefined {
  if (typeof body === "string") return new TextEncoder().encode(body).byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength;
  return undefined;
}

export function traceErrorCategory(error: unknown, statusCode?: number): string | undefined {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("failed to fetch") || message.includes("network")) return "network";
  if (message.includes("timeout") || message.includes("abort")) return "aborted";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode && statusCode >= 500) return "server";
  if (statusCode && statusCode >= 400) return "client";
  return error ? "unknown" : undefined;
}

export function sanitizeClientError(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  if (!message) return undefined;
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-or-v1-[A-Za-z0-9]+/gi, "[redacted-openrouter-key]")
    .slice(0, 500);
}
