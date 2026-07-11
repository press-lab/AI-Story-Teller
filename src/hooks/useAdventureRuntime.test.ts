/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  applyResponseLengthHint,
  BACKEND_OFFLINE_LOCAL_MODE_MESSAGE,
  combineProviderUsage,
  isRecoveredBackendTurn,
  saveDeviceAdventureBeforeBackendTurn,
  shouldAttemptBackendReconnect,
  type BackendAiTools,
  useAdventureRuntime,
} from "./useAdventureRuntime";
import type { RuntimeProviderSettings } from "../pages/pageTypes";
import { createDefaultAdventure } from "../state/defaults";
import { BackendSyncQueuedError, type AdventureStore, type TurnRunner } from "../runtime/adventureStore";
import type { Adventure } from "../types/adventure";

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

describe("shouldAttemptBackendReconnect", () => {
  it("tries the backend initially and then after two local actions", () => {
    expect(shouldAttemptBackendReconnect(undefined)).toBe(true);
    expect(shouldAttemptBackendReconnect(0)).toBe(false);
    expect(shouldAttemptBackendReconnect(1)).toBe(false);
    expect(shouldAttemptBackendReconnect(2)).toBe(true);
    expect(shouldAttemptBackendReconnect(3)).toBe(true);
  });
});

describe("backend offline local fallback", () => {
  it("keeps a locally generated continue result when backend sync is queued", async () => {
    const adventure = createDefaultAdventure("Offline Continue");
    adventure.id = "adv-offline-continue";
    adventure.semanticEvaluationSettings = { ...adventure.semanticEvaluationSettings, enabled: false };
    adventure.memoryDetectionSettings = { ...adventure.memoryDetectionSettings, enabled: false };
    let latestAdventure: Adventure | undefined = adventure;
    const store: AdventureStore = {
      list: vi.fn(async () => []),
      get: vi.fn(async () => latestAdventure),
      save: vi.fn(async () => {
        throw new BackendSyncQueuedError(new Error("Backend request failed with HTTP 502."));
      }),
      saveForGeneration: vi.fn(async (next) => next),
      delete: vi.fn(),
    };
    const backendTurnRunner: TurnRunner = {
      runTurn: vi.fn(async () => {
        throw new Error("Backend request failed with HTTP 502.");
      }),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "Local fallback response." } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const setSaveStatus = vi.fn();
    const setContextResult = vi.fn();
    const refreshAdventures = vi.fn(async () => undefined);

    const { result } = renderHook(() => {
      const [current, setCurrent] = useState<Adventure | undefined>(adventure);
      latestAdventure = current;
      return useAdventureRuntime(
        current,
        setCurrent,
        baseConfig,
        store,
        setSaveStatus,
        setContextResult,
        vi.fn(),
        refreshAdventures,
        { enabled: false, generateContent: false, everyNTurns: 1 },
        backendTurnRunner,
      );
    });

    await act(async () => {
      await result.current.continueTurn();
    });

    expect(backendTurnRunner.runTurn).toHaveBeenCalledOnce();
    expect(latestAdventure?.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "assistant", content: "Local fallback response." }),
    ]));
    expect(result.current.error).toBe(BACKEND_OFFLINE_LOCAL_MODE_MESSAGE);
    expect(setSaveStatus).toHaveBeenLastCalledWith("Cloud save failed; playing from this device. Changes will sync when the backend reconnects.");
  });
});

