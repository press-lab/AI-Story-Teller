import { describe, expect, it, vi, beforeEach } from "vitest";
import { runSemanticPostTurnEvaluation, runManualBrainUpdate, runManualAutoCardGeneration } from "./semanticEngine";
import { createDefaultAdventure, makeBrain, makeComponent, makeStoryCard, makeTriggerRule, makeQuest } from "../state/defaults";
import { adventureReducer } from "../state/adventureReducer";
import type { Adventure } from "../types/adventure";

vi.mock("../providers/openAICompatible", () => ({
  sendOpenAICompatibleChatCompletion: vi.fn(),
}));

import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
const mockProvider = vi.mocked(sendOpenAICompatibleChatCompletion);

const providerConfig = {
  name: "test",
  baseUrl: "https://api.example.com",
  apiKey: "sk-test",
  model: "test-model",
  temperature: 0.8,
  maxOutputTokens: 256,
};

function baseAdventure(): Adventure {
  return {
    ...createDefaultAdventure("Semantic Test"),
    activeState: {
      ...createDefaultAdventure("Semantic Test").activeState,
      turn: 5,
    },
    semanticEvaluationSettings: {
      evaluationModel: "",
      messagesIncluded: 4,
      enabled: true,
      showLog: true,
      maxParallelUpdateCalls: 2,
      requireApprovalForAutoUpdates: false,
    },
    messages: [
      { id: "m1", role: "user", content: "I enter the tavern.", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "m2", role: "assistant", content: "The barkeep nods.", createdAt: "2026-01-01T00:01:00.000Z" },
    ],
  };
}

beforeEach(() => {
  mockProvider.mockReset();
});

