import type {
  Adventure,
  AdventureAction,
  AutoCard,
  AutoCardReviewItem,
  BrainEntry,
  BrainStateField,
  ComponentEntry,
  MemoryProposal,
  Message,
  ProviderConfig,
  Quest,
  RawImportEntry,
  StoryEditHistoryEntry,
  StoryEditPatch,
  StoryCard,
  TriggerRule,
} from "../types/adventure";
import { completeQuest, failQuest, progressQuest, startQuest } from "../quests/questEngine";
import { defaultNextTurnNote, makeComponent, makeStoryCard } from "./defaults";
import { createId, nowIso } from "../utils/id";

function touch<T extends { updatedAt: string }>(entry: T): T {
  return { ...entry, updatedAt: nowIso() };
}

function touchAdventure(state: Adventure, patch: Partial<Adventure>): Adventure {
  const next = { ...state, ...patch, updatedAt: nowIso() };
  const summarizedIndex = next.rollingSummary.lastSummarizedMessageIndex;
  if (summarizedIndex !== undefined && summarizedIndex > next.messages.length) {
    return {
      ...next,
      rollingSummary: {
        ...next.rollingSummary,
        lastSummarizedMessageIndex: next.messages.length,
      },
    };
  }
  return next;
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  return items.map((existing) => (existing.id === item.id ? item : existing));
}

function updateById<T extends { id: string; updatedAt?: string }>(
  items: T[],
  id: string,
  updater: (item: T) => T,
): T[] {
  return items.map((item) => (item.id === id ? updater(item) : item));
}

function deleteById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

function moveByPriority<T extends { id: string; priority: number; updatedAt: string }>(
  items: T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const sorted = [...items].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const index = sorted.findIndex((item) => item.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= sorted.length) return items;
  const current = sorted[index];
  const other = sorted[swapIndex];
  return items.map((item) => {
    if (item.id === current.id) return touch({ ...item, priority: other.priority });
    if (item.id === other.id) return touch({ ...item, priority: current.priority });
    return item;
  });
}

function mergePatch<T extends { updatedAt: string }>(item: T, patch: Partial<T>): T {
  const sanitizedPatch = { ...patch };
  delete sanitizedPatch.updatedAt;
  return touch({ ...item, ...sanitizedPatch });
}

function updateBrainField(brain: BrainEntry, field: BrainStateField | undefined, text: string, mode: "append" | "replace"): BrainEntry {
  const targetField = field ?? "currentState";
  const current = brain[targetField];
  const nextValue = mode === "append" ? [current, text].filter(Boolean).join("\n") : text;
  return touch({ ...brain, [targetField]: nextValue });
}

function applyBrainUpdate(
  brain: BrainEntry,
  patch: Partial<Record<BrainStateField, string>>,
  mode: "replace" | "append" = "replace",
  turn?: number,
  preview?: string,
): BrainEntry {
  const timestamp = nowIso();
  if (mode === "append") {
    const perField: Partial<Record<BrainStateField, string>> = {};
    for (const [key, value] of Object.entries(patch) as [BrainStateField, string][]) {
      const existing = brain[key];
      perField[key] = existing ? `${existing}\n${value}` : value;
    }
    return touch({
      ...brain,
      ...perField,
      lastUpdatedTurn: turn ?? brain.lastUpdatedTurn,
      lastUpdatedAt: timestamp,
      lastGeneratedUpdatePreview: preview ?? JSON.stringify(patch).slice(0, 500),
    });
  }

  return touch({
    ...brain,
    ...patch,
    lastUpdatedTurn: turn ?? brain.lastUpdatedTurn,
    lastUpdatedAt: timestamp,
    lastGeneratedUpdatePreview: preview ?? JSON.stringify(patch).slice(0, 500),
  });
}

function stripProviderKey(config: ProviderConfig): ProviderConfig {
  const { apiKey: _apiKey, ...safeConfig } = config;
  return safeConfig;
}