describe("hosted backend Play actions", () => {
  it("submits, continues, and retries with the backend turn semantics", async () => {
    const initial = createDefaultAdventure("Hosted Play Actions");
    initial.id = "adv-hosted-play-actions";
    initial.messages = [
      { id: "opening-user", role: "user", content: "I reach the door.", createdAt: "2026-07-11T00:00:00.000Z" },
      { id: "opening-ai", role: "assistant", content: "The lock is cold.", createdAt: "2026-07-11T00:00:01.000Z" },
    ];
    let serverAdventure = initial;
    let messageSequence = 0;
    const nextMessage = (role: "user" | "assistant", content: string) => ({
      id: `hosted-message-${++messageSequence}`,
      role,
      content,
      createdAt: `2026-07-11T00:00:${String(messageSequence + 1).padStart(2, "0")}.000Z`,
    });
    const store: AdventureStore = {
      list: vi.fn(async () => []),
      get: vi.fn(async () => serverAdventure),
      save: vi.fn(async () => undefined),
      saveForGeneration: vi.fn(async (next) => {
        serverAdventure = next;
        return next;
      }),
      delete: vi.fn(async () => undefined),
    };
    const backendTurnRunner: TurnRunner = {
      runTurn: vi.fn(async (request) => {
        if (request.regenerateLastAssistant) {
          const withoutLatestAssistant = [...serverAdventure.messages];
          let latestAssistantIndex = -1;
          for (let index = withoutLatestAssistant.length - 1; index >= 0; index -= 1) {
            if (withoutLatestAssistant[index].role === "assistant") {
              latestAssistantIndex = index;
              break;
            }
          }
          if (latestAssistantIndex >= 0) withoutLatestAssistant.splice(latestAssistantIndex, 1);
          serverAdventure = {
            ...serverAdventure,
            messages: [...withoutLatestAssistant, nextMessage("assistant", "The lock opens differently this time.")],
          };
          return { adventure: serverAdventure, responseContent: "The lock opens differently this time." };
        }
        if (request.recordUserInput === false) {
          serverAdventure = {
            ...serverAdventure,
            messages: [...serverAdventure.messages, nextMessage("assistant", "The hinges answer with a whisper.")],
          };
          return { adventure: serverAdventure, responseContent: "The hinges answer with a whisper." };
        }
        serverAdventure = {
          ...serverAdventure,
          messages: [
            ...serverAdventure.messages,
            { ...nextMessage("user", request.input), inputMode: request.mode },
            nextMessage("assistant", "The tumblers shift beneath your hand."),
          ],
        };
        return { adventure: serverAdventure, responseContent: "The tumblers shift beneath your hand." };
      }),
    };
    const refreshAdventures = vi.fn(async () => undefined);

    const { result } = renderHook(() => {
      const [current, setCurrent] = useState<Adventure | undefined>(initial);
      const runtime = useAdventureRuntime(
        current,
        setCurrent,
        baseConfig,
        store,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        refreshAdventures,
        { enabled: false, generateContent: false, everyNTurns: 1 },
        backendTurnRunner,
      );
      return { current, runtime };
    });

    await act(async () => {
      await result.current.runtime.submitTurn("You test the lock.", "do");
    });
    expect(backendTurnRunner.runTurn).toHaveBeenNthCalledWith(1, {
      adventureId: initial.id,
      input: "You test the lock.",
      mode: "do",
    });
    expect(result.current.current?.messages.slice(-2)).toEqual([
      expect.objectContaining({ role: "user", content: "You test the lock.", inputMode: "do" }),
      expect.objectContaining({ role: "assistant", content: "The tumblers shift beneath your hand." }),
    ]);

    await act(async () => {
      await result.current.runtime.continueTurn();
    });
    expect(backendTurnRunner.runTurn).toHaveBeenNthCalledWith(2, {
      adventureId: initial.id,
      input: "[continue]",
      mode: "story",
      recordUserInput: false,
      providerCue: "[continue]",
    });
    expect(result.current.current?.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "The hinges answer with a whisper.",
    });

    const messageCountBeforeRetry = result.current.current?.messages.length;
    await act(async () => {
      await result.current.runtime.regenerateLastResponse();
    });
    expect(backendTurnRunner.runTurn).toHaveBeenNthCalledWith(3, {
      adventureId: initial.id,
      input: "[regenerate]",
      mode: "story",
      recordUserInput: false,
      regenerateLastAssistant: true,
    });
    expect(result.current.current?.messages).toHaveLength(messageCountBeforeRetry!);
    expect(result.current.current?.messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "The lock opens differently this time.",
    });
  });

  it("rejects a non-retryable backend turn so Play can preserve the draft", async () => {
    const initial = createDefaultAdventure("Hosted Play Failure");
    initial.id = "adv-hosted-play-failure";
    const store: AdventureStore = {
      list: vi.fn(async () => []),
      get: vi.fn(async () => initial),
      save: vi.fn(async () => undefined),
      saveForGeneration: vi.fn(async (next) => next),
      delete: vi.fn(async () => undefined),
    };
    const backendTurnRunner: TurnRunner = {
      runTurn: vi.fn(async () => {
        throw new Error("Authentication is required.");
      }),
    };
    const { result } = renderHook(() => {
      const [current, setCurrent] = useState<Adventure | undefined>(initial);
      return useAdventureRuntime(
        current,
        setCurrent,
        baseConfig,
        store,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(async () => undefined),
        { enabled: false, generateContent: false, everyNTurns: 1 },
        backendTurnRunner,
      );
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.submitTurn("You test the lock.", "do");
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toEqual(expect.objectContaining({ message: "Authentication is required." }));
    expect(result.current.error).toBe("Authentication is required.");
  });
});

