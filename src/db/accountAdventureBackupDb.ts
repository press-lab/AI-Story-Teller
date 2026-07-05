import type { Adventure } from "../types/adventure";
import { normalizeAdventure, sanitizeAdventureForPersistence } from "../state/defaults";
import { getAdventureThumbnail } from "../utils/adventureImages";
import type { AdventureSummary } from "./adventureDb";

const DB_NAME = "ai-story-teller";
const DB_VERSION = 2;
const ADVENTURE_STORE_NAME = "adventures";
const STORE_NAME = "accountAdventureBackups";

export type AccountAdventureSyncStatus = "clean" | "pending" | "failed" | "conflict";

export interface AccountAdventureBackupRecord {
  key: string;
  ownerUserId: string;
  adventureId: string;
  adventure: Adventure;
  syncStatus: AccountAdventureSyncStatus;
  createdAt: string;
  updatedAt: string;
  lastLocalUpdatedAt: string;
  lastSyncedAt?: string;
  lastServerUpdatedAt?: string;
  lastSyncError?: string;
}

export interface AccountAdventureBackupInput {
  ownerUserId: string;
  adventure: Adventure;
  syncStatus: AccountAdventureSyncStatus;
  lastSyncedAt?: string;
  lastServerUpdatedAt?: string;
  lastSyncError?: string;
}

function accountBackupKey(ownerUserId: string, adventureId: string): string {
  return `${ownerUserId}:${adventureId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function countStoryEntries(adventure: Adventure): number {
  return adventure.messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  ).length;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ADVENTURE_STORE_NAME)) {
        db.createObjectStore(ADVENTURE_STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function saveAccountAdventureBackup(input: AccountAdventureBackupInput): Promise<AccountAdventureBackupRecord> {
  const cleanAdventure = normalizeAdventure(sanitizeAdventureForPersistence(input.adventure));
  const existing = await getAccountAdventureBackup(input.ownerUserId, cleanAdventure.id);
  const timestamp = nowIso();
  const record: AccountAdventureBackupRecord = {
    key: accountBackupKey(input.ownerUserId, cleanAdventure.id),
    ownerUserId: input.ownerUserId,
    adventureId: cleanAdventure.id,
    adventure: cleanAdventure,
    syncStatus: input.syncStatus,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    lastLocalUpdatedAt: cleanAdventure.updatedAt,
    lastSyncedAt: input.lastSyncedAt ?? existing?.lastSyncedAt,
    lastServerUpdatedAt: input.lastServerUpdatedAt ?? existing?.lastServerUpdatedAt,
    lastSyncError: input.lastSyncError,
  };
  await transaction("readwrite", (store) => store.put(record));
  return record;
}

export async function getAccountAdventureBackup(
  ownerUserId: string,
  adventureId: string,
): Promise<AccountAdventureBackupRecord | undefined> {
  const record = await transaction<AccountAdventureBackupRecord | undefined>(
    "readonly",
    (store) => store.get(accountBackupKey(ownerUserId, adventureId)),
  );
  return record ? normalizeRecord(record) : undefined;
}

export async function listAccountAdventureBackups(ownerUserId: string): Promise<AccountAdventureBackupRecord[]> {
  const records = await transaction<AccountAdventureBackupRecord[]>("readonly", (store) => store.getAll());
  return records
    .filter((record) => record.ownerUserId === ownerUserId)
    .map(normalizeRecord)
    .sort((a, b) => b.adventure.updatedAt.localeCompare(a.adventure.updatedAt));
}

export async function deleteAccountAdventureBackup(ownerUserId: string, adventureId: string): Promise<void> {
  await transaction("readwrite", (store) => store.delete(accountBackupKey(ownerUserId, adventureId)));
}

export function summarizeAccountAdventureBackup(record: AccountAdventureBackupRecord): AdventureSummary {
  return {
    id: record.adventure.id,
    title: record.adventure.title,
    createdAt: record.adventure.createdAt,
    updatedAt: record.adventure.updatedAt,
    turnCount: Number.isFinite(record.adventure.activeState.turn) ? Math.max(0, Math.floor(record.adventure.activeState.turn)) : 0,
    storyEntryCount: countStoryEntries(record.adventure),
    thumbnailImage: getAdventureThumbnail(record.adventure),
    syncStatus: record.syncStatus,
    syncError: record.lastSyncError,
    lastSyncedAt: record.lastSyncedAt,
    localBackupUpdatedAt: record.lastLocalUpdatedAt,
    lastServerUpdatedAt: record.lastServerUpdatedAt,
    hasLocalBackup: true,
  };
}

function normalizeRecord(record: AccountAdventureBackupRecord): AccountAdventureBackupRecord {
  return {
    ...record,
    adventure: normalizeAdventure(record.adventure),
  };
}
