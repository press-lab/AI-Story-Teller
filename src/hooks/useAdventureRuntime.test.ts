import { describe, expect, it, vi } from "vitest";
import {
  applyResponseLengthHint,
  combineProviderUsage,
  isRecoveredBackendTurn,
  saveDeviceAdventureBeforeBackendTurn,
} from "./useAdventureRuntime";
import type { RuntimeProviderSettings } from "../pages/pageTypes";
import { createDefaultAdventure } from "../state/defaults";
import type { AdventureStore } from "../runtime/adventureStore";

const baseConfig: RuntimeProviderSettings = {
  name: "openai-compatible",
  baseUrl: "https://example.test",
  apiKey: "secret",
  model: "deepseek-chat",
  temperature: 0.7,
  maxOutputTokens: 2048,
};

describe("applyResponseLengthHint", () => {
  it("applies a tight length-derived cap below the provider maximum", () => {
    expect(applyResponseLengthHint(baseConfig, 150).maxOutputTokens).toBe(305);
  });

  it("adds a bounded reserve for hidden thought and memory tags", () => {
    expect(applyResponseLengthHint(baseConfig, 150, 240).maxOutputTokens).toBe(365);
    expect(applyResponseLengthHint(baseConfig, 150, 999).maxOutputTokens).toBe(395);
  });

  it("uses the same length cap when the provider has no usable cap", () => {
    const uncapped = { ...baseConfig, maxOutputTokens: 0 };
    expect(applyResponseLengthHint(uncapped, 150).maxOutputTokens).toBe(305);
  });

  it("keeps an intentionally lower provider cap", () => {
    expect(applyResponseLengthHint({ ...baseConfig, maxOutputTokens: 220 }, 150).maxOutputTokens).toBe(220);
  });

  it("clamps unsafe word targets before deriving the cap", () => {
    expect(applyResponseLengthHint(baseConfig, 999).maxOutputTokens).toBe(830);
    expect(applyResponseLengthHint(baseConfig, 10).maxOutputTokens).toBe(155);
  });
});

describe("combineProviderUsage", () => {
  it("adds first-draft and correction-pass usage for guarded story turns", () => {
    expect(combineProviderUsage(
      { promptTokens: 17_000, completionTokens: 650, totalTokens: 17_650, cacheReadTokens: 12_000 },
      { promptTokens: 900, completionTokens: 90, totalTokens: 990, cacheReadTokens: 0 },
    )).toEqual({
      promptTokens: 17_900,
      completionTokens: 740,
      totalTokens: 18_640,
      cacheReadTokens: 12_000,
    });
  });

  it("returns undefined when neither provider call reports usage", () => {
    expect(combineProviderUsage(undefined, undefined)).toBeUndefined();
  });
});

describe("isRecoveredBackendTurn", () => {
  it("recognizes a completed backend turn saved after an interrupted request", () => {
    const before = createDefaultAdventure("Recovery");
    before.id = "adv-recovery";
    before.updatedAt = "2026-07-05T00:00:00.000Z";
    const recovered = {
      ...before,
      updatedAt: "2026-07-05T00:00:03.000Z",
      messages: [
        ...before.messages,
        { id: "msg-user", role: "user" as const, content: "You draw your sword", createdAt: "2026-07-05T00:00:01.000Z" },
        { id: "msg-ai", role: "assistant" as const, content: "Steel clears the scabbard.", createdAt: "2026-07-05T00:00:02.000Z" },
      ],
    };

    expect(isRecoveredBackendTurn(before, recovered, "You draw your sword")).toBe(true);
  });

  it("does not treat a user-only save as a completed backend turn", () => {
    const before = createDefaultAdventure("Recovery");
    before.id = "adv-recovery";
    const recovered = {
      ...before,
      updatedAt: "2026-07-05T00:00:01.000Z",
      messages: [
        ...before.messages,
        { id: "msg-user", role: "user" as const, content: "You draw your sword", createdAt: "2026-07-05T00:00:01.000Z" },
      ],
    };

    expect(isRecoveredBackendTurn(before, recovered, "You draw your sword")).toBe(false);
  });
});

describe("saveDeviceAdventureBeforeBackendTurn", () => {
  it("saves the current device adventure before backend generation", async () => {
    const adventure = createDefaultAdventure("Edited Device Copy");
    adventure.id = "adv-device";
    adventure.messages = [
      { id: "msg-edited", role: "assistant", content: "Edited on this phone.", createdAt: "2026-07-05T00:00:00.000Z" },
    ];
    const store: AdventureStore = {
      list: vi.fn(),
      get: vi.fn(),
      save: vi.fn(async () => undefined),
      delete: vi.fn(),
    };
    const setSaveStatus = vi.fn();
    const refreshAdventures = vi.fn(async () => undefined);

    const result = await saveDeviceAdventureBeforeBackendTurn(adventure, store, setSaveStatus, refreshAdventures);

    expect(result).toBe(adventure);
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
      id: "adv-device",
      messages: expect.arrayContaining([
        expect.objectContaining({ content: "Edited on this phone." }),
      ]),
    }));
    expect(setSaveStatus).toHaveBeenLastCalledWith("saved");
    expect(refreshAdventures).toHaveBeenCalledTimes(1);
  });

  it("uses the explicit generation save path when the store supports one", async () => {
    const adventure = createDefaultAdventure("Edited Device Copy");
    adventure.id = "adv-device";
    const saved = { ...adventure, updatedAt: "2026-07-05T00:00:01.000Z" };
    const store: AdventureStore = {
      list: vi.fn(),
      get: vi.fn(),
      save: vi.fn(async () => undefined),
      saveForGeneration: vi.fn(async () => saved),
      delete: vi.fn(),
    };
    const setSaveStatus = vi.fn();
    const refreshAdventures = vi.fn(async () => undefined);

    const result = await saveDeviceAdventureBeforeBackendTurn(adventure, store, setSaveStatus, refreshAdventures);

    expect(result).toBe(saved);
    expect(store.saveForGeneration).toHaveBeenCalledWith(adventure);
    expect(store.save).not.toHaveBeenCalled();
    expect(setSaveStatus).toHaveBeenLastCalledWith("saved");
    expect(refreshAdventures).toHaveBeenCalledTimes(1);
  });

  it("uploads the local backup when the backend reports a save conflict", async () => {
    const adventure = createDefaultAdventure("Local Conflict Winner");
    adventure.id = "adv-conflict";
    const resolved = { ...adventure, updatedAt: "2026-07-05T00:00:01.000Z" };
    const store: AdventureStore = {
      list: vi.fn(),
      get: vi.fn(),
      save: vi.fn(async () => {
        throw new Error("Local backup conflict. Duplicate this local copy or restore a server backup before syncing.");
      }),
      delete: vi.fn(),
      resolveSyncConflict: vi.fn(async () => resolved),
    };
    const setSaveStatus = vi.fn();
    const refreshAdventures = vi.fn(async () => undefined);

    const result = await saveDeviceAdventureBeforeBackendTurn(adventure, store, setSaveStatus, refreshAdventures);

    expect(result).toBe(resolved);
    expect(store.resolveSyncConflict).toHaveBeenCalledWith("adv-conflict", "uploadLocal");
    expect(setSaveStatus).toHaveBeenLastCalledWith("saved");
    expect(refreshAdventures).toHaveBeenCalledTimes(1);
  });
});
