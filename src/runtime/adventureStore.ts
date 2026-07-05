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

export interface AdventureStore {
  list(): Promise<AdventureSummary[]>;
  get(id: string): Promise<Adventure | undefined>;
  save(adventure: Adventure): Promise<void>;
  delete(id: string): Promise<void>;
  resolveSyncConflict?(id: string, resolution: AdventureSyncConflictResolution): Promise<Adventure>;
}

export type AdventureSyncConflictResolution = "uploadLocal" | "downloadServer";

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

export async function apiJson<T>(config: RuntimeConfig, path: string, init: RequestInit = {}): Promise<T> {
  const base = config.apiBaseUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : undefined;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : `Backend request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export function createBackendAdventureStore(config: RuntimeConfig, authToken?: string): AdventureStore {
  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  return {
    async list() {
      return apiJson<AdventureSummary[]>(config, "/adventures", { headers: authHeaders });
    },
    async get(id) {
      return apiJson<Adventure | undefined>(config, `/adventures/${encodeURIComponent(id)}`, { headers: authHeaders });
    },
    async save(adventure) {
      await apiJson(config, `/adventures/${encodeURIComponent(adventure.id)}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ adventure }),
      });
    },
    async delete(id) {
      await apiJson(config, `/adventures/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
    },
  };
}

export function createCachedBackendAdventureStore(
  config: RuntimeConfig,
  authToken: string,
  ownerUserId: string,
): AdventureStore {
  const backend = createBackendAdventureStore(config, authToken);

  async function cacheCleanAdventure(adventure: Adventure): Promise<void> {
    await saveAccountAdventureBackup({
      ownerUserId,
      adventure,
      syncStatus: "clean",
      lastSyncedAt: new Date().toISOString(),
      lastServerUpdatedAt: adventure.updatedAt,
    });
  }

  async function markBackupFailed(adventure: Adventure, error: unknown): Promise<void> {
    await saveAccountAdventureBackup({
      ownerUserId,
      adventure,
      syncStatus: "failed",
      lastSyncError: error instanceof Error ? error.message : "Backend sync failed.",
    });
  }

  async function markBackupConflict(record: AccountAdventureBackupRecord, serverUpdatedAt: string): Promise<void> {
    await saveAccountAdventureBackup({
      ownerUserId,
      adventure: record.adventure,
      syncStatus: "conflict",
      lastServerUpdatedAt: serverUpdatedAt,
      lastSyncedAt: record.lastSyncedAt,
      lastSyncError: `Server copy changed at ${new Date(serverUpdatedAt).toLocaleString()}. Open this local backup and resolve before syncing.`,
    });
  }

  async function flushPendingBackups(): Promise<void> {
    const backups = await listAccountAdventureBackups(ownerUserId);
    for (const backup of backups) {
      if (backup.syncStatus !== "pending" && backup.syncStatus !== "failed") continue;
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
        await markBackupFailed(backup.adventure, error);
      }
    }
  }

  async function mergedListFromServer(): Promise<AdventureSummary[]> {
    await flushPendingBackups();
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
        if (serverSummary) {
          byId.set(backup.adventureId, {
            ...serverSummary,
            thumbnailImage: serverSummary.thumbnailImage ?? backupSummary.thumbnailImage,
            hasLocalBackup: true,
            lastSyncedAt: backup.lastSyncedAt,
            localBackupUpdatedAt: backup.lastLocalUpdatedAt,
            lastServerUpdatedAt: serverSummary.updatedAt,
          });
        }
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
    async list() {
      try {
        return await mergedListFromServer();
      } catch {
        const backups = await listAccountAdventureBackups(ownerUserId);
        return backups.map(summarizeAccountAdventureBackup);
      }
    },
    async get(id) {
      const backup = await getAccountAdventureBackup(ownerUserId, id);
      if (backup && backup.syncStatus !== "clean") return backup.adventure;
      try {
        const adventure = await backend.get(id);
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
          lastSyncError: existingBackup.lastSyncError ?? "Server copy changed. Duplicate this local backup or restore a server backup before syncing.",
        });
        throw new Error("Local backup conflict. Duplicate this local copy or restore a server backup before syncing.");
      }
      await saveAccountAdventureBackup({ ownerUserId, adventure, syncStatus: "pending" });
      try {
        await backend.save(adventure);
        await cacheCleanAdventure(adventure);
      } catch (error) {
        await markBackupFailed(adventure, error);
        throw error;
      }
    },
    async delete(id) {
      await backend.delete(id);
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

export function createBackendTurnRunner(config: RuntimeConfig, authToken: string, providerOverride?: Partial<ProviderConfig>): TurnRunner {
  return {
    runTurn(request) {
      return apiJson<TurnResult>(config, `/adventures/${encodeURIComponent(request.adventureId)}/turn`, {
        method: "POST",
        keepalive: true,
        headers: { Authorization: `Bearer ${authToken}` },
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
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
  };
}
