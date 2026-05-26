/**
 * @vitest-environment jsdom
 */
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultAdventure } from "../state/defaults";
import { deleteAdventure, getAdventure, listAdventures, saveAdventure } from "./adventureDb";

const DB_NAME = "ai-story-teller";

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe("adventureDb IndexedDB persistence", () => {
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

  it("saves and reloads adventures without persisting provider API keys", async () => {
    const adventure = createDefaultAdventure("Persisted");
    adventure.modelConfig = { ...adventure.modelConfig, apiKey: "test key should not persist" };
    adventure.activeState.storyUndoStack = [
      {
        id: "story-edit-test",
        label: "test edit",
        createdAt: "2026-01-01T00:00:00.000Z",
        undo: { type: "updateOpeningScene", content: "before" },
        redo: { type: "updateOpeningScene", content: "after" },
      },
    ];

    await saveAdventure(adventure);

    const loaded = await getAdventure(adventure.id);
    expect(loaded?.title).toBe("Persisted");
    expect(loaded?.modelConfig.apiKey).toBeUndefined();
    expect(loaded?.activeState.storyUndoStack).toEqual([
      {
        id: "story-edit-test",
        label: "test edit",
        createdAt: "2026-01-01T00:00:00.000Z",
        undo: { type: "updateOpeningScene", content: "before" },
        redo: { type: "updateOpeningScene", content: "after" },
      },
    ]);
    expect(loaded?.activeState.storyRedoStack).toEqual([]);
  });

  it("lists adventures newest-first and deletes by id", async () => {
    const older = createDefaultAdventure("Older");
    older.updatedAt = "2026-01-01T00:00:00.000Z";
    const newer = createDefaultAdventure("Newer");
    newer.updatedAt = "2026-01-02T00:00:00.000Z";

    await saveAdventure(older);
    await saveAdventure(newer);

    expect((await listAdventures()).map((adventure) => adventure.title)).toEqual(["Newer", "Older"]);

    await deleteAdventure(newer.id);

    expect(await getAdventure(newer.id)).toBeUndefined();
    expect((await listAdventures()).map((adventure) => adventure.title)).toEqual(["Older"]);
  });
});
