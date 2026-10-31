import { normalizeAdventure, sanitizeAdventureForPersistence } from "../state/defaults";
import { deleteAdventure, getAdventure, listAdventures, saveAdventure, type AdventureSummary } from "../db/adventureDb";
import {
  deleteAccountAdventureBackup,
  getAccountAdventureBackup,
  listAccountAdventureBackups,
  saveAccountAdventureBackup,
  summarizeAccountAdventureBackup,
  type AccountAdventureBackupRecord,
} from "../db/accountAdventureBackupDb";
import type { Adventure, ContextBuildResult, InputMode, ProviderConfig } from "../types/adventure";
import type { RuntimeConfig } from "./runtimeConfig";
import {
  bodyByteLength,
  clientTimingMetadata,
  createClientTraceId,
  recordClientPerformanceTrace,
  sanitizeClientError,
  submitClientPerformanceTrace,
  traceErrorCategory,
  type ClientPerformanceTrace,
} from "./performanceTrace";

export interface AdventureStore {
  hydrateMissingThumbnails?: boolean;
  list(): Promise<AdventureSummary[]>;
  get(id: string): Promise<Adventure | undefined>;
  save(adventure: Adventure): Promise<void>;
  saveForGeneration?(adventure: Adventure): Promise<Adventure>;
  delete(id: string): Promise<void>;
  resolveSyncConflict?(id: string, resolution: AdventureSyncConflictResolution): Promise<Adventure>;
}

export type AdventureSyncConflictResolution = "uploadLocal" | "downloadServer";

const CLOUD_SAVE_QUEUED_MESSAGE =
  "Cloud save failed; playing from this device. Changes will sync when the backend reconnects.";

export class BackendSyncQueuedError extends Error {
  constructor(readonly originalError: unknown) {
    super(CLOUD_SAVE_QUEUED_MESSAGE);
    this.name = "BackendSyncQueuedError";
  }
}

export function isBackendSyncQueuedError(error: unknown): error is BackendSyncQueuedError {
  return error instanceof BackendSyncQueuedError
    || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "BackendSyncQueuedError");
}

