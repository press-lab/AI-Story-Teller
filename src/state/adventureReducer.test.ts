import { describe, expect, it } from "vitest";
import type { Adventure, AdventureAction, RawImportEntry, TriggerLogEntry } from "../types/adventure";
import { createDefaultAdventure, makeBrain, makeComponent, makeStoryCard, makeTriggerRule } from "./defaults";
import { adventureReducer } from "./adventureReducer";
import { makeMemoryProposal } from "../test/goldenAdventure";

const testedActionTypes = [
  "SET_TITLE",
  "SET_OPENING_SCENE",
  "UPDATE_METADATA",
  "ADD_MESSAGE",
  "UPDATE_MESSAGE",
  "DELETE_MESSAGE",
  "DELETE_LAST_MESSAGE",
  "REMOVE_LAST_ASSISTANT_MESSAGE",
  "UNDO_STORY_EDIT",
  "REDO_STORY_EDIT",
  "INCREMENT_TURN",
  "UPSERT_COMPONENT",
  "DELETE_COMPONENT",
  "ACTIVATE_COMPONENT",
  "DEACTIVATE_COMPONENT",
  "PIN_COMPONENT",
  "UNPIN_COMPONENT",
  "UPDATE_COMPONENT",
  "APPLY_COMPONENT_UPDATE",
  "REORDER_COMPONENT",
  "UPSERT_STORY_CARD",
  "DELETE_STORY_CARD",
  "ACTIVATE_STORY_CARD",
  "DEACTIVATE_STORY_CARD",
  "PIN_STORY_CARD",
  "UNPIN_STORY_CARD",
  "UPDATE_STORY_CARD",
  "APPLY_STORY_CARD_UPDATE",
  "MARK_STORY_CARD_UPDATED",
  "REORDER_STORY_CARD",
  "UPSERT_BRAIN",
  "DELETE_BRAIN",
  "ACTIVATE_BRAIN",
  "DEACTIVATE_BRAIN",
  "PIN_BRAIN",
  "UNPIN_BRAIN",
  "UPDATE_BRAIN",
  "APPEND_BRAIN_STATE",
  "REPLACE_BRAIN_STATE",
  "APPLY_BRAIN_UPDATE",
  "UPSERT_TRIGGER_RULE",
  "DELETE_TRIGGER_RULE",
  "UPDATE_TRIGGER_RULE",
  "MARK_TRIGGER_FIRED",
  "LOG_TRIGGER_FIRE",
  "LOG_EVALUATION_RESULT",
  "FORCE_INCLUDE_NEXT_TURN",
  "ADD_RAW_IMPORT",
  "UPDATE_RAW_IMPORT",
  "DELETE_RAW_IMPORT",
  "ADD_MEMORY_PROPOSAL",
  "UPDATE_MEMORY_PROPOSAL",
  "APPROVE_MEMORY_PROPOSAL",
  "REJECT_MEMORY_PROPOSAL",
  "IGNORE_MEMORY_PROPOSAL",
  "UPDATE_ROLLING_SUMMARY",
  "UPDATE_SCENE_STATE",
  "SET_TOKEN_BUDGET_SETTINGS",
  "SET_SYSTEM_TRIGGER_SETTINGS",
  "SET_MODEL_CONFIG",
  "SET_SEMANTIC_EVALUATION_SETTINGS",
  "SET_MEMORY_AUTO_APPROVE",
  "SET_MEMORY_DETECTION_SETTINGS",
  "SET_STATE_FLAG",
  "SET_RESPONSE_LENGTH_HINT",
  "SET_NEXT_TURN_NOTE",
  "CLEAR_NEXT_TURN_NOTE",
  "CONSUME_NEXT_TURN_NOTE",
  "QUEUE_PENDING_UPDATE",
  "FLUSH_PENDING_UPDATES",
  "SET_CHALLENGE_MODE",
  "SET_LAST_MEMORY_CYCLE_TURN",
  "SET_LAST_SEMANTIC_EVAL_TURN",
  "SET_LAST_SCENE_STATE_TURN",
  "RESET_RUNTIME_STATE",
  "ACCUMULATE_BACKGROUND_TOKENS",
  "SET_AUTO_SAVE_SETTINGS",
  "MARK_COMPONENT_UPDATED",
] as const satisfies AdventureAction["type"][];

