import { describe, expect, it } from "vitest";
import { loadEnv } from "vite";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { runManualAutoCardGeneration, runManualBrainUpdate, runRememberThis, runSemanticPostTurnEvaluation } from "../triggers/semanticEngine";
import { adventureReducer } from "../state/adventureReducer";
import { createDefaultAdventure, makeBrain, makeComponent, makeStoryCard, makeTriggerRule } from "../state/defaults";
import type { Adventure, ProviderConfig } from "../types/adventure";

function liveGroqConfig(): ProviderConfig {
  const env = loadEnv("test", ".", "");
  const apiKey = env.VITE_TEST_GROQ_API_KEY?.trim();
  const baseUrl = env.VITE_TEST_GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1";
  const model = env.VITE_TEST_GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  if (!apiKey) {
    throw new Error("Missing VITE_TEST_GROQ_API_KEY in .env.test.local.");
  }
  return {
    name: "groq-live-test",
    baseUrl,
    apiKey,
    model,
    temperature: 0,
    maxOutputTokens: 256,
  };
}

function reduceAll(adventure: Adventure, actions: Parameters<typeof adventureReducer>[1][]): Adventure {
  return actions.reduce((next, action) => adventureReducer(next, action), adventure);
}

function baseAdventure(): Adventure {
  return {
    ...createDefaultAdventure("Live Groq Test"),
    components: [
      makeComponent({
        id: "component-live-target",
        title: "Live Target",
        type: "custom",
        content: "This starts inactive.",
        active: false,
      }),
    ],
    autoCardSettings: {
      enabled: true,
      detectionCondition: "when the story excerpt contains the exact phrase LIVE_AUTOCARD_FIRE",
      generationPrompt:
        'Return ONLY valid JSON exactly like this: {"title":"Live Clocktower","content":"The Live Clocktower is a recurring landmark introduced in the test transcript.","keys":"Live Clocktower, clocktower"}',
      cooldownTurns: 0,
      lastGeneratedTurn: undefined,
    },
    semanticEvaluationSettings: {
      evaluationModel: "",
      messagesIncluded: 8,
      enabled: true,
      showLog: true,
      maxParallelUpdateCalls: 2,
    },
    activeState: {
      ...createDefaultAdventure("Live Groq Test").activeState,
      turn: 1,
    },
  };
}

describe("live Groq provider integration", () => {
  it("calls the OpenAI-compatible chat completion endpoint and returns content", async () => {
    const response = await sendOpenAICompatibleChatCompletion({
      config: liveGroqConfig(),
      messages: [
        { role: "system", content: "Return exactly: LIVE_PROVIDER_OK" },
        { role: "user", content: "Provider live test. Reply with exactly LIVE_PROVIDER_OK." },
      ],
    });

    expect(response.content.trim()).toBe("LIVE_PROVIDER_OK");
  });

  it("runs semantic evaluation and applies only reducer actions", async () => {
    let adventure: Adventure = {
      ...baseAdventure(),
      triggerRules: [
        makeTriggerRule({
          id: "trigger-live-semantic",
          name: "Live semantic activation",
          enabled: true,
          evaluationMode: "semantic",
          condition: "when the story excerpt contains the exact phrase LIVE_SEMANTIC_FIRE",
          actions: [{ type: "activateComponent", componentId: "component-live-target" }],
        }),
      ],
      messages: [
        {
          id: "live-msg-1",
          role: "assistant" as const,
          content: "The test transcript now says LIVE_SEMANTIC_FIRE.",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const result = await runSemanticPostTurnEvaluation(adventure, liveGroqConfig());
    expect(result.logEntry.conditionsEvaluated.map((condition) => condition.id)).toContain("trigger:trigger-live-semantic");
    expect(result.logEntry.conditionsFired).toContain("trigger:trigger-live-semantic");
    expect(result.actions.some((action) => action.type === "ACTIVATE_COMPONENT")).toBe(true);

    adventure = reduceAll(adventure, result.actions);
    expect(adventure.components.find((component) => component.id === "component-live-target")?.active).toBe(true);
    expect(adventure.activeState.evaluationLog[0].conditionsFired).toContain("trigger:trigger-live-semantic");
  });

  it("runs a targeted live brain update against an existing BrainEntry", async () => {
    let adventure: Adventure = {
      ...baseAdventure(),
      brains: [
        makeBrain({
          id: "brain-live-margo",
          characterName: "Margo",
          currentState: "Margo is guarded.",
          updatePrompt:
            'Return ONLY valid JSON exactly like this: {"currentState":"Margo is openly worried about Seth after the live test scene."}',
        }),
      ],
      messages: [
        {
          id: "live-msg-brain",
          role: "assistant" as const,
          content: "Margo sees Seth step into danger and becomes openly worried.",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const result = await runManualBrainUpdate(adventure, liveGroqConfig(), "brain-live-margo");
    expect(result.logEntry.errors).toEqual([]);
    expect(result.actions.some((action) => action.type === "APPLY_BRAIN_UPDATE")).toBe(true);

    adventure = reduceAll(adventure, result.actions);
    expect(adventure.brains.find((brain) => brain.id === "brain-live-margo")?.currentState).toContain(
      "openly worried about Seth",
    );
  });

  it("runs live Auto-Card generation into the review queue, not active context", async () => {
    let adventure: Adventure = {
      ...baseAdventure(),
      messages: [
        {
          id: "live-msg-autocard",
          role: "assistant" as const,
          content: "The party arrives at the Live Clocktower. LIVE_AUTOCARD_FIRE.",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };

    const result = await runManualAutoCardGeneration(adventure, liveGroqConfig());
    expect(result.logEntry.errors).toEqual([]);
    expect(result.actions.some((action) => action.type === "CREATE_AUTO_CARD")).toBe(true);

    adventure = reduceAll(adventure, result.actions);
    expect(adventure.activeState.autoCardReviewQueue[0]).toMatchObject({
      title: "Live Clocktower",
      source: "generated",
    });
    expect(adventure.storyCards.some((card) => card.title === "Live Clocktower")).toBe(false);
  });

  it("runs live Remember This and creates reviewable Memory Inbox proposals", async () => {
    let adventure: Adventure = {
      ...baseAdventure(),
      storyCards: [
        makeStoryCard({
          id: "card-live-margo",
          title: "Margo",
          keys: ["Margo"],
          content: "Margo is protective of Seth.",
        }),
      ],
      brains: [makeBrain({ id: "brain-live-margo", characterName: "Margo" })],
    };

    const result = await runRememberThis(
      adventure,
      liveGroqConfig(),
      "Margo calls Seth hedge prince as a private joke.",
    );
    expect(result.logEntry.errors).toEqual([]);
    expect(result.actions.some((action) => action.type === "ADD_MEMORY_PROPOSAL")).toBe(true);

    adventure = reduceAll(adventure, result.actions);
    expect(adventure.activeState.memoryProposals.length).toBeGreaterThan(0);
    expect(adventure.activeState.memoryProposals[0].status).toBe("pending");
    expect(adventure.storyCards.some((card) => card.content.includes("hedge prince"))).toBe(false);
  });
});