export function isRetryableBackendSyncError(error: unknown): boolean {
  if (isBackendSyncQueuedError(error)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network error|load failed|connection|connectex|aborted|aborterror|timeout|timed out|offline|unreachable|temporarily unavailable|cloudflare|bad gateway|service unavailable|gateway timeout|HTTP 408|HTTP 425|HTTP 429|HTTP 500|HTTP 502|HTTP 503|HTTP 504/i.test(message);
}

export interface TurnResult {
  adventure: Adventure;
  responseContent: string;
  preProviderContext?: ContextBuildResult;
  postTurnContext?: ContextBuildResult;
}

export interface TurnRequest {
  adventureId: string;
  input: string;
  mode?: InputMode;
  recordUserInput?: boolean;
  providerCue?: string;
  regenerateLastAssistant?: boolean;
  providerOverride?: Partial<ProviderConfig>;
}

export interface TurnRunner {
  runTurn(request: TurnRequest): Promise<TurnResult>;
}

export interface ContextPreviewSource {
  build(adventureId: string): Promise<ContextBuildResult>;
}

export function createLocalAdventureStore(): AdventureStore {
  return {
    list: listAdventures,
    get: getAdventure,
    save: saveAdventure,
    delete: deleteAdventure,
  };
}

export function createUnavailableAdventureStore(message: string): AdventureStore {
  return {
    async list() {
      return [];
    },
    async get() {
      return undefined;
    },
    async save() {
      throw new Error(message);
    },
    async delete() {
      throw new Error(message);
    },
  };
}

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly traceId?: string,
    readonly retryAfter?: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export async function apiJson<T>(config: RuntimeConfig, path: string, init: RequestInit = {}): Promise<T> {
  const base = config.apiBaseUrl.replace(/\/+$/, "");
  const startedAt = performance.now();
  const createdAt = new Date().toISOString();
  const traceId = createClientTraceId();
  const method = init.method ?? "GET";
  const initHeaders = headersToRecord(init.headers);
  const requestBytes = bodyByteLength(init.body);
  const shouldSubmitTrace = path !== "/telemetry/client";
  let statusCode: number | undefined;
  let responseBytes: number | undefined;
  let text = "";
  let completedOk = false;
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...initHeaders,
        ...(method === "GET" || method === "HEAD" ? {} : { "X-AIST-CSRF": "1" }),
        "X-AIST-Trace-Id": traceId,
        "X-AIST-Client-Sent-At": createdAt,
        "X-AIST-Client-Path": path,
      },
    });
    statusCode = response.status;
    text = await response.text();
    responseBytes = new TextEncoder().encode(text).byteLength;
    const body = parseJsonBody(text);
    if (!response.ok) {
      const errorBody = body && typeof body === "object" ? body as Record<string, unknown> : undefined;
      const message = errorBody && "error" in errorBody
        ? String(errorBody.error)
        : backendHttpErrorMessage(config, response.status, text);
      throw new BackendApiError(
        message,
        response.status,
        typeof errorBody?.code === "string" ? errorBody.code : undefined,
        typeof errorBody?.traceId === "string" ? errorBody.traceId : response.headers.get("X-AIST-Trace-Id") ?? undefined,
        response.headers.get("Retry-After") ?? undefined,
      );
    }
    if (text && body === undefined) {
      throw new Error(`Backend returned invalid JSON with HTTP ${response.status}.`);
    }
    completedOk = true;
    return body as T;
  } catch (error) {
    const userFacingError = statusCode === undefined && isBackendTransportError(error)
      ? new Error(backendTransportErrorMessage(config))
      : error;
    if (shouldSubmitTrace) {
      recordAndSubmitDeviceTrace(config, {
        id: `client_${traceId}`,
        traceId,
        source: "device",
        phase: "http_round_trip",
        route: path,
        method,
        status: "error",
        statusCode,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        requestBytes,
        responseBytes,
        errorCategory: traceErrorCategory(error, statusCode),
        errorMessage: sanitizeClientError(error),
        metadata: clientTimingMetadata(Math.max(0, Math.round(performance.now() - startedAt))),
        createdAt,
      }, initHeaders.Authorization);
    }
    throw userFacingError;
  } finally {
    if (shouldSubmitTrace && completedOk && statusCode !== undefined && statusCode < 400) {
      recordAndSubmitDeviceTrace(config, {
        id: `client_${traceId}`,
        traceId,
        source: "device",
        phase: "http_round_trip",
        route: path,
        method,
        status: "ok",
        statusCode,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        requestBytes,
        responseBytes,
        metadata: clientTimingMetadata(Math.max(0, Math.round(performance.now() - startedAt))),
        createdAt,
      }, initHeaders.Authorization);
    }
  }
}

function parseJsonBody(text: string): unknown | undefined {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function backendHostLabel(apiBaseUrl: string): string {
  try {
    const base = typeof window === "undefined" ? "https://story.storymodeai.com" : window.location.origin;
    const url = new URL(apiBaseUrl, base);
    return url.host || "the configured backend";
  } catch {
    return "the configured backend";
  }
}

function isBackendTransportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network error|load failed|connection|connectex|aborted|aborterror|timeout|timed out/i.test(message);
}

function backendTransportErrorMessage(config: RuntimeConfig): string {
  return `Backend is offline or unreachable. The app could not reach the story server at ${backendHostLabel(config.apiBaseUrl)}. Keep working from this device where available; cloud actions will retry when the backend reconnects.`;
}

function isTemporaryBackendStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

function backendHttpErrorMessage(config: RuntimeConfig, status: number, text: string): string {
  const detail = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  if (isTemporaryBackendStatus(status)) {
    const detailSuffix = detail ? ` Backend response: ${detail}` : "";
    return `Backend is temporarily unavailable (HTTP ${status}). The app reached ${backendHostLabel(config.apiBaseUrl)}, but the story server did not return a usable response. Keep working from this device where available; cloud actions will retry when the backend reconnects.${detailSuffix}`;
  }
  return detail
    ? `Backend request failed with HTTP ${status}: ${detail}`
    : `Backend request failed with HTTP ${status}.`;
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers.map(([key, value]) => [key, value]));
  return { ...headers };
}