type MissingActionCoverage = Exclude<AdventureAction["type"], (typeof testedActionTypes)[number]>;
type ExtraActionCoverage = Exclude<(typeof testedActionTypes)[number], AdventureAction["type"]>;
const assertAllActionsCovered: MissingActionCoverage extends never ? true : never = true;
const assertNoExtraActions: ExtraActionCoverage extends never ? true : never = true;

function baseAdventure(): Adventure {
  const componentA = makeComponent({ title: "Component A", content: "A", priority: 10, active: false });
  const componentB = makeComponent({ title: "Component B", content: "B", priority: 20 });
  const storyA = makeStoryCard({ title: "Story A", content: "A", priority: 10, active: false });
  const storyB = makeStoryCard({ title: "Story B", content: "B", priority: 20 });
  const brain = makeBrain({ characterName: "Mira", active: false, currentState: "old" });
  const triggerRule = makeTriggerRule({ name: "Rule A" });
  return {
    ...createDefaultAdventure("Reducer Test"),
    components: [componentA, componentB],
    storyCards: [storyA, storyB],
    brains: [brain],
    triggerRules: [triggerRule],
    messages: [
      { id: "msg-user", role: "user", content: "hello", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "msg-assistant", role: "assistant", content: "hi", createdAt: "2026-01-01T00:01:00.000Z" },
    ],
    activeState: {
      turn: 3,
      forceIncludeNextTurn: [],
      triggerLog: [],
      evaluationLog: [],
      memoryProposals: [],
      pendingUpdates: [],
      storyUndoStack: [],
      storyRedoStack: [],
      nextTurnNote: {
        content: "",
        active: true,
        pinned: true,
        protected: false,
        priority: 85,
        expiresAfterUse: true,
      },
      rawImports: [],
      stateFlags: {},
      responseLengthHint: 150,
      backgroundTokenUsage: { promptTokens: 0, completionTokens: 0 },
      challengeMode: false,
    },
    rollingSummary: { content: "summary", updatedAt: "2026-01-01T00:00:00.000Z" },
  };
}

function reduce(state: Adventure, action: AdventureAction): Adventure {
  return adventureReducer(state, action);
}

