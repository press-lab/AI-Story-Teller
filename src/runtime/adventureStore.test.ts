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
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify({
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

  it("preserves HTTP status when the backend returns a non-JSON tunnel error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      "<html><body>Bad Gateway</body></html>",
      { status: 502, headers: { "Content-Type": "text/html" } },
    )));

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const runner = createBackendTurnRunner(config, "session-token");

    await expect(runner.runTurn({ adventureId: "adv-1", input: "You wait", mode: "do" }))
      .rejects.toThrow("Backend request failed with HTTP 502");
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

  it("skips the pre-generation upload only after verifying the clean local backup matches the server copy", async () => {
    const adventure = createDefaultAdventure("Already Synced");
    adventure.id = "adv-clean";
    adventure.updatedAt = "2026-07-05T01:00:00.000Z";
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure,
      syncStatus: "clean",
      lastSyncedAt: "2026-07-05T01:00:01.000Z",
      lastServerUpdatedAt: adventure.updatedAt,
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/telemetry/client")) {
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      expect(init?.method ?? "GET").toBe("GET");
      return new Response(JSON.stringify(adventure), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const saved = await store.saveForGeneration!(adventure);

    expect(saved).toBe(adventure);
    const verifyCall = fetchMock.mock.calls.find(([input]) => String(input) === "http://backend.test/adventures/adv-clean");
    expect(verifyCall?.[1]?.method).toBeUndefined();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("keeps a newer clean local backup when the backend list omits the server save", async () => {
    const local = createDefaultAdventure("Local Only After Failed Server Save");
    local.id = "adv-missing-server";
    local.updatedAt = "2026-07-05T10:10:00.000Z";
    local.messages = [
      { id: "local-user", role: "user", content: "This local progress must stay visible.", createdAt: "2026-07-05T10:09:00.000Z" },
    ];
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: local,
      syncStatus: "clean",
      lastSyncedAt: "2026-07-05T10:10:01.000Z",
      lastServerUpdatedAt: local.updatedAt,
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/telemetry/client")) {
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const summaries = await store.list();

    expect(summaries[0]).toMatchObject({
      id: "adv-missing-server",
      title: "Local Only After Failed Server Save",
      syncStatus: "conflict",
      updatedAt: "2026-07-05T10:10:00.000Z",
      syncError: expect.stringContaining("Server copy was not found"),
    });
    const backup = await getAccountAdventureBackup("user-1", "adv-missing-server");
    expect(backup).toMatchObject({
      syncStatus: "conflict",
      adventure: expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: "This local progress must stay visible." }),
        ]),
      }),
    });
  });

  it("does not overwrite a newer clean local backup when backend get returns an older save", async () => {
    const local = createDefaultAdventure("Local Progress");
    local.id = "adv-stale-server";
    local.updatedAt = "2026-07-05T10:10:00.000Z";
    local.messages = [
      { id: "local-user", role: "user", content: "New local progress.", createdAt: "2026-07-05T10:09:00.000Z" },
    ];
    const server = createDefaultAdventure("Stale Server");
    server.id = local.id;
    server.updatedAt = "2026-07-05T10:05:00.000Z";
    server.messages = [
      { id: "server-user", role: "user", content: "Old server progress.", createdAt: "2026-07-05T10:04:00.000Z" },
    ];
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: local,
      syncStatus: "clean",
      lastSyncedAt: "2026-07-05T10:10:01.000Z",
      lastServerUpdatedAt: local.updatedAt,
    });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/telemetry/client")) {
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify(server), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    const opened = await store.get("adv-stale-server");

    expect(opened).toMatchObject({
      title: "Local Progress",
      messages: expect.arrayContaining([
        expect.objectContaining({ content: "New local progress." }),
      ]),
    });
    expect(opened?.messages.some((message) => message.content === "Old server progress.")).toBe(false);
    const backup = await getAccountAdventureBackup("user-1", "adv-stale-server");
    expect(backup).toMatchObject({
      syncStatus: "conflict",
      lastServerUpdatedAt: "2026-07-05T10:05:00.000Z",
      lastSyncError: expect.stringContaining("older"),
    });
  });

  it("stops generation instead of uploading over an unresolved local backup conflict", async () => {
    const oldBackup = createDefaultAdventure("Old Backup");
    oldBackup.id = "adv-conflict";
    oldBackup.updatedAt = "2026-07-05T01:00:00.000Z";
    oldBackup.messages = [
      { id: "old-user", role: "user", content: "This is the stale backup.", createdAt: "2026-07-05T00:59:00.000Z" },
    ];
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: oldBackup,
      syncStatus: "conflict",
      lastServerUpdatedAt: "2026-07-05T01:05:00.000Z",
      lastSyncError: "Server copy changed.",
    });
    const openAdventure = {
      ...oldBackup,
      title: "Edited Open Copy",
      updatedAt: "2026-07-05T01:10:00.000Z",
      messages: [
        { id: "edited-user", role: "user" as const, content: "This device edit must win.", createdAt: "2026-07-05T01:09:00.000Z" },
      ],
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    await expect(store.saveForGeneration!(openAdventure)).rejects.toThrow("Local backup conflict");

    expect(fetchMock).not.toHaveBeenCalled();
    const backup = await getAccountAdventureBackup("user-1", "adv-conflict");
    expect(backup).toMatchObject({
      syncStatus: "conflict",
      lastServerUpdatedAt: "2026-07-05T01:05:00.000Z",
      adventure: expect.objectContaining({
        title: "Edited Open Copy",
      }),
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

  it("deletes a conflicted local backup when the server save is already missing", async () => {
    const local = createDefaultAdventure("Missing Server Conflict");
    local.id = "adv-missing-server";
    local.updatedAt = "2026-07-05T10:10:00.000Z";
    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure: local,
      syncStatus: "conflict",
      lastSyncError: "Server copy was not found.",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/telemetry/client")) {
        return new Response("{}", { status: 202, headers: { "Content-Type": "application/json" } });
      }
      expect(init?.method).toBe("DELETE");
      return new Response(JSON.stringify({ error: "Adventure not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const config: RuntimeConfig = { mode: "backendLocal", apiBaseUrl: "http://backend.test" };
    const store = createCachedBackendAdventureStore(config, "session-token", "user-1");
    await store.delete("adv-missing-server");

    expect(await getAccountAdventureBackup("user-1", "adv-missing-server")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/adventures/adv-missing-server",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