describe("runSemanticPostTurnEvaluation", () => {
  it("returns empty actions and a log entry when semantic evaluation is disabled", async () => {
    const adventure = { ...baseAdventure(), semanticEvaluationSettings: { ...baseAdventure().semanticEvaluationSettings, enabled: false } };
    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);
    expect(mockProvider).not.toHaveBeenCalled();
    expect(result.actions.some((a) => a.type === "LOG_EVALUATION_RESULT")).toBe(true);
    expect(result.logEntry.conditionsEvaluated).toHaveLength(0);
  });

  it("sends one condition-evaluation call and returns a log entry when no conditions fire", async () => {
    const adventure = {
      ...baseAdventure(),
      triggerRules: [
        makeTriggerRule({
          id: "rule-door",
          name: "Door trigger",
          enabled: true,
          evaluationMode: "semantic",
          condition: "when the player opens a door",
          actions: [{ type: "activateComponent" as const, componentId: "comp-1" }],
        }),
      ],
    };
    mockProvider.mockResolvedValueOnce({ content: "[]", raw: {} });
    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(mockProvider).toHaveBeenCalledOnce();
    expect(result.actions.some((a) => a.type === "LOG_EVALUATION_RESULT")).toBe(true);
    expect(result.logEntry.conditionsFired).toHaveLength(0);
    expect(result.logEntry.errors).toHaveLength(0);
  });

  it("fires a matching semantic trigger rule and maps it to a reducer action", async () => {
    const adventure = {
      ...baseAdventure(),
      triggerRules: [
        makeTriggerRule({
          id: "rule-door",
          name: "Door trigger",
          enabled: true,
          evaluationMode: "semantic",
          condition: "when the player opens a door",
          actions: [{ type: "activateComponent" as const, componentId: "comp-1" }],
        }),
      ],
    };
    mockProvider.mockResolvedValueOnce({ content: '["trigger:rule-door"]', raw: {} });
    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.logEntry.conditionsFired).toContain("trigger:rule-door");
    expect(result.actions.some((a) => a.type === "ACTIVATE_COMPONENT")).toBe(true);
    expect(result.actions.some((a) => a.type === "MARK_TRIGGER_FIRED")).toBe(true);
  });

  it("evaluates a brain condition and calls a targeted brain-update prompt when fired", async () => {
    const brain = makeBrain({ id: "brain-margo", characterName: "Margo", triggers: ["Margo"], active: true });
    const adventure = { ...baseAdventure(), brains: [brain], messages: [...baseAdventure().messages, { id: "m3", role: "user" as const, content: "Margo steps forward.", createdAt: "2026-01-01T00:02:00.000Z" }] };

    // First call: condition evaluation (returns brain condition fired)
    // Second call: brain update prompt
    mockProvider
      .mockResolvedValueOnce({ content: '["brain:brain-margo"]', raw: {} })
      .mockResolvedValueOnce({ content: '{"currentState": "Margo looks relieved."}', raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(mockProvider).toHaveBeenCalledTimes(2);
    expect(result.actions.some((a) => a.type === "APPLY_BRAIN_UPDATE")).toBe(true);
    expect(result.logEntry.conditionsFired).toContain("brain:brain-margo");
  });

  it("evaluates a quest step completion condition and advances the quest when fired", async () => {
    const quest = makeQuest({
      id: "quest-ward",
      title: "Seal the Ward",
      status: "active",
      currentStepId: "step-1",
      steps: [
        {
          id: "step-1",
          title: "Reach Threshold",
          objective: "Reach the threshold",
          status: "active",
          completionCondition: "when the player reaches the threshold",
          triggerConditions: [],
          onStartActions: [],
          onCompleteActions: [],
          contextText: "",
        },
      ],
    });
    const adventure = { ...baseAdventure(), quests: [quest] };
    mockProvider.mockResolvedValueOnce({ content: '["questStep:quest-ward:step-1"]', raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.actions.some((a) => a.type === "COMPLETE_QUEST_STEP")).toBe(true);
    expect(result.logEntry.conditionsFired).toContain("questStep:quest-ward:step-1");
  });

  it("fires an auto-card condition, calls the generation prompt, and queues a CREATE_AUTO_CARD action", async () => {
    const adventure = {
      ...baseAdventure(),
      autoCardSettings: {
        enabled: true,
        detectionCondition: "when a new named entity appears",
        generationPrompt: "Generate a story card for the new entity as JSON.",
        cooldownTurns: 0,
        lastGeneratedTurn: undefined,
      },
    };
    mockProvider
      .mockResolvedValueOnce({ content: '["autoCards:global"]', raw: {} })
      .mockResolvedValueOnce({ content: '{"title":"The Barkeep","content":"A gruff man.","keys":"barkeep, tavern"}', raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.actions.some((a) => a.type === "CREATE_AUTO_CARD")).toBe(true);
    const createAction = result.actions.find((a) => a.type === "CREATE_AUTO_CARD") as Extract<typeof result.actions[number], { type: "CREATE_AUTO_CARD" }>;
    expect(createAction.title).toBe("The Barkeep");
    expect(createAction.content).toBe("A gruff man.");
  });

  it("records a parse error in the log when the LLM returns invalid JSON for conditions", async () => {
    const adventure = {
      ...baseAdventure(),
      triggerRules: [makeTriggerRule({ name: "Rule", enabled: true, evaluationMode: "semantic", condition: "test" })],
    };
    mockProvider.mockResolvedValueOnce({ content: "not json at all", raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.logEntry.errors.length).toBeGreaterThan(0);
    expect(result.logEntry.conditionsFired).toHaveLength(0);
  });

  it("skips disabled and cooling-down semantic trigger rules", async () => {
    const disabledRule = makeTriggerRule({ id: "rule-disabled", name: "Disabled", enabled: false, evaluationMode: "semantic", condition: "test" });
    const coolingRule = makeTriggerRule({ id: "rule-cooling", name: "Cooling", enabled: true, evaluationMode: "semantic", condition: "test", cooldownTurns: 5, lastFiredTurn: 3 });
    const adventure = { ...baseAdventure(), triggerRules: [disabledRule, coolingRule] };

    mockProvider.mockResolvedValueOnce({ content: "[]", raw: {} });
    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    const evaluatedIds = result.logEntry.conditionsEvaluated.map((c) => c.id);
    expect(evaluatedIds).not.toContain("trigger:rule-disabled");
    expect(evaluatedIds).not.toContain("trigger:rule-cooling");
  });

  it("skips keyword and regex mode trigger rules — only semantic mode rules go to the LLM", async () => {
    const keywordRule = makeTriggerRule({ id: "rule-kw", name: "Keyword", enabled: true, evaluationMode: "keyword", condition: "door" });
    const regexRule = makeTriggerRule({ id: "rule-rx", name: "Regex", enabled: true, evaluationMode: "regex", condition: "door.*open" });
    const adventure = { ...baseAdventure(), triggerRules: [keywordRule, regexRule] };

    mockProvider.mockResolvedValueOnce({ content: "[]", raw: {} });
    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    const evaluatedIds = result.logEntry.conditionsEvaluated.map((c) => c.id);
    expect(evaluatedIds).not.toContain("trigger:rule-kw");
    expect(evaluatedIds).not.toContain("trigger:rule-rx");
  });

  it("applies story-card auto-updates and records a per-card cooldown turn", async () => {
    const card = makeStoryCard({
      id: "card-margo",
      title: "Margo",
      content: "Margo is protective.",
      keys: ["Margo"],
      active: true,
      autoUpdate: true,
      autoUpdateCooldownTurns: 0,
    });
    const adventure = {
      ...baseAdventure(),
      storyCards: [card],
      messages: [...baseAdventure().messages, { id: "m3", role: "user" as const, content: "Margo steps forward.", createdAt: "2026-01-01T00:02:00.000Z" }],
      autoCardSettings: { ...baseAdventure().autoCardSettings, enabled: false },
    };

    mockProvider
      .mockResolvedValueOnce({ content: '["storyCard:card-margo"]', raw: {} })
      .mockResolvedValueOnce({ content: "Margo is protective and now worried about Seth.", raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.actions.some((action) => action.type === "APPLY_STORY_CARD_UPDATE")).toBe(true);
    expect(result.actions).toContainEqual({ type: "MARK_STORY_CARD_UPDATED", storyCardId: "card-margo", turn: 5 });
  });

  it("skips story-card auto-update conditions while the card is on cooldown", async () => {
    const card = makeStoryCard({
      id: "card-cooling",
      title: "Cooling Card",
      content: "Old.",
      keys: ["cooling"],
      autoUpdate: true,
      autoUpdateCooldownTurns: 5,
      lastAutoUpdateTurn: 3,
    });
    const adventure = {
      ...baseAdventure(),
      storyCards: [card],
      autoCardSettings: { ...baseAdventure().autoCardSettings, enabled: false },
    };

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(mockProvider).not.toHaveBeenCalled();
    expect(result.logEntry.conditionsEvaluated.map((condition) => condition.id)).not.toContain("storyCard:card-cooling");
  });

  it("routes brain updates to Memory Inbox when auto-update approval is required", async () => {
    const brain = makeBrain({ id: "brain-margo", characterName: "Margo", active: true });
    const adventure = {
      ...baseAdventure(),
      brains: [brain],
      messages: [...baseAdventure().messages, { id: "m3", role: "user" as const, content: "Margo steps forward.", createdAt: "2026-01-01T00:02:00.000Z" }],
      autoCardSettings: { ...baseAdventure().autoCardSettings, enabled: false },
      semanticEvaluationSettings: { ...baseAdventure().semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
    };

    mockProvider
      .mockResolvedValueOnce({ content: '["brain:brain-margo"]', raw: {} })
      .mockResolvedValueOnce({ content: '{"currentState":"Margo is worried."}', raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.actions.some((action) => action.type === "ADD_MEMORY_PROPOSAL")).toBe(true);
    expect(result.actions.some((action) => action.type === "APPLY_BRAIN_UPDATE")).toBe(false);

    let reduced = result.actions.reduce((next, action) => adventureReducer(next, action), adventure);
    expect(reduced.brains[0].currentState).not.toBe("Margo is worried.");
    const proposal = reduced.activeState.memoryProposals[0];
    expect(proposal).toMatchObject({ proposedType: "brainUpdate", status: "pending", targetId: "brain-margo" });

    reduced = adventureReducer(reduced, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposal.id });
    expect(reduced.brains[0].currentState).toBe("Margo is worried.");
  });

  it("routes story-card updates to Memory Inbox when auto-update approval is required", async () => {
    const card = makeStoryCard({
      id: "card-joke",
      title: "Hedge Prince Joke",
      content: "Old joke.",
      keys: ["hedge prince"],
      autoUpdate: true,
      autoUpdateCooldownTurns: 0,
    });
    const adventure = {
      ...baseAdventure(),
      storyCards: [card],
      messages: [...baseAdventure().messages, { id: "m3", role: "user" as const, content: "Margo repeats the hedge prince joke.", createdAt: "2026-01-01T00:02:00.000Z" }],
      autoCardSettings: { ...baseAdventure().autoCardSettings, enabled: false },
      semanticEvaluationSettings: { ...baseAdventure().semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
    };

    mockProvider
      .mockResolvedValueOnce({ content: '["storyCard:card-joke"]', raw: {} })
      .mockResolvedValueOnce({ content: "Margo calls Seth hedge prince only when scared.", raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.actions.some((action) => action.type === "ADD_MEMORY_PROPOSAL")).toBe(true);
    expect(result.actions.some((action) => action.type === "APPLY_STORY_CARD_UPDATE")).toBe(false);
    expect(result.actions).toContainEqual({ type: "MARK_STORY_CARD_UPDATED", storyCardId: "card-joke", turn: 5 });

    let reduced = result.actions.reduce((next, action) => adventureReducer(next, action), adventure);
    expect(reduced.storyCards[0].content).toBe("Old joke.");
    expect(reduced.storyCards[0].lastAutoUpdateTurn).toBe(5);
    const proposal = reduced.activeState.memoryProposals[0];
    expect(proposal).toMatchObject({ proposedType: "storyCard", status: "pending", targetId: "card-joke" });

    const withPendingProposal = reduced;
    const rejected = adventureReducer(reduced, { type: "REJECT_MEMORY_PROPOSAL", proposalId: proposal.id });
    expect(rejected.storyCards[0].content).toBe("Old joke.");
    expect(rejected.activeState.memoryProposals[0].status).toBe("rejected");
    reduced = adventureReducer(withPendingProposal, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposal.id });
    expect(reduced.storyCards[0].content).toBe("Margo calls Seth hedge prince only when scared.");
  });

  it("routes Plot Essentials updates to Memory Inbox when auto-update approval is required", async () => {
    const component = makeComponent({
      id: "component-plot",
      title: "Plot Essentials",
      type: "plotEssentials",
      content: "Old premise.",
      active: true,
    });
    const adventure = {
      ...baseAdventure(),
      components: [component],
      autoCardSettings: { ...baseAdventure().autoCardSettings, enabled: false },
      semanticEvaluationSettings: { ...baseAdventure().semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
    };

    mockProvider
      .mockResolvedValueOnce({ content: '["plotEssentials:component-plot"]', raw: {} })
      .mockResolvedValueOnce({ content: "The Fire Nation court now expects a public duel.", raw: {} });

    const result = await runSemanticPostTurnEvaluation(adventure, providerConfig);

    expect(result.actions.some((action) => action.type === "ADD_MEMORY_PROPOSAL")).toBe(true);
    expect(result.actions.some((action) => action.type === "APPLY_COMPONENT_UPDATE")).toBe(false);

    let reduced = result.actions.reduce((next, action) => adventureReducer(next, action), adventure);
    expect(reduced.components[0].content).toBe("Old premise.");
    const proposal = reduced.activeState.memoryProposals[0];
    expect(proposal).toMatchObject({ proposedType: "plotEssentialsUpdate", status: "pending", targetId: "component-plot" });

    reduced = adventureReducer(reduced, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposal.id });
    expect(reduced.components[0].content).toBe("Old premise.\nThe Fire Nation court now expects a public duel.");
  });
});

describe("runManualBrainUpdate", () => {
  it("calls the brain update prompt and applies the patch", async () => {
    const brain = makeBrain({ id: "brain-seth", characterName: "Seth", active: true });
    const adventure = { ...baseAdventure(), brains: [brain] };
    mockProvider.mockResolvedValueOnce({ content: '{"currentState": "Seth is on edge."}', raw: {} });

    const result = await runManualBrainUpdate(adventure, providerConfig, "brain-seth");

    expect(mockProvider).toHaveBeenCalledOnce();
    expect(result.actions.some((a) => a.type === "APPLY_BRAIN_UPDATE")).toBe(true);
    expect(result.logEntry.conditionsFired).toContain("manualBrain:brain-seth");
  });

  it("logs an error when the brain ID does not exist", async () => {
    const result = await runManualBrainUpdate(baseAdventure(), providerConfig, "missing-brain");
    expect(mockProvider).not.toHaveBeenCalled();
    expect(result.logEntry.errors[0]).toMatch(/not found/i);
  });

  it("logs an error when the LLM returns no recognized brain fields", async () => {
    const brain = makeBrain({ id: "brain-seth", characterName: "Seth", active: true });
    const adventure = { ...baseAdventure(), brains: [brain] };
    mockProvider.mockResolvedValueOnce({ content: '{"unknownField": "something"}', raw: {} });

    const result = await runManualBrainUpdate(adventure, providerConfig, "brain-seth");
    expect(result.actions.some((a) => a.type === "APPLY_BRAIN_UPDATE")).toBe(false);
    expect(result.logEntry.errors[0]).toMatch(/no recognized keys/i);
  });

  it("accepts thoughts as a Record and ignores non-string values for other fields", async () => {
    const brain = makeBrain({ id: "brain-seth", characterName: "Seth", active: true });
    const adventure = { ...baseAdventure(), brains: [brain] };
    mockProvider.mockResolvedValueOnce({
      content:
        '{"relationshipPressure":"bound by command","thoughts":{"seth_watches_court":"5 → Watch the court. Do not flinch."}}',
      raw: {},
    });

    const result = await runManualBrainUpdate(adventure, providerConfig, "brain-seth");
    const action = result.actions.find((entry) => entry.type === "APPLY_BRAIN_UPDATE") as Extract<
      typeof result.actions[number],
      { type: "APPLY_BRAIN_UPDATE" }
    >;

    expect(action.patch.relationshipPressure).toBe("bound by command");
    expect(action.patch.thoughts).toEqual({ seth_watches_court: "5 → Watch the court. Do not flinch." });
    expect(result.logEntry.errors).toEqual([]);
  });
});

describe("runManualAutoCardGeneration", () => {
  it("calls the generation prompt and returns a CREATE_AUTO_CARD action", async () => {
    const adventure = {
      ...baseAdventure(),
      autoCardSettings: {
        enabled: true,
        detectionCondition: "when a new entity appears",
        generationPrompt: "Generate a card.",
        cooldownTurns: 0,
      },
    };
    mockProvider.mockResolvedValueOnce({ content: '{"title":"Iron Compass","content":"A compass pointing to fear.","keys":"compass, Iron Compass"}', raw: {} });

    const result = await runManualAutoCardGeneration(adventure, providerConfig);

    expect(mockProvider).toHaveBeenCalledOnce();
    const createAction = result.actions.find((a) => a.type === "CREATE_AUTO_CARD") as Extract<typeof result.actions[number], { type: "CREATE_AUTO_CARD" }>;
    expect(createAction).toBeDefined();
    expect(createAction.title).toBe("Iron Compass");
    expect(createAction.keys).toContain("compass");
  });

  it("logs an error when the LLM returns invalid JSON", async () => {
    const adventure = { ...baseAdventure(), autoCardSettings: { enabled: true, detectionCondition: "test", generationPrompt: "test", cooldownTurns: 0 } };
    mockProvider.mockResolvedValueOnce({ content: "not json", raw: {} });

    const result = await runManualAutoCardGeneration(adventure, providerConfig);
    expect(result.actions.some((a) => a.type === "CREATE_AUTO_CARD")).toBe(false);
    expect(result.logEntry.errors.length).toBeGreaterThan(0);
  });

  it("logs an error when the LLM returns JSON missing title or content", async () => {
    const adventure = { ...baseAdventure(), autoCardSettings: { enabled: true, detectionCondition: "test", generationPrompt: "test", cooldownTurns: 0 } };
    mockProvider.mockResolvedValueOnce({ content: '{"keys":"something"}', raw: {} });

    const result = await runManualAutoCardGeneration(adventure, providerConfig);
    expect(result.actions.some((a) => a.type === "CREATE_AUTO_CARD")).toBe(false);
    expect(result.logEntry.errors[0]).toMatch(/invalid JSON/i);
  });
});