function addMessage(state: Adventure, action: Extract<AdventureAction, { type: "ADD_MESSAGE" }>): Message {
  return {
    id: action.id ?? createId("msg"),
    role: action.role,
    content: action.content,
    inputMode: action.inputMode,
    usage: action.usage,
    createdAt: action.createdAt ?? nowIso(),
  };
}

const STORY_HISTORY_LIMIT = 100;

function applyStoryPatch(state: Adventure, patch: StoryEditPatch): Partial<Adventure> {
  if (patch.type === "insertMessage") {
    const index = patch.index ?? state.messages.length;
    return {
      messages: [
        ...state.messages.slice(0, index),
        patch.message,
        ...state.messages.slice(index),
      ],
    };
  }
  if (patch.type === "deleteMessage") {
    return { messages: deleteById(state.messages, patch.messageId) };
  }
  if (patch.type === "updateMessage") {
    return {
      messages: state.messages.map((message) =>
        message.id === patch.messageId ? { ...message, content: patch.content } : message,
      ),
    };
  }
  return { openingScene: patch.content };
}

function storyHistoryEntry(label: string, undo: StoryEditPatch, redo: StoryEditPatch): StoryEditHistoryEntry {
  return {
    id: createId("storyEdit"),
    label,
    createdAt: nowIso(),
    undo,
    redo,
  };
}

function withStoryHistory(state: Adventure, patch: Partial<Adventure>, entry: StoryEditHistoryEntry): Adventure {
  return touchAdventure(state, {
    ...patch,
    activeState: {
      ...state.activeState,
      storyUndoStack: [entry, ...state.activeState.storyUndoStack].slice(0, STORY_HISTORY_LIMIT),
      storyRedoStack: [],
    },
  });
}

function undoStoryEdit(state: Adventure): Adventure {
  const [entry, ...remaining] = state.activeState.storyUndoStack;
  if (!entry) return state;
  return touchAdventure(state, {
    ...applyStoryPatch(state, entry.undo),
    activeState: {
      ...state.activeState,
      storyUndoStack: remaining,
      storyRedoStack: [entry, ...state.activeState.storyRedoStack].slice(0, STORY_HISTORY_LIMIT),
    },
  });
}

function redoStoryEdit(state: Adventure): Adventure {
  const [entry, ...remaining] = state.activeState.storyRedoStack;
  if (!entry) return state;
  return touchAdventure(state, {
    ...applyStoryPatch(state, entry.redo),
    activeState: {
      ...state.activeState,
      storyUndoStack: [entry, ...state.activeState.storyUndoStack].slice(0, STORY_HISTORY_LIMIT),
      storyRedoStack: remaining,
    },
  });
}

function resetQuestRuntime(quest: Quest): Quest {
  return touch({
    ...quest,
    status: "inactive",
    currentStepId: undefined,
    steps: quest.steps.map((step) => ({ ...step, status: "pending" })),
  });
}

function makeReviewStoryCard(review: AutoCardReviewItem, patch?: Partial<Pick<AutoCardReviewItem, "title" | "content" | "keys">>): StoryCard {
  return makeStoryCard({
    title: patch?.title ?? review.title,
    content: patch?.content ?? review.content,
    keys: patch?.keys ?? review.keys,
    type: "custom",
    active: true,
    pinned: false,
    priority: 0,
    state: "generated",
  });
}

function updateMemoryProposal(proposal: MemoryProposal, patch: Partial<MemoryProposal>): MemoryProposal {
  const sanitizedPatch = { ...patch };
  delete sanitizedPatch.updatedAt;
  return { ...proposal, ...sanitizedPatch, updatedAt: nowIso() };
}

function proposalWithEdits(proposal: MemoryProposal, editedProposal?: Partial<MemoryProposal>): MemoryProposal {
  return editedProposal ? updateMemoryProposal(proposal, editedProposal) : proposal;
}