function recordAndSubmitDeviceTrace(config: RuntimeConfig, trace: ClientPerformanceTrace, authHeader?: string): void {
  recordClientPerformanceTrace(trace);
  submitClientPerformanceTrace(config, trace, authHeader);
}

export function createBackendAdventureStore(config: RuntimeConfig, authToken?: string): AdventureStore {
  const authHeaders = backendBearerHeaders(authToken);
  const revisions = new Map<string, number>();
  const saveChains = new Map<string, Promise<void>>();
  function rememberRevision(adventure: Adventure | undefined): Adventure | undefined {
    const revision = adventure?.metadata?.serverRevision;
    if (adventure && typeof revision === "number") revisions.set(adventure.id, revision);
    return adventure ? normalizeAdventure(adventure) : undefined;
  }
  return {
    async list() {
      return apiJson<AdventureSummary[]>(config, "/adventures", { headers: authHeaders });
    },
    async get(id) {
      return rememberRevision(await apiJson<Adventure | undefined>(config, `/adventures/${encodeURIComponent(id)}`, { headers: authHeaders }));
    },
    async save(adventure) {
      const previous = saveChains.get(adventure.id) ?? Promise.resolve();
      const run = previous.catch(() => undefined).then(async () => {
        const expectedRevision = revisions.get(adventure.id);
        const revisionScoped = expectedRevision === undefined
          ? adventure
          : { ...adventure, metadata: { ...adventure.metadata, serverRevision: expectedRevision } };
        const saved = await apiJson<Adventure>(config, `/adventures/${encodeURIComponent(adventure.id)}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ adventure: sanitizeAdventureForPersistence(revisionScoped) }),
        });
        rememberRevision(saved);
      });
      saveChains.set(adventure.id, run);
      try {
        await run;
      } finally {
        if (saveChains.get(adventure.id) === run) saveChains.delete(adventure.id);
      }
    },
    async delete(id) {
      await apiJson(config, `/adventures/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      revisions.delete(id);
    },
  };
}

export function createCachedBackendAdventureStore(
  config: RuntimeConfig,
  authToken: string,
  ownerUserId: string,
): AdventureStore {
  const backend = createBackendAdventureStore(config, authToken);
  let pendingFlushTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingFlushInFlight: Promise<void> | undefined;

  function schedulePendingFlush(delayMs = 10_000): void {
    if (pendingFlushTimer !== undefined) return;
    const timer = setTimeout(() => {
      pendingFlushTimer = undefined;
      void flushPendingBackupsAndReschedule();
    }, delayMs) as ReturnType<typeof setTimeout> & { unref?: () => void };
    timer.unref?.();
    pendingFlushTimer = timer;
  }

  async function flushPendingBackupsAndReschedule(): Promise<void> {
    if (pendingFlushInFlight) return pendingFlushInFlight;
    pendingFlushInFlight = (async () => {
      await flushPendingBackups();
      const backups = await listAccountAdventureBackups(ownerUserId);
      if (backups.some(shouldRetryBackup)) {
        schedulePendingFlush(15_000);
      }
    })().finally(() => {
      pendingFlushInFlight = undefined;
    });
    return pendingFlushInFlight;
  }

  async function cacheCleanAdventure(adventure: Adventure): Promise<void> {
    await saveAccountAdventureBackup({
      ownerUserId,
      adventure,
      syncStatus: "clean",
      lastSyncedAt: new Date().toISOString(),
      lastServerUpdatedAt: adventure.updatedAt,
    });
  }

  async function saveOpenDeviceAdventure(adventure: Adventure): Promise<Adventure> {
    const existingBackup = await getAccountAdventureBackup(ownerUserId, adventure.id);
    if (existingBackup?.syncStatus === "conflict") {
      await saveAccountAdventureBackup({
        ownerUserId,
        adventure,
        syncStatus: "conflict",
        lastServerUpdatedAt: existingBackup.lastServerUpdatedAt,
        lastSyncedAt: existingBackup.lastSyncedAt,
        lastSyncError: existingBackup.lastSyncError ?? "Two Story versions changed. Choose which one to continue with.",
      });
      throw new Error("Two Story versions changed. Choose “Keep this device’s version” or “Use the server version” before continuing.");
    }
    if (
      existingBackup?.syncStatus === "clean"
      && existingBackup.adventure.updatedAt === adventure.updatedAt
      && existingBackup.lastServerUpdatedAt === adventure.updatedAt
    ) {
      let serverAdventure: Adventure | undefined;
      try {
        serverAdventure = await backend.get(adventure.id);
      } catch (error) {
        if (isRetryableBackendSyncError(error)) {
          await markBackupFailed(adventure, error);
          schedulePendingFlush();
          throw new BackendSyncQueuedError(error);
        }
        throw error;
      }
      if (!serverAdventure) {
        await markMissingServerConflict(existingBackup);
        throw new Error("This Story has an unresolved save conflict. Keep this device’s version before continuing.");
      }
      if (serverAdventure.updatedAt !== adventure.updatedAt) {
        if (serverAdventure.updatedAt < adventure.updatedAt) {
          await markOlderServerConflict(existingBackup, serverAdventure.updatedAt);
        } else {
          await markBackupConflict(existingBackup, serverAdventure.updatedAt);
        }
        throw new Error("Two Story versions changed. Choose which one to continue with before generating.");
      }
      return adventure;
    }
    await saveAccountAdventureBackup({ ownerUserId, adventure, syncStatus: "pending" });
    try {
      await backend.save(adventure);
      await cacheCleanAdventure(adventure);
      return adventure;
    } catch (error) {
      if (isStaleAdventureRevisionError(error)) {
        const backup = await getAccountAdventureBackup(ownerUserId, adventure.id);
        if (backup) await markBackupConflict(backup, undefined, "Server save revision changed. This device's local backup was kept; choose which save should win before syncing.");
        throw new Error("Two Story versions changed again. Choose which one to continue with before generating.");
      }
      await markBackupFailed(adventure, error);
      if (isRetryableBackendSyncError(error)) {
        schedulePendingFlush();
        throw new BackendSyncQueuedError(error);
      }
      throw error;
    }
  }

  async function markBackupFailed(adventure: Adventure, error: unknown): Promise<void> {
    await saveAccountAdventureBackup({
      ownerUserId,
      adventure,
      syncStatus: "failed",
      lastSyncError: isRetryableBackendSyncError(error)
        ? CLOUD_SAVE_QUEUED_MESSAGE
        : error instanceof Error ? error.message : "Backend sync failed.",
    });
  }

  function shouldRetryBackup(backup: AccountAdventureBackupRecord): boolean {
    return backup.syncStatus === "pending"
      || (backup.syncStatus === "failed" && backup.lastSyncError === CLOUD_SAVE_QUEUED_MESSAGE);
  }

  async function markBackupConflict(
    record: AccountAdventureBackupRecord,
    serverUpdatedAt?: string,
    lastSyncError?: string,
  ): Promise<AccountAdventureBackupRecord> {
    const serverDetail = serverUpdatedAt
      ? `Server copy changed at ${new Date(serverUpdatedAt).toLocaleString()}.`
      : "Server copy was not found.";
    return saveAccountAdventureBackup({
      ownerUserId,
      adventure: record.adventure,
      syncStatus: "conflict",
      lastServerUpdatedAt: serverUpdatedAt ?? record.lastServerUpdatedAt,
      lastSyncedAt: record.lastSyncedAt,
      lastSyncError: lastSyncError ?? `${serverDetail} This device's local backup was kept; choose which save should win before syncing.`,
    });
  }

  async function markMissingServerConflict(record: AccountAdventureBackupRecord): Promise<AccountAdventureBackupRecord> {
    return markBackupConflict(
      record,
      undefined,
      "The server version could not be found. This device’s version is preserved; keep it to restore the Story or deliberately delete the local copy.",
    );
  }

  async function markOlderServerConflict(
    record: AccountAdventureBackupRecord,
    serverUpdatedAt: string,
  ): Promise<AccountAdventureBackupRecord> {
    return markBackupConflict(
      record,
      serverUpdatedAt,
      "The server version is older than this device’s version. Both are preserved until you choose which one to continue with.",
    );
  }

  async function flushPendingBackups(): Promise<void> {
    const backups = await listAccountAdventureBackups(ownerUserId);
    for (const backup of backups) {
      if (!shouldRetryBackup(backup)) continue;
      try {
        if (backup.lastServerUpdatedAt) {
          const serverAdventure = await backend.get(backup.adventureId);
          if (
            serverAdventure
            && serverAdventure.updatedAt > backup.lastServerUpdatedAt
            && serverAdventure.updatedAt !== backup.adventure.updatedAt
          ) {
            await markBackupConflict(backup, serverAdventure.updatedAt);
            continue;
          }
        }
        await backend.save(backup.adventure);
        await cacheCleanAdventure(backup.adventure);
      } catch (error) {
        if (isStaleAdventureRevisionError(error)) {
          await markBackupConflict(backup, undefined, "Server save revision changed. This device's local backup was kept; choose which save should win before syncing.");
          continue;
        }
        await markBackupFailed(backup.adventure, error);
        if (isRetryableBackendSyncError(error)) schedulePendingFlush();
      }
    }
  }

  async function mergedListFromServer(): Promise<AdventureSummary[]> {
    void flushPendingBackupsAndReschedule().catch(() => undefined);
    const [serverSummaries, backups] = await Promise.all([
      backend.list(),
      listAccountAdventureBackups(ownerUserId),
    ]);
    const byId = new Map<string, AdventureSummary>(
      serverSummaries.map((summary) => [summary.id, { ...summary, syncStatus: "clean", hasLocalBackup: false }]),
    );
    for (const backup of backups) {
      const backupSummary = summarizeAccountAdventureBackup(backup);
      const serverSummary = byId.get(backup.adventureId);
      if (backup.syncStatus === "clean") {
        if (!serverSummary) {
          const conflict = await markMissingServerConflict(backup);
          byId.set(backup.adventureId, summarizeAccountAdventureBackup(conflict));
          continue;
        }
        if (serverSummary.updatedAt < backup.adventure.updatedAt) {
          const conflict = await markOlderServerConflict(backup, serverSummary.updatedAt);
          byId.set(backup.adventureId, summarizeAccountAdventureBackup(conflict));
          continue;
        }
        byId.set(backup.adventureId, {
          ...serverSummary,
          thumbnailImage: serverSummary.thumbnailImage ?? backupSummary.thumbnailImage,
          hasLocalBackup: true,
          lastSyncedAt: backup.lastSyncedAt,
          localBackupUpdatedAt: backup.lastLocalUpdatedAt,
          lastServerUpdatedAt: serverSummary.updatedAt,
        });
        continue;
      }
      byId.set(backup.adventureId, {
        ...backupSummary,
        title: serverSummary?.title ?? backupSummary.title,
        lastServerUpdatedAt: serverSummary?.updatedAt ?? backupSummary.lastServerUpdatedAt,
      });
    }
    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  return {
    hydrateMissingThumbnails: false,
    async list() {
      try {
        return await mergedListFromServer();
      } catch {
        schedulePendingFlush();
        const backups = await listAccountAdventureBackups(ownerUserId);
        return backups.map(summarizeAccountAdventureBackup);
      }
    },
    async get(id) {
      const backup = await getAccountAdventureBackup(ownerUserId, id);
      if (backup && backup.syncStatus !== "clean") return backup.adventure;
      try {
        const adventure = await backend.get(id);
        if (backup && !adventure) {
          await markMissingServerConflict(backup);
          return backup.adventure;
        }
        if (backup && adventure && adventure.updatedAt < backup.adventure.updatedAt) {
          await markOlderServerConflict(backup, adventure.updatedAt);
          return backup.adventure;
        }
        if (adventure) await cacheCleanAdventure(adventure);
        return adventure ?? backup?.adventure;
      } catch {
        return backup?.adventure;
      }
    },
    async save(adventure) {
      const existingBackup = await getAccountAdventureBackup(ownerUserId, adventure.id);
      if (existingBackup?.syncStatus === "conflict") {
        await saveAccountAdventureBackup({
          ownerUserId,
          adventure,
          syncStatus: "conflict",
          lastServerUpdatedAt: existingBackup.lastServerUpdatedAt,
          lastSyncedAt: existingBackup.lastSyncedAt,
          lastSyncError: existingBackup.lastSyncError ?? "Two Story versions changed. Make a copy or choose a server backup before syncing.",
        });
        throw new Error("This Story has an unresolved save conflict. Make a copy of this device’s version or restore a server backup before syncing.");
      }
      await saveAccountAdventureBackup({ ownerUserId, adventure, syncStatus: "pending" });
      try {
        await backend.save(adventure);
        await cacheCleanAdventure(adventure);
      } catch (error) {
        if (isStaleAdventureRevisionError(error)) {
          const backup = await getAccountAdventureBackup(ownerUserId, adventure.id);
          if (backup) await markBackupConflict(backup, undefined, "Server save revision changed. This device's local backup was kept; choose which save should win before syncing.");
          throw new Error("Two Story versions changed again. Choose which one to continue with before syncing.");
        }
        await markBackupFailed(adventure, error);
        if (isRetryableBackendSyncError(error)) {
          schedulePendingFlush();
          throw new BackendSyncQueuedError(error);
        }
        throw error;
      }
    },
    saveForGeneration: saveOpenDeviceAdventure,
    async delete(id) {
      const backup = await getAccountAdventureBackup(ownerUserId, id);
      try {
        await backend.delete(id);
      } catch (error) {
        if (!backup || !isBackendNotFoundError(error)) throw error;
      }
      await deleteAccountAdventureBackup(ownerUserId, id);
    },
    async resolveSyncConflict(id, resolution) {
      const backup = await getAccountAdventureBackup(ownerUserId, id);
      if (resolution === "uploadLocal") {
        if (!backup) throw new Error("Local backup not found.");
        await backend.save(backup.adventure);
        await cacheCleanAdventure(backup.adventure);
        return backup.adventure;
      }

      const serverAdventure = await backend.get(id);
      if (!serverAdventure) throw new Error("Server save not found.");
      await cacheCleanAdventure(serverAdventure);
      return serverAdventure;
    },
  };
}

function isBackendNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:HTTP 404|not found)/i.test(message) && !/route not found/i.test(message);
}

function isStaleAdventureRevisionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /adventure changed on the server|stale_adventure_revision|server save revision/i.test(message);
}

export function createBackendTurnRunner(config: RuntimeConfig, authToken: string, providerOverride?: Partial<ProviderConfig>): TurnRunner {
  return {
    runTurn(request) {
      return apiJson<TurnResult>(config, `/adventures/${encodeURIComponent(request.adventureId)}/turn`, {
        method: "POST",
        keepalive: true,
        headers: {
          ...backendBearerHeaders(authToken),
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          input: request.input,
          mode: request.mode,
          recordUserInput: request.recordUserInput,
          providerCue: request.providerCue,
          regenerateLastAssistant: request.regenerateLastAssistant,
          providerOverride: request.providerOverride ?? providerOverride,
        }),
      });
    },
  };
}

export function createBackendContextPreviewSource(config: RuntimeConfig, authToken: string): ContextPreviewSource {
  return {
    build(adventureId) {
      return apiJson<ContextBuildResult>(config, `/adventures/${encodeURIComponent(adventureId)}/context-preview`, {
        headers: backendBearerHeaders(authToken),
      });
    },
  };
}

function backendBearerHeaders(authToken?: string): Record<string, string> {
  return authToken && authToken !== "cookie"
    ? { Authorization: `Bearer ${authToken}` }
    : {};
}
