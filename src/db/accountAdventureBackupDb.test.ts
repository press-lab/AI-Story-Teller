/**
 * @vitest-environment jsdom
 */
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import {
  deleteAccountAdventureBackup,
  getAccountAdventureBackup,
  listAccountAdventureBackups,
  saveAccountAdventureBackup,
  summarizeAccountAdventureBackup,
} from "./accountAdventureBackupDb";

const DB_NAME = "ai-story-teller";

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("accountAdventureBackupDb", () => {
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
  });

  it("stores account-scoped backend backups separately from Browser Local adventures", async () => {
    const adventure = createDefaultAdventure("Cached Backend Adventure");
    adventure.updatedAt = "2026-07-05T01:00:00.000Z";
    adventure.activeState.turn = 3;
    adventure.messages = [
      { id: "msg-user", role: "user", content: "I move.", createdAt: "2026-07-05T00:00:00.000Z" },
      { id: "msg-assistant", role: "assistant", content: "You move.", createdAt: "2026-07-05T00:01:00.000Z" },
    ];

    await saveAccountAdventureBackup({
      ownerUserId: "user-1",
      adventure,
      syncStatus: "pending",
      lastSyncError: "Backend offline.",
    });

    expect(await getAccountAdventureBackup("user-2", adventure.id)).toBeUndefined();
    const backup = await getAccountAdventureBackup("user-1", adventure.id);
    expect(backup?.adventure.title).toBe("Cached Backend Adventure");
    expect(backup?.syncStatus).toBe("pending");

    const summaries = (await listAccountAdventureBackups("user-1")).map(summarizeAccountAdventureBackup);
    expect(summaries).toEqual([
      expect.objectContaining({
        id: adventure.id,
        title: "Cached Backend Adventure",
        turnCount: 3,
        storyEntryCount: 2,
        syncStatus: "pending",
        syncError: "Backend offline.",
        hasLocalBackup: true,
      }),
    ]);

    await deleteAccountAdventureBackup("user-1", adventure.id);
    expect(await getAccountAdventureBackup("user-1", adventure.id)).toBeUndefined();
  });
});
