/**
 * @vitest-environment jsdom
 */
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import { saveAccountAdventureBackup } from "../db/accountAdventureBackupDb";
import { thumbnailMetadataPatch } from "../utils/adventureImages";
import { createCachedBackendAdventureStore } from "./adventureStore";
import type { RuntimeConfig } from "./runtimeConfig";

const DB_NAME = "ai-story-teller";

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("cached backend adventure store", () => {
  beforeEach(async () => {
    Object.defineProperty(globalThis, "indexedDB", {
      value: new IDBFactory(),
      configurable: true,
    });
    Object.defineProperty(globalThis, "IDBKeyRange", {
      value: IDBKeyRange,
      configurable: true,
    });
    await deleteDb();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills missing server-summary thumbnails from the clean local account backup", async () => {
    const adventure = createDefaultAdventure("Cached Cover Adventure");
    adventure.id = "adv-cached-cover";
    adventure.metadata = thumbnailMetadataPatch({
      dataUrl: "data:image/png;base64,Y292ZXI=",
      altText: "Cached cover",
      mimeType: "image/png",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure,
      syncStatus: "clean",
      lastSyncedAt: "2026-07-05T00:00:00.000Z",
      lastServerUpdatedAt: adventure.updatedAt,
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
      {
        id: adventure.id,
        title: adventure.title,
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt,
        turnCount: 0,
        storyEntryCount: 0,
      },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const summaries = await store.list();

    expect(summaries[0]).toMatchObject({
      id: adventure.id,
      hasLocalBackup: true,
      thumbnailImage: {
        dataUrl: "data:image/png;base64,Y292ZXI=",
        altText: "Cached cover",
      },
    });
  });
});