function applyApprovedMemoryProposal(state: Adventure, proposal: MemoryProposal): Partial<Adventure> {
  if (proposal.proposedType === "storyCard") {
    const existing = state.storyCards.find((card) => card.id === proposal.targetId || card.title === proposal.title);
    const storyCard = existing
      ? touch({
          ...existing,
          content: proposal.content,
          keys: proposal.suggestedTriggers,
          state: [existing.state, "memoryProposal"].filter(Boolean).join(" "),
        })
      : makeStoryCard({
          title: proposal.title || "Memory Proposal",
          content: proposal.content,
          keys: proposal.suggestedTriggers,
          type: "custom",
          active: true,
          pinned: false,
          state: "memoryProposal",
        });
    return { storyCards: upsertById(state.storyCards, storyCard) };
  }

  if (proposal.proposedType === "brainUpdate") {
    const existing = state.brains.find((brain) => brain.id === proposal.targetId || brain.characterName === proposal.title);
    if (!existing) {
      const storyCard = makeStoryCard({
        title: proposal.title || "Memory Proposal",
        content: proposal.content,
        keys: proposal.suggestedTriggers,
        type: "character",
        active: true,
        state: "memoryProposal routedFromMissingBrain",
      });
      return { storyCards: upsertById(state.storyCards, storyCard) };
    }
    // Content may be a JSON patch (from auto-update flow) or a plain string (from Remember This)
    let parsedPatch: Partial<Record<BrainStateField, string>> | null = null;
    try {
      const parsed: unknown = JSON.parse(proposal.content);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const allowed: BrainStateField[] = ["currentState", "thoughts", "relationshipPressure", "emotionalInterpretation", "recentDevelopments"];
        const entries = Object.entries(parsed as Record<string, unknown>).filter(([k, v]) => allowed.includes(k as BrainStateField) && typeof v === "string");
        if (entries.length > 0) parsedPatch = Object.fromEntries(entries) as Partial<Record<BrainStateField, string>>;
      }
    } catch {
      // Not JSON — fall through to plain-string append
    }
    const brain = parsedPatch
      ? applyBrainUpdate(existing, parsedPatch, "append", state.activeState.turn, proposal.content.slice(0, 500))
      : touch({
          ...existing,
          recentDevelopments: [existing.recentDevelopments, proposal.content].filter(Boolean).join("\n"),
          lastUpdatedTurn: state.activeState.turn,
          lastUpdatedAt: nowIso(),
          lastGeneratedUpdatePreview: proposal.content.slice(0, 500),
        });
    return { brains: upsertById(state.brains, brain) };
  }

  if (proposal.proposedType === "plotEssentialsUpdate") {
    const target =
      state.components.find((component) => component.id === proposal.targetId && component.type === "plotEssentials") ??
      state.components.find((component) => component.type === "plotEssentials");
    const component = target
      ? touch({ ...target, content: proposal.content })
      : makeComponent({
          title: proposal.title || "Plot Essentials",
          type: "plotEssentials",
          content: proposal.content,
          active: true,
          alwaysOn: false,
          pinned: false,
          priority: 250,
        });
    return { components: upsertById(state.components, component) };
  }

  if (proposal.proposedType === "summaryUpdate") {
    return { rollingSummary: { content: proposal.content, updatedAt: nowIso() } };
  }

  return {};
}