describe("adventure-scoped async results", () => {
  it("discards a backend result when the user switched adventures before completion", async () => {
    const adventureA = createDefaultAdventure("Adventure A");
    adventureA.id = "adv-a";
    const adventureB = createDefaultAdventure("Adventure B");
    adventureB.id = "adv-b";
    let resolveUpdate!: (value: { adventure: Adventure }) => void;
    const delayedUpdate = new Promise<{ adventure: Adventure }>((resolve) => { resolveUpdate = resolve; });
    const backendAiTools = {
      updateBrain: vi.fn(() => delayedUpdate),
    } as unknown as BackendAiTools;
    const store: AdventureStore = {
      list: vi.fn(async () => []),
      get: vi.fn(),
      save: vi.fn(async () => undefined),
      saveForGeneration: vi.fn(async (next) => next),
      delete: vi.fn(),
    };

    const { result } = renderHook(() => {
      const [current, setCurrent] = useState<Adventure | undefined>(adventureA);
      const runtime = useAdventureRuntime(
        current,
        setCurrent,
        baseConfig,
        store,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(async () => undefined),
        { enabled: false, generateContent: false, everyNTurns: 1 },
        undefined,
        undefined,
        backendAiTools,
      );
      return { current, setCurrent, runtime };
    });

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.runtime.updateBrainNow("brain-a");
      await Promise.resolve();
    });
    act(() => result.current.setCurrent(adventureB));
    resolveUpdate({ adventure: { ...adventureA, title: "Late Adventure A Result" } });
    await act(async () => pending);

    expect(result.current.current?.id).toBe("adv-b");
    expect(result.current.current?.title).toBe("Adventure B");
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

  it("allows backend generation to continue when the cloud save is queued locally", async () => {
    const adventure = createDefaultAdventure("Queued Before Generation");
    adventure.id = "adv-queued";
    const store: AdventureStore = {
      list: vi.fn(),
      get: vi.fn(),
      save: vi.fn(async () => {
        throw new BackendSyncQueuedError(new Error("Backend request failed with HTTP 502."));
      }),
      delete: vi.fn(),
    };
    const setSaveStatus = vi.fn();
    const refreshAdventures = vi.fn(async () => undefined);

    const result = await saveDeviceAdventureBeforeBackendTurn(adventure, store, setSaveStatus, refreshAdventures);

    expect(result).toBe(adventure);
    expect(setSaveStatus).toHaveBeenLastCalledWith("Cloud save failed; playing from this device. Changes will sync when the backend reconnects.");
    expect(refreshAdventures).toHaveBeenCalledTimes(1);
  });

  it("stops before backend generation when the backend reports a save conflict", async () => {
    const adventure = createDefaultAdventure("Local Conflict Winner");
    adventure.id = "adv-conflict";
    const store: AdventureStore = {
      list: vi.fn(),
      get: vi.fn(),
      save: vi.fn(async () => {
        throw new Error("Local backup conflict. Duplicate this local copy or restore a server backup before syncing.");
      }),
      delete: vi.fn(),
      resolveSyncConflict: vi.fn(),
    };
    const setSaveStatus = vi.fn();
    const refreshAdventures = vi.fn(async () => undefined);

    await expect(saveDeviceAdventureBeforeBackendTurn(adventure, store, setSaveStatus, refreshAdventures))
      .rejects.toThrow("Local backup conflict");

    expect(store.resolveSyncConflict).not.toHaveBeenCalled();
    expect(setSaveStatus).toHaveBeenLastCalledWith("Local backup conflict. Duplicate this local copy or restore a server backup before syncing.");
    expect(refreshAdventures).not.toHaveBeenCalled();
  });
});
