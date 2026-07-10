import type { LocalDbData, PerformanceTraceRecord, PerformanceTraceSource } from "./apiTypes";
import { createId, nowIso } from "./ids";

export const MAX_PERFORMANCE_TRACES = 2_000;

type TraceMetadata = Record<string, string | number | boolean | undefined>;

export interface PerformanceTraceInput {
  traceId: string;
  parentTraceId?: string;
  source: PerformanceTraceSource;
  phase: string;
  route?: string;
  method?: string;
  userId?: string;
  adventureId?: string;
  providerName?: string;
  model?: string;
  status?: PerformanceTraceRecord["status"];
  statusCode?: number;
  durationMs: number;
  requestBytes?: number;
  responseBytes?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  throttleWaitMs?: number;
  retryCount?: number;
  error?: unknown;
  errorCategory?: string;
  errorMessage?: string;
  metadata?: TraceMetadata;
}

export function createTraceId(prefix = "trace"): string {
  return createId(prefix);
}

export function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export function performanceTrace(input: PerformanceTraceInput): PerformanceTraceRecord {
  const errorMessage = sanitizeErrorMessage(input.errorMessage ?? input.error);
  const errorCategory = input.errorCategory ?? errorCategoryFor(input.error, input.statusCode, errorMessage);
  return {
    id: createId("perf"),
    traceId: input.traceId,
    parentTraceId: input.parentTraceId,
    source: input.source,
    phase: input.phase,
    route: input.route,
    method: input.method,
    userId: input.userId,
    adventureId: input.adventureId,
    providerName: input.providerName,
    model: input.model,
    status: input.status ?? (input.error || (input.statusCode !== undefined && input.statusCode >= 400) ? "error" : "ok"),
    statusCode: input.statusCode,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    requestBytes: input.requestBytes,
    responseBytes: input.responseBytes,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens,
    cacheReadTokens: input.cacheReadTokens,
    cacheCreationTokens: input.cacheCreationTokens,
    throttleWaitMs: input.throttleWaitMs,
    retryCount: input.retryCount,
    errorCategory,
    errorMessage,
    metadata: sanitizeMetadata(input.metadata),
    createdAt: nowIso(),
  };
}

export function appendPerformanceTrace(data: LocalDbData, trace: PerformanceTraceRecord): void {
  data.performanceTraces.push(trace);
  if (data.performanceTraces.length <= MAX_PERFORMANCE_TRACES) return;
  data.performanceTraces = data.performanceTraces
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_PERFORMANCE_TRACES);
}

export function sanitizeErrorMessage(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : undefined;
  if (!message) return undefined;
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:api[_-]?key|token|password|client[_-]?secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\b(?:postgres|postgresql):\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/sk-or-v1-[A-Za-z0-9]+/gi, "[redacted-openrouter-key]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/gi, "[redacted-provider-key]")
    .replace(/https:\/\/openrouter\.ai\/workspaces\/[^\s"')]+\/keys\/[A-Za-z0-9]+/gi, "the OpenRouter key settings page")
    .replace(/\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[\s\S]*/gi, "[redacted-sql]")
    .slice(0, 500);
}

export function errorCategoryFor(error: unknown, statusCode?: number, sanitizedMessage?: string): string | undefined {
  const message = (sanitizedMessage ?? sanitizeErrorMessage(error) ?? "").toLowerCase();
  if (!message && !statusCode) return undefined;
  if (message.includes("key limit exceeded")) return "provider_key_limit";
  if (message.includes("rate limit")) return "provider_rate_limit";
  if (message.includes("missing api key") || message.includes("provider api key")) return "provider_key_missing";
  if (message.includes("data policy") || message.includes("data collection") || message.includes("zero data retention") || message.includes("zdr")) return "provider_data_policy";
  if (message.includes("policy")) return "policy_block";
  if (message.includes("network error") || message.includes("fetch failed")) return "network";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode && statusCode >= 500) return "server";
  if (statusCode && statusCode >= 400) return "client";
  return "unknown";
}

function sanitizeMetadata(metadata?: TraceMetadata): TraceMetadata | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata).filter(([, value]) =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === undefined
  );
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as TraceMetadata;
}
