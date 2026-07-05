/**
 * @vitest-environment jsdom
 */
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import { getAccountAdventureBackup, saveAccountAdventureBackup } from "../db/accountAdventureBackupDb";
import { thumbnailMetadataPatch } from "../utils/adventureImages";
import { createBackendTurnRunner, createCachedBackendAdventureStore } from "./adventureStore";
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

  it("marks backend turn posts as keepalive for mobile backgrounding", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      adventure: createDefaultAdventure("Turn Result"),
      responseContent: "Done.",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const runner = createBackendTurnRunner(config, "session-token");
    await runner.runTurn({ adventureId: "adv-1", input: "You draw your sword", mode: "do" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/adventures/adv-1/turn",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });

  it("surfaces local and server save timestamps for conflicted backend summaries", async () => {
    const local = createDefaultAdventure("Local Conflict");
    local.id = "adv-conflict";
    local.updatedAt = "2026-07-05T10:10:00.000Z";
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: local,
      syncStatus: "conflict",
      lastServerUpdatedAt: "2026-07-05T10:05:00.000Z",
      lastSyncError: "Server copy changed.",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([
      {
        id: local.id,
        title: "Server Conflict",
        createdAt: local.createdAt,
        updatedAt: "2026-07-05T10:06:00.000Z",
        turnCount: 7,
        storyEntryCount: 14,
      },
    ]), { status: 200, headers: { "Content-Type": "application/json" } })));

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const summaries = await store.list();

    expect(summaries[0]).toMatchObject({
      id: "adv-conflict",
      title: "Server Conflict",
      syncStatus: "conflict",
      localBackupUpdatedAt: "2026-07-05T10:10:00.000Z",
      lastServerUpdatedAt: "2026-07-05T10:06:00.000Z",
    });
  });

  it("uploads the conflicted local backup to the backend and marks it clean", async () => {
    const local = createDefaultAdventure("Local Wins");
    local.id = "adv-conflict";
    local.updatedAt = "2026-07-05T01:00:00.000Z";
    local.messages = [
      { id: "local-user", role: "user", content: "Keep the phone save.", createdAt: "2026-07-05T00:59:00.000Z" },
    ];
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: local,
      syncStatus: "conflict",
      lastServerUpdatedAt: "2026-07-05T00:30:00.000Z",
      lastSyncError: "Server copy changed.",
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: local.id,
      title: local.title,
      createdAt: local.createdAt,
      updatedAt: local.updatedAt,
      turnCount: 0,
      storyEntryCount: 1,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const resolved = await store.resolveSyncConflict!("adv-conflict", "uploadLocal");

    expect(resolved.title).toBe("Local Wins");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/adventures/adv-conflict",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining("Keep the phone save."),
      }),
    );
    const backup = await getAccountAdventureBackup("user-1", "adv-conflict");
    expect(backup).toMatchObject({
      syncStatus: "clean",
      lastServerUpdatedAt: local.updatedAt,
    });
  });

  it("downloads the server adventure over a conflicted local backup and marks it clean", async () => {
    const local = createDefaultAdventure("Local Loses");
    local.id = "adv-conflict";
    local.updatedAt = "2026-07-05T01:00:00.000Z";
    const server = createDefaultAdventure("Server Wins");
    server.id = "adv-conflict";
    server.updatedAt = "2026-07-05T01:05:00.000Z";
    server.messages = [
      { id: "server-user", role: "user", content: "Keep the server save.", createdAt: "2026-07-05T01:04:00.000Z" },
    ];
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: local,
      syncStatus: "conflict",
      lastServerUpdatedAt: "2026-07-05T00:30:00.000Z",
      lastSyncError: "Server copy changed.",
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(server), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const resolved = await store.resolveSyncConflict!("adv-conflict", "downloadServer");

    expect(resolved.title).toBe("Server Wins");
    const backup = await getAccountAdventureBackup("user-1", "adv-conflict");
    expect(backup).toMatchObject({
      syncStatus: "clean",
      lastServerUpdatedAt: server.updatedAt,
      adventure: expect.objectContaining({
        title: "Server Wins",
      }),
    });
  });
});