export function adventureReducer(state: Adventure, action: AdventureAction): Adventure {
  switch (action.type) {
    case "SET_TITLE":
      return touchAdventure(state, { title: action.title });
    case "SET_OPENING_SCENE":
      return touchAdventure(state, { openingScene: action.content });
    case "UPDATE_METADATA":
      return touchAdventure(state, { metadata: { ...state.metadata, ...action.metadata } });
    case "ADD_MESSAGE": {
      const message = addMessage(state, action);
      const index = state.messages.length;
      return withStoryHistory(
        state,
        { messages: [...state.messages, message] },
        storyHistoryEntry(
          action.role === "assistant" ? "Add generated section" : "Add entered section",
          { type: "deleteMessage", messageId: message.id },
          { type: "insertMessage", message, index },
        ),
      );
    }
    case "UPDATE_MESSAGE": {
      const existing = state.messages.find((message) => message.id === action.messageId);
      if (!existing || existing.content === action.content) return state;
      return withStoryHistory(
        state,
        {
          messages: state.messages.map((message) =>
            message.id === action.messageId ? { ...message, content: action.content } : message,
          ),
        },
        storyHistoryEntry(
          "Edit story section",
          { type: "updateMessage", messageId: action.messageId, content: existing.content },
          { type: "updateMessage", messageId: action.messageId, content: action.content },
        ),
      );
    }
    case "DELETE_MESSAGE": {
      const index = state.messages.findIndex((message) => message.id === action.messageId);
      const message = state.messages[index];
      if (!message) return state;
      return withStoryHistory(
        state,
        { messages: state.messages.filter((entry) => entry.id !== action.messageId) },
        storyHistoryEntry(
          "Erase story section",
          { type: "insertMessage", message, index },
          { type: "deleteMessage", messageId: message.id },
        ),
      );
    }
    case "DELETE_LAST_MESSAGE": {
      const index = state.messages.length - 1;
      const message = state.messages[index];
      if (!message) return state;
      return withStoryHistory(
        state,
        { messages: state.messages.slice(0, -1) },
        storyHistoryEntry(
          message.role === "assistant" ? "Erase last generated section" : "Erase last entered section",
          { type: "insertMessage", message, index },
          { type: "deleteMessage", messageId: message.id },
        ),
      );
    }
    case "REMOVE_LAST_ASSISTANT_MESSAGE": {
      const index = [...state.messages].reverse().findIndex((message) => message.role === "assistant");
      if (index === -1) return state;
      const removeIndex = state.messages.length - 1 - index;
      const message = state.messages[removeIndex];
      return withStoryHistory(
        state,
        { messages: state.messages.filter((_, itemIndex) => itemIndex !== removeIndex) },
        storyHistoryEntry(
          "Erase last generated section",
          { type: "insertMessage", message, index: removeIndex },
          { type: "deleteMessage", messageId: message.id },
        ),
      );
    }
    case "UNDO_STORY_EDIT":
      return undoStoryEdit(state);
    case "REDO_STORY_EDIT":
      return redoStoryEdit(state);
    case "INCREMENT_TURN":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          turn: state.activeState.turn + 1,
          forceIncludeNextTurn: state.activeState.forceIncludeNextTurn.filter(
            (entry) => entry.expiresTurn > state.activeState.turn + 1,
          ),
        },
      });
    case "UPSERT_COMPONENT":
      return touchAdventure(state, { components: upsertById(state.components, touch(action.component)) });
    case "DELETE_COMPONENT":
      return touchAdventure(state, { components: deleteById(state.components, action.componentId) });
    case "ACTIVATE_COMPONENT":
      return touchAdventure(state, { components: updateById(state.components, action.componentId, (item) => touch({ ...item, active: true })) });
    case "DEACTIVATE_COMPONENT":
      return touchAdventure(state, { components: updateById(state.components, action.componentId, (item) => touch({ ...item, active: false })) });
    case "PIN_COMPONENT":
      return touchAdventure(state, { components: updateById(state.components, action.componentId, (item) => touch({ ...item, pinned: true })) });
    case "UNPIN_COMPONENT":
      return touchAdventure(state, { components: updateById(state.components, action.componentId, (item) => touch({ ...item, pinned: false })) });
    case "UPDATE_COMPONENT":
      return touchAdventure(state, {
        components: updateById(state.components, action.componentId, (item) => mergePatch<ComponentEntry>(item, action.patch)),
      });
    case "APPLY_COMPONENT_UPDATE":
      return touchAdventure(state, {
        components: updateById(state.components, action.componentId, (item) => touch({ ...item, content: action.content })),
      });
    case "REORDER_COMPONENT":
      return touchAdventure(state, { components: moveByPriority(state.components, action.componentId, action.direction) });
    case "UPSERT_STORY_CARD":
      return touchAdventure(state, { storyCards: upsertById(state.storyCards, touch(action.storyCard)) });
    case "DELETE_STORY_CARD":
      return touchAdventure(state, { storyCards: deleteById(state.storyCards, action.storyCardId) });
    case "ACTIVATE_STORY_CARD":
      return touchAdventure(state, { storyCards: updateById(state.storyCards, action.storyCardId, (item) => touch({ ...item, active: true })) });
    case "DEACTIVATE_STORY_CARD":
      return touchAdventure(state, { storyCards: updateById(state.storyCards, action.storyCardId, (item) => touch({ ...item, active: false })) });
    case "PIN_STORY_CARD":
      return touchAdventure(state, { storyCards: updateById(state.storyCards, action.storyCardId, (item) => touch({ ...item, pinned: true })) });
    case "UNPIN_STORY_CARD":
      return touchAdventure(state, { storyCards: updateById(state.storyCards, action.storyCardId, (item) => touch({ ...item, pinned: false })) });
    case "UPDATE_STORY_CARD":
      return touchAdventure(state, {
        storyCards: updateById(state.storyCards, action.storyCardId, (item) => mergePatch<StoryCard>(item, action.patch)),
      });
    case "APPLY_STORY_CARD_UPDATE":
      return touchAdventure(state, {
        storyCards: updateById(state.storyCards, action.storyCardId, (item) => touch({ ...item, content: action.content })),
      });
    case "MARK_STORY_CARD_UPDATED":
      return touchAdventure(state, {
        storyCards: updateById(state.storyCards, action.storyCardId, (item) => touch({ ...item, lastAutoUpdateTurn: action.turn })),
      });
    case "REORDER_STORY_CARD":
      return touchAdventure(state, { storyCards: moveByPriority(state.storyCards, action.storyCardId, action.direction) });
    case "UPSERT_BRAIN":
      return touchAdventure(state, { brains: upsertById(state.brains, touch(action.brain)) });
    case "DELETE_BRAIN":
      return touchAdventure(state, { brains: deleteById(state.brains, action.brainId) });
    case "ACTIVATE_BRAIN":
      return touchAdventure(state, { brains: updateById(state.brains, action.brainId, (item) => touch({ ...item, active: true })) });
    case "DEACTIVATE_BRAIN":
      return touchAdventure(state, { brains: updateById(state.brains, action.brainId, (item) => touch({ ...item, active: false })) });
    case "PIN_BRAIN":
      return touchAdventure(state, { brains: updateById(state.brains, action.brainId, (item) => touch({ ...item, pinned: true })) });
    case "UNPIN_BRAIN":
      return touchAdventure(state, { brains: updateById(state.brains, action.brainId, (item) => touch({ ...item, pinned: false })) });
    case "UPDATE_BRAIN":
      return touchAdventure(state, {
        brains: updateById(state.brains, action.brainId, (item) => mergePatch<BrainEntry>(item, action.patch)),
      });
    case "APPEND_BRAIN_STATE":
      return touchAdventure(state, {
        brains: updateById(state.brains, action.brainId, (item) => updateBrainField(item, action.field, action.text, "append")),
      });
    case "REPLACE_BRAIN_STATE":
      return touchAdventure(state, {
        brains: updateById(state.brains, action.brainId, (item) => updateBrainField(item, action.field, action.text, "replace")),
      });
    case "APPLY_BRAIN_UPDATE":
      return touchAdventure(state, {
        brains: updateById(state.brains, action.brainId, (item) =>
          applyBrainUpdate(item, action.patch, action.mode, action.turn, action.preview),
        ),
      });
    case "UPSERT_AUTO_CARD":
      return touchAdventure(state, { autoCards: upsertById(state.autoCards, touch(action.autoCard)) });
    case "DELETE_AUTO_CARD":
      return touchAdventure(state, { autoCards: deleteById(state.autoCards, action.autoCardId) });
    case "ACTIVATE_AUTO_CARD":
      return touchAdventure(state, { autoCards: updateById(state.autoCards, action.autoCardId, (item) => touch({ ...item, active: true })) });
    case "DEACTIVATE_AUTO_CARD":
      return touchAdventure(state, { autoCards: updateById(state.autoCards, action.autoCardId, (item) => touch({ ...item, active: false })) });
    case "UPDATE_AUTO_CARD":
      return touchAdventure(state, {
        autoCards: updateById(state.autoCards, action.autoCardId, (item) => mergePatch<AutoCard>(item, action.patch)),
      });
    case "MARK_AUTO_CARD_UPDATED":
      return touchAdventure(state, {
        autoCards: updateById(state.autoCards, action.autoCardId, (item) => touch({ ...item, lastUpdatedTurn: action.turn })),
      });
    case "CREATE_AUTO_CARD": {
      const timestamp = nowIso();
      const review: AutoCardReviewItem = {
        id: createId("review"),
        title: action.title,
        content: action.content,
        keys: action.keys,
        source: "generated",
        generatedAtTurn: action.turn,
        conditionId: action.conditionId,
        rawResponse: action.rawResponse,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          autoCardReviewQueue: [review, ...state.activeState.autoCardReviewQueue],
        },
        autoCardSettings: { ...state.autoCardSettings, lastGeneratedTurn: action.turn },
      });
    }
    case "APPROVE_AUTO_CARD": {
      const review = state.activeState.autoCardReviewQueue.find((entry) => entry.id === action.reviewId);
      if (!review) return state;
      return touchAdventure(state, {
        storyCards: [...state.storyCards, makeReviewStoryCard(review, action.patch)],
        activeState: {
          ...state.activeState,
          autoCardReviewQueue: state.activeState.autoCardReviewQueue.filter((entry) => entry.id !== action.reviewId),
        },
      });
    }
    case "DISCARD_AUTO_CARD":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          autoCardReviewQueue: state.activeState.autoCardReviewQueue.filter((entry) => entry.id !== action.reviewId),
        },
      });
    case "UPSERT_TRIGGER_RULE":
      return touchAdventure(state, { triggerRules: upsertById(state.triggerRules, touch(action.triggerRule)) });
    case "DELETE_TRIGGER_RULE":
      return touchAdventure(state, { triggerRules: deleteById(state.triggerRules, action.triggerRuleId) });
    case "UPDATE_TRIGGER_RULE":
      return touchAdventure(state, {
        triggerRules: updateById(state.triggerRules, action.triggerRuleId, (item) => mergePatch<TriggerRule>(item, action.patch)),
      });
    case "MARK_TRIGGER_FIRED":
      return touchAdventure(state, {
        triggerRules: updateById(state.triggerRules, action.triggerRuleId, (item) => touch({ ...item, lastFiredTurn: action.turn })),
      });
    case "LOG_TRIGGER_FIRE":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          triggerLog: [action.entry, ...state.activeState.triggerLog].slice(0, 200),
        },
      });
    case "LOG_EVALUATION_RESULT":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          evaluationLog: [action.entry, ...state.activeState.evaluationLog].slice(0, 100),
        },
      });
    case "UPSERT_QUEST":
      return touchAdventure(state, { quests: upsertById(state.quests, touch(action.quest)) });
    case "DELETE_QUEST":
      return touchAdventure(state, { quests: deleteById(state.quests, action.questId) });
    case "START_QUEST":
      return touchAdventure(state, { quests: updateById(state.quests, action.questId, startQuest) });
    case "PROGRESS_QUEST":
      return touchAdventure(state, { quests: updateById(state.quests, action.questId, (quest) => progressQuest(quest, action.stepId)) });
    case "COMPLETE_QUEST":
      return touchAdventure(state, { quests: updateById(state.quests, action.questId, completeQuest) });
    case "COMPLETE_QUEST_STEP":
      return touchAdventure(state, {
        quests: updateById(state.quests, action.questId, (quest) => progressQuest(quest, action.stepId ?? quest.currentStepId)),
      });
    case "FAIL_QUEST":
      return touchAdventure(state, { quests: updateById(state.quests, action.questId, failQuest) });
    case "ACTIVATE_QUEST_CARD": {
      const quest = state.quests.find((item) => item.id === action.questId);
      const targetIds = action.storyCardId ? [action.storyCardId] : quest?.relatedCards ?? [];
      return touchAdventure(state, {
        storyCards: state.storyCards.map((card) => (targetIds.includes(card.id) ? touch({ ...card, active: true }) : card)),
      });
    }
    case "CREATE_MILESTONE_CARD": {
      const storyCard = makeStoryCard({
        title: action.title,
        content: action.content,
        type: "plot",
        active: true,
        pinned: false,
        priority: 50,
        keys: action.questId ? [action.questId, action.title] : [action.title],
      });
      return touchAdventure(state, { storyCards: [...state.storyCards, storyCard] });
    }
    case "FORCE_INCLUDE_NEXT_TURN":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          forceIncludeNextTurn: [
            ...state.activeState.forceIncludeNextTurn.filter(
              (entry) => !(entry.targetType === action.targetType && entry.targetId === action.targetId),
            ),
            {
              id: createId("force"),
              targetType: action.targetType,
              targetId: action.targetId,
              expiresTurn: state.activeState.turn + 1,
              createdAt: nowIso(),
            },
          ],
        },
      });
    case "ADD_RAW_IMPORT":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          rawImports: [action.rawImport, ...state.activeState.rawImports],
        },
      });
    case "UPDATE_RAW_IMPORT":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          rawImports: updateById(state.activeState.rawImports, action.rawImportId, (entry) =>
            touch({ ...entry, ...action.patch } as RawImportEntry),
          ),
        },
      });
    case "DELETE_RAW_IMPORT":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          rawImports: deleteById(state.activeState.rawImports, action.rawImportId),
        },
      });
    case "ADD_MEMORY_PROPOSAL": {
      const autoApprove = state.memoryAutoApprove?.[action.proposal.proposedType as keyof typeof state.memoryAutoApprove] ?? false;
      if (autoApprove) {
        const approved = updateMemoryProposal(action.proposal, { status: "approved" });
        return touchAdventure(state, {
          ...applyApprovedMemoryProposal(state, approved),
          activeState: {
            ...state.activeState,
            memoryProposals: [approved, ...state.activeState.memoryProposals],
          },
        });
      }
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          memoryProposals: [action.proposal, ...state.activeState.memoryProposals],
        },
      });
    }
    case "UPDATE_MEMORY_PROPOSAL":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          memoryProposals: updateById(state.activeState.memoryProposals, action.proposalId, (proposal) =>
            updateMemoryProposal(proposal, action.patch),
          ),
        },
      });
    case "APPROVE_MEMORY_PROPOSAL": {
      const existing = state.activeState.memoryProposals.find((proposal) => proposal.id === action.proposalId);
      if (!existing) return state;
      const proposal = proposalWithEdits(existing, action.editedProposal);
      const approved = updateMemoryProposal(proposal, { status: "approved" });
      return touchAdventure(state, {
        ...applyApprovedMemoryProposal(state, approved),
        activeState: {
          ...state.activeState,
          memoryProposals: state.activeState.memoryProposals.map((entry) => (entry.id === action.proposalId ? approved : entry)),
        },
      });
    }
    case "REJECT_MEMORY_PROPOSAL":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          memoryProposals: updateById(state.activeState.memoryProposals, action.proposalId, (proposal) =>
            updateMemoryProposal(proposal, { status: "rejected" }),
          ),
        },
      });
    case "IGNORE_MEMORY_PROPOSAL":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          memoryProposals: updateById(state.activeState.memoryProposals, action.proposalId, (proposal) =>
            updateMemoryProposal(proposal, { status: "ignored" }),
          ),
        },
      });
    case "UPDATE_ROLLING_SUMMARY":
      return touchAdventure(state, {
        rollingSummary: {
          content: action.content,
          updatedAt: nowIso(),
          lastSummarizedMessageIndex: action.lastSummarizedMessageIndex ?? state.rollingSummary.lastSummarizedMessageIndex,
        },
      });
    case "UPDATE_SCENE_STATE":
      return touchAdventure(state, {
        sceneState: { content: action.content, updatedAt: nowIso() },
      });
    case "SET_TOKEN_BUDGET_SETTINGS":
      return touchAdventure(state, { tokenBudgetSettings: action.settings });
    case "SET_MODEL_CONFIG":
      return touchAdventure(state, { modelConfig: stripProviderKey(action.config) });
    case "SET_SEMANTIC_EVALUATION_SETTINGS":
      return touchAdventure(state, { semanticEvaluationSettings: action.settings });
    case "SET_AUTO_CARD_SETTINGS":
      return touchAdventure(state, { autoCardSettings: action.settings });
    case "SET_MEMORY_AUTO_APPROVE":
      return touchAdventure(state, { memoryAutoApprove: action.settings });
    case "SET_STATE_FLAG":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          stateFlags: { ...state.activeState.stateFlags, [action.key]: action.value },
        },
      });
    case "SET_RESPONSE_LENGTH_HINT":
      return touchAdventure(state, {
        activeState: { ...state.activeState, responseLengthHint: action.hint },
      });
    case "SET_NEXT_TURN_NOTE": {
      const timestamp = nowIso();
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          nextTurnNote: {
            ...defaultNextTurnNote(),
            ...(state.activeState.nextTurnNote ?? {}),
            ...action.note,
            createdAt: state.activeState.nextTurnNote?.createdAt ?? timestamp,
            updatedAt: timestamp,
          },
        },
      });
    }
    case "CLEAR_NEXT_TURN_NOTE":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          nextTurnNote: defaultNextTurnNote(),
        },
      });
    case "CONSUME_NEXT_TURN_NOTE":
      if (!state.activeState.nextTurnNote?.expiresAfterUse) return state;
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          nextTurnNote: {
            ...state.activeState.nextTurnNote,
            content: "",
            active: true,
            updatedAt: nowIso(),
          },
        },
      });
    case "QUEUE_PENDING_UPDATE":
      return touchAdventure(state, {
        activeState: {
          ...state.activeState,
          pendingUpdates: [...state.activeState.pendingUpdates, action.update],
        },
      });
    case "FLUSH_PENDING_UPDATES": {
      const pendingUpdates = state.activeState.pendingUpdates;
      if (pendingUpdates.length === 0) return state;
      let next = touchAdventure(state, {
        activeState: {
          ...state.activeState,
          pendingUpdates: [],
        },
      });
      for (const pending of pendingUpdates) {
        for (const pendingAction of pending.actions) {
          if (pendingAction.type === "QUEUE_PENDING_UPDATE" || pendingAction.type === "FLUSH_PENDING_UPDATES") continue;
          next = adventureReducer(next, pendingAction);
        }
      }
      return next;
    }
    case "RESET_RUNTIME_STATE":
      return touchAdventure(state, {
        messages: [],
        rollingSummary: { content: "", updatedAt: nowIso() },
        activeState: {
          ...state.activeState,
          turn: 0,
          forceIncludeNextTurn: [],
          triggerLog: [],
          evaluationLog: [],
          autoCardReviewQueue: [],
          memoryProposals: [],
          pendingUpdates: [],
          storyUndoStack: [],
          storyRedoStack: [],
          nextTurnNote: defaultNextTurnNote(),
          stateFlags: {},
        },
        autoCards: state.autoCards.map((card) => touch({ ...card, lastUpdatedTurn: undefined })),
        triggerRules: state.triggerRules.map((rule) => touch({ ...rule, lastFiredTurn: undefined })),
        quests: state.quests.map(resetQuestRuntime),
      });
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