describe("adventureReducer", () => {
  it("keeps the action coverage list exhaustive at compile time", () => {
    expect(assertAllActionsCovered).toBe(true);
    expect(assertNoExtraActions).toBe(true);
    expect(new Set(testedActionTypes).size).toBe(testedActionTypes.length);
  });

  it("handles title, metadata, messages, turn, settings, provider, flags, summary, and runtime reset actions", () => {
    let state = baseAdventure();
    state = reduce(state, { type: "SET_TITLE", title: "New Title" });
    expect(state.title).toBe("New Title");

    state = reduce(state, { type: "SET_OPENING_SCENE", content: "The storm broke at midnight." });
    expect(state.openingScene).toBe("The storm broke at midnight.");

    state = reduce(state, { type: "UPDATE_METADATA", metadata: { rating: "teen" } });
    expect(state.metadata.rating).toBe("teen");

    state = reduce(state, { type: "ADD_MESSAGE", id: "msg-new", role: "user", content: "new", createdAt: "2026-01-01T00:02:00.000Z" });
    expect(state.messages.at(-1)).toMatchObject({ id: "msg-new", role: "user", content: "new" });

    state = reduce(state, { type: "UPDATE_MESSAGE", messageId: "msg-new", content: "edited" });
    expect(state.messages.find((message) => message.id === "msg-new")?.content).toBe("edited");
    expect(state.activeState.storyUndoStack[0].label).toBe("Edit story section");

    state = reduce(state, { type: "DELETE_MESSAGE", messageId: "msg-new" });
    expect(state.messages.some((message) => message.id === "msg-new")).toBe(false);

    state = reduce(state, { type: "DELETE_LAST_MESSAGE" });
    expect(state.messages.at(-1)?.id).toBe("msg-user");

    state = reduce(state, { type: "REMOVE_LAST_ASSISTANT_MESSAGE" });
    expect(state.messages.some((message) => message.id === "msg-assistant")).toBe(false);

    state = reduce(state, { type: "FORCE_INCLUDE_NEXT_TURN", targetType: "storyCard", targetId: state.storyCards[0].id });
    expect(state.activeState.forceIncludeNextTurn).toHaveLength(1);

    state = reduce(state, { type: "SET_CHALLENGE_MODE" });
    expect(state.activeState.challengeMode).toBe(true);

    state = reduce(state, { type: "INCREMENT_TURN" });
    expect(state.activeState.turn).toBe(4);
    expect(state.activeState.forceIncludeNextTurn).toHaveLength(0);
    expect(state.activeState.challengeMode).toBe(false);

    state = reduce(state, { type: "UPDATE_ROLLING_SUMMARY", content: "new summary" });
    expect(state.rollingSummary.content).toBe("new summary");

    state = reduce(state, {
      type: "SET_TOKEN_BUDGET_SETTINGS",
      settings: {
        ...state.tokenBudgetSettings,
        maxContextTokens: 1234,
        maxRecentMessages: 2,
        recentMessageWindow: 1,
        sectionBudgets: { recentMessages: 99 },
      },
    });
    expect(state.tokenBudgetSettings.maxContextTokens).toBe(1234);

    state = reduce(state, {
      type: "SET_MODEL_CONFIG",
      config: { name: "openai-compatible", baseUrl: "https://example.test", apiKey: "secret", model: "model-a", temperature: 0.4, maxOutputTokens: 333 },
    });
    expect(state.modelConfig).toEqual({
      name: "openai-compatible",
      baseUrl: "https://example.test",
      model: "model-a",
      temperature: 0.4,
      maxOutputTokens: 333,
    });

    state = reduce(state, { type: "SET_STATE_FLAG", key: "doorOpen", value: true });
    expect(state.activeState.stateFlags.doorOpen).toBe(true);

    state = reduce(state, {
      type: "SET_SEMANTIC_EVALUATION_SETTINGS",
      settings: { evaluationModel: "eval-model", messagesIncluded: 6, enabled: false, showLog: false, maxParallelUpdateCalls: 2, requireApprovalForAutoUpdates: false, semanticEvalEveryNTurns: 1 },
    });
    expect(state.semanticEvaluationSettings.evaluationModel).toBe("eval-model");

    state = reduce(state, {
      type: "SET_NEXT_TURN_NOTE",
      note: {
        content: "Keep the next output focused on the oath.",
        pinned: false,
        protected: true,
        priority: 99,
        expiresAfterUse: true,
      },
    });
    expect(state.activeState.nextTurnNote).toMatchObject({
      content: "Keep the next output focused on the oath.",
      pinned: false,
      protected: true,
      priority: 99,
      expiresAfterUse: true,
    });

    state = reduce(state, { type: "CONSUME_NEXT_TURN_NOTE" });
    expect(state.activeState.nextTurnNote.content).toBe("");
    expect(state.activeState.nextTurnNote.protected).toBe(true);

    state = reduce(state, { type: "SET_NEXT_TURN_NOTE", note: { content: "Persistent note", expiresAfterUse: false } });
    state = reduce(state, { type: "CONSUME_NEXT_TURN_NOTE" });
    expect(state.activeState.nextTurnNote.content).toBe("Persistent note");

    state = reduce(state, { type: "CLEAR_NEXT_TURN_NOTE" });
    expect(state.activeState.nextTurnNote).toMatchObject({
      content: "",
      active: true,
      pinned: true,
      protected: false,
      priority: 85,
      expiresAfterUse: true,
    });

    state = reduce(state, {
      type: "QUEUE_PENDING_UPDATE",
      update: {
        id: "pending-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        source: "semanticEvaluation",
        actions: [{ type: "SET_TITLE", title: "Queued Title" }],
      },
    });
    expect(state.activeState.pendingUpdates).toHaveLength(1);
    state = reduce(state, { type: "FLUSH_PENDING_UPDATES" });
    expect(state.title).toBe("Queued Title");
    expect(state.activeState.pendingUpdates).toHaveLength(0);

    state = reduce(state, { type: "RESET_RUNTIME_STATE" });
    expect(state.messages).toEqual([]);
    expect(state.rollingSummary.content).toBe("");
    expect(state.activeState.turn).toBe(0);
    expect(state.activeState.nextTurnNote.content).toBe("");
    expect(state.triggerRules[0].lastFiredTurn).toBeUndefined();
  });

  it("handles every component action", () => {
    let state = baseAdventure();
    const component = makeComponent({ title: "Component C", content: "C", priority: 30 });
    state = reduce(state, { type: "UPSERT_COMPONENT", component });
    expect(state.components.find((entry) => entry.id === component.id)?.title).toBe("Component C");

    state = reduce(state, { type: "DEACTIVATE_COMPONENT", componentId: component.id });
    expect(state.components.find((entry) => entry.id === component.id)?.active).toBe(false);
    state = reduce(state, { type: "ACTIVATE_COMPONENT", componentId: component.id });
    expect(state.components.find((entry) => entry.id === component.id)?.active).toBe(true);
    state = reduce(state, { type: "PIN_COMPONENT", componentId: component.id });
    expect(state.components.find((entry) => entry.id === component.id)?.pinned).toBe(true);
    state = reduce(state, { type: "UNPIN_COMPONENT", componentId: component.id });
    expect(state.components.find((entry) => entry.id === component.id)?.pinned).toBe(false);
    state = reduce(state, { type: "UPDATE_COMPONENT", componentId: component.id, patch: { title: "Renamed", priority: 5 } });
    expect(state.components.find((entry) => entry.id === component.id)).toMatchObject({ title: "Renamed", priority: 5 });
    state = reduce(state, { type: "APPLY_COMPONENT_UPDATE", componentId: component.id, content: "Generated component" });
    expect(state.components.find((entry) => entry.id === component.id)?.content).toBe("Generated component");

    const before = state.components.find((entry) => entry.id === component.id)?.priority;
    state = reduce(state, { type: "REORDER_COMPONENT", componentId: component.id, direction: "up" });
    expect(state.components.find((entry) => entry.id === component.id)?.priority).not.toBe(before);

    state = reduce(state, { type: "DELETE_COMPONENT", componentId: component.id });
    expect(state.components.some((entry) => entry.id === component.id)).toBe(false);
  });

  it("handles every story card action", () => {
    let state = baseAdventure();
    const storyCard = makeStoryCard({ title: "Story C", content: "C", priority: 30 });
    state = reduce(state, { type: "UPSERT_STORY_CARD", storyCard });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.title).toBe("Story C");

    state = reduce(state, { type: "DEACTIVATE_STORY_CARD", storyCardId: storyCard.id });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.active).toBe(false);
    state = reduce(state, { type: "ACTIVATE_STORY_CARD", storyCardId: storyCard.id });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.active).toBe(true);
    state = reduce(state, { type: "PIN_STORY_CARD", storyCardId: storyCard.id });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.pinned).toBe(true);
    state = reduce(state, { type: "UNPIN_STORY_CARD", storyCardId: storyCard.id });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.pinned).toBe(false);
    state = reduce(state, { type: "UPDATE_STORY_CARD", storyCardId: storyCard.id, patch: { title: "Story Renamed", priority: 5 } });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)).toMatchObject({ title: "Story Renamed", priority: 5 });
    state = reduce(state, { type: "APPLY_STORY_CARD_UPDATE", storyCardId: storyCard.id, content: "Generated story" });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.content).toBe("Generated story");
    state = reduce(state, { type: "MARK_STORY_CARD_UPDATED", storyCardId: storyCard.id, turn: 12 });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.lastAutoUpdateTurn).toBe(12);

    const before = state.storyCards.find((entry) => entry.id === storyCard.id)?.priority;
    state = reduce(state, { type: "REORDER_STORY_CARD", storyCardId: storyCard.id, direction: "up" });
    expect(state.storyCards.find((entry) => entry.id === storyCard.id)?.priority).not.toBe(before);

    state = reduce(state, { type: "DELETE_STORY_CARD", storyCardId: storyCard.id });
    expect(state.storyCards.some((entry) => entry.id === storyCard.id)).toBe(false);
  });

  it("handles every brain action", () => {
    let state = baseAdventure();
    const brain = makeBrain({ characterName: "Noor" });
    state = reduce(state, { type: "UPSERT_BRAIN", brain });
    expect(state.brains.find((entry) => entry.id === brain.id)?.characterName).toBe("Noor");

    state = reduce(state, { type: "DEACTIVATE_BRAIN", brainId: brain.id });
    expect(state.brains.find((entry) => entry.id === brain.id)?.active).toBe(false);
    state = reduce(state, { type: "ACTIVATE_BRAIN", brainId: brain.id });
    expect(state.brains.find((entry) => entry.id === brain.id)?.active).toBe(true);
    state = reduce(state, { type: "PIN_BRAIN", brainId: brain.id });
    expect(state.brains.find((entry) => entry.id === brain.id)?.pinned).toBe(true);
    state = reduce(state, { type: "UNPIN_BRAIN", brainId: brain.id });
    expect(state.brains.find((entry) => entry.id === brain.id)?.pinned).toBe(false);
    state = reduce(state, { type: "UPDATE_BRAIN", brainId: brain.id, patch: { thoughts: { seed: "1 → thinking" } } });
    expect(state.brains.find((entry) => entry.id === brain.id)?.thoughts).toEqual({ seed: "1 → thinking" });
    // APPEND_BRAIN_STATE with field "thoughts" is a no-op (thoughts is a Record, not appendable by string)
    state = reduce(state, { type: "APPEND_BRAIN_STATE", brainId: brain.id, field: "thoughts", text: "more" });
    expect(state.brains.find((entry) => entry.id === brain.id)?.thoughts).toEqual({ seed: "1 → thinking" });
    state = reduce(state, { type: "REPLACE_BRAIN_STATE", brainId: brain.id, field: "currentState", text: "steady" });
    expect(state.brains.find((entry) => entry.id === brain.id)?.currentState).toBe("steady");
    state = reduce(state, {
      type: "APPLY_BRAIN_UPDATE",
      brainId: brain.id,
      patch: { thoughts: { generated: "12 → generated thought" } },
      mode: "replace",
      turn: 12,
      preview: "preview",
    });
    expect(state.brains.find((entry) => entry.id === brain.id)).toMatchObject({
      thoughts: { generated: "12 → generated thought" },
      lastUpdatedTurn: 12,
      lastGeneratedUpdatePreview: "preview",
    });

    state = reduce(state, { type: "DELETE_BRAIN", brainId: brain.id });
    expect(state.brains.some((entry) => entry.id === brain.id)).toBe(false);
  });

  it("handles every trigger rule action", () => {
    let state = baseAdventure();
    const triggerRule = makeTriggerRule({ name: "Rule C", priority: 7 });
    state = reduce(state, { type: "UPSERT_TRIGGER_RULE", triggerRule });
    expect(state.triggerRules.find((entry) => entry.id === triggerRule.id)?.name).toBe("Rule C");

    state = reduce(state, { type: "UPDATE_TRIGGER_RULE", triggerRuleId: triggerRule.id, patch: { enabled: false } });
    expect(state.triggerRules.find((entry) => entry.id === triggerRule.id)?.enabled).toBe(false);
    state = reduce(state, { type: "MARK_TRIGGER_FIRED", triggerRuleId: triggerRule.id, turn: 11 });
    expect(state.triggerRules.find((entry) => entry.id === triggerRule.id)?.lastFiredTurn).toBe(11);

    const logEntry: TriggerLogEntry = {
      id: "log-1",
      triggerRuleId: triggerRule.id,
      triggerName: "Rule C",
      source: "input",
      turn: 11,
      matchedPattern: "door",
      textSnippet: "open door",
      actionCount: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    state = reduce(state, { type: "LOG_TRIGGER_FIRE", entry: logEntry });
    expect(state.activeState.triggerLog[0]).toBe(logEntry);
    state = reduce(state, {
      type: "LOG_EVALUATION_RESULT",
      entry: {
        id: "eval-1",
        turn: 11,
        createdAt: "2026-01-01T00:00:00.000Z",
        conditionsEvaluated: [],
        conditionsFired: [],
        actionsExecuted: [],
        generatedContent: [],
        errors: [],
      },
    });
    expect(state.activeState.evaluationLog[0].id).toBe("eval-1");

    state = reduce(state, { type: "DELETE_TRIGGER_RULE", triggerRuleId: triggerRule.id });
    expect(state.triggerRules.some((entry) => entry.id === triggerRule.id)).toBe(false);
  });

  it("handles force include and raw import actions", () => {
    let state = baseAdventure();

    state = reduce(state, { type: "FORCE_INCLUDE_NEXT_TURN", targetType: "brain", targetId: state.brains[0].id });
    expect(state.activeState.forceIncludeNextTurn[0]).toMatchObject({ targetType: "brain", targetId: state.brains[0].id });

    const rawImport: RawImportEntry = {
      id: "raw-1",
      source: "json",
      type: "raw",
      title: "Raw",
      content: "raw text",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    state = reduce(state, { type: "ADD_RAW_IMPORT", rawImport });
    expect(state.activeState.rawImports[0]).toBe(rawImport);
    state = reduce(state, { type: "UPDATE_RAW_IMPORT", rawImportId: rawImport.id, patch: { title: "Raw Edited" } });
    expect(state.activeState.rawImports[0].title).toBe("Raw Edited");
    state = reduce(state, { type: "DELETE_RAW_IMPORT", rawImportId: rawImport.id });
    expect(state.activeState.rawImports).toHaveLength(0);
  });

  it("handles memory proposal approval, rejection, and ignore actions", () => {
    let state = baseAdventure();
    const storyProposal = makeMemoryProposal({
      id: "proposal-story",
      proposedType: "storyCard",
      title: "Promise",
      content: "Seth promised Margo he would return.",
      suggestedTriggers: ["Seth", "Margo", "promise"],
    });

    state = reduce(state, { type: "ADD_MEMORY_PROPOSAL", proposal: storyProposal });
    expect(state.activeState.memoryProposals[0].status).toBe("pending");

    state = reduce(state, {
      type: "UPDATE_MEMORY_PROPOSAL",
      proposalId: "proposal-story",
      patch: { confidence: 0.75 },
    });
    expect(state.activeState.memoryProposals[0].confidence).toBe(0.75);

    state = reduce(state, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "proposal-story" });
    expect(state.activeState.memoryProposals[0].status).toBe("approved");
    expect(state.storyCards.some((card) => card.title === "Promise" && card.keys.includes("promise"))).toBe(true);

    const brain = makeBrain({ id: "brain-proposal", characterName: "Margo", recentDevelopments: "old" });
    const brainProposal = makeMemoryProposal({
      id: "proposal-brain",
      proposedType: "brainUpdate",
      targetId: "brain-proposal",
      title: "Margo",
      content: "Margo feels jealous but hides it.",
    });
    state = reduce({ ...state, brains: [...state.brains, brain] }, { type: "ADD_MEMORY_PROPOSAL", proposal: brainProposal });
    state = reduce(state, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "proposal-brain" });
    expect(state.brains.find((entry) => entry.id === "brain-proposal")?.recentDevelopments).toContain("Margo feels jealous");

    const plotProposal = makeMemoryProposal({
      id: "proposal-plot",
      proposedType: "plotEssentialsUpdate",
      title: "Tonight",
      content: "The Beast is actively hunting Seth tonight.",
    });
    state = reduce(state, { type: "ADD_MEMORY_PROPOSAL", proposal: plotProposal });
    state = reduce(state, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "proposal-plot" });
    expect(state.components.some((component) => component.type === "plotEssentials" && component.content.includes("Beast"))).toBe(true);

    const summaryProposal = makeMemoryProposal({
      id: "proposal-summary",
      proposedType: "summaryUpdate",
      title: "Summary",
      content: "Seth and Margo reached the old city.",
    });
    state = reduce(state, { type: "ADD_MEMORY_PROPOSAL", proposal: summaryProposal });
    state = reduce(state, { type: "APPROVE_MEMORY_PROPOSAL", proposalId: "proposal-summary" });
    expect(state.rollingSummary.content).toBe("Seth and Margo reached the old city.");

    const rejected = makeMemoryProposal({ id: "proposal-reject", status: "pending" });
    state = reduce(state, { type: "ADD_MEMORY_PROPOSAL", proposal: rejected });
    state = reduce(state, { type: "REJECT_MEMORY_PROPOSAL", proposalId: "proposal-reject" });
    expect(state.activeState.memoryProposals.find((proposal) => proposal.id === "proposal-reject")?.status).toBe("rejected");

    const ignored = makeMemoryProposal({ id: "proposal-ignore", status: "pending" });
    state = reduce(state, { type: "ADD_MEMORY_PROPOSAL", proposal: ignored });
    state = reduce(state, { type: "IGNORE_MEMORY_PROPOSAL", proposalId: "proposal-ignore" });
    expect(state.activeState.memoryProposals.find((proposal) => proposal.id === "proposal-ignore")?.status).toBe("ignored");
  });

  it("tracks story text undo and redo for adds, edits, erases, and opening scene edits", () => {
    let state = baseAdventure();

    state = reduce(state, { type: "ADD_MESSAGE", id: "msg-3", role: "user", content: "I open the door.", createdAt: "2026-01-01T00:02:00.000Z" });
    expect(state.messages.at(-1)?.id).toBe("msg-3");
    expect(state.activeState.storyUndoStack[0].label).toBe("Add entered section");

    state = reduce(state, { type: "UNDO_STORY_EDIT" });
    expect(state.messages.some((message) => message.id === "msg-3")).toBe(false);
    expect(state.activeState.storyRedoStack).toHaveLength(1);

    state = reduce(state, { type: "REDO_STORY_EDIT" });
    expect(state.messages.at(-1)?.id).toBe("msg-3");
    expect(state.activeState.storyRedoStack).toHaveLength(0);

    state = reduce(state, { type: "UPDATE_MESSAGE", messageId: "msg-3", content: "I open the iron door." });
    expect(state.messages.find((message) => message.id === "msg-3")?.content).toBe("I open the iron door.");
    state = reduce(state, { type: "UNDO_STORY_EDIT" });
    expect(state.messages.find((message) => message.id === "msg-3")?.content).toBe("I open the door.");
    state = reduce(state, { type: "REDO_STORY_EDIT" });
    expect(state.messages.find((message) => message.id === "msg-3")?.content).toBe("I open the iron door.");

    state = reduce(state, { type: "DELETE_LAST_MESSAGE" });
    expect(state.messages.some((message) => message.id === "msg-3")).toBe(false);
    state = reduce(state, { type: "UNDO_STORY_EDIT" });
    expect(state.messages.at(-1)?.id).toBe("msg-3");

    expect(state.activeState.storyUndoStack.length).toBeGreaterThan(0);
  });

  it("clamps rolling summary indexes when story sections are erased or reset", () => {
    let state: Adventure = {
      ...baseAdventure(),
      rollingSummary: {
        content: "The current transcript has already been summarized.",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastSummarizedMessageIndex: 2,
      },
    };

    state = reduce(state, { type: "DELETE_LAST_MESSAGE" });
    expect(state.messages).toHaveLength(1);
    expect(state.rollingSummary.lastSummarizedMessageIndex).toBe(1);

    state = reduce(state, { type: "RESET_RUNTIME_STATE" });
    expect(state.messages).toHaveLength(0);
    expect(state.rollingSummary.lastSummarizedMessageIndex).toBeUndefined();
  });
});
