import type {
  Adventure,
  AutoCard,
  BrainEntry,
  ComponentEntry,
  ProviderConfig,
  Quest,
  SemanticEvaluationSettings,
  StoryCard,
  TokenBudgetSettings,
  TriggerRule,
  AutoCardSettings,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";

export const defaultTokenBudgetSettings: TokenBudgetSettings = {
  maxContextTokens: 8000,
  maxRecentMessages: 24,
  memoryPriorityMode: "userLocked",
  allowSystemToPrioritizeMemory: false,
  allowSystemToDropUnpinnedTriggeredCards: true,
  allowSystemToTruncateSummary: true,
  recentMessageWindow: 8,
  sectionBudgets: {
    rollingSummary: 1200,
    recentMessages: 3000,
  },
};

export const defaultModelConfig: ProviderConfig = {
  name: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  temperature: 0.8,
  maxOutputTokens: 1200,
};

export const defaultSemanticEvaluationSettings: SemanticEvaluationSettings = {
  evaluationModel: "",
  messagesIncluded: 8,
  enabled: true,
  showLog: true,
  maxParallelUpdateCalls: 3,
};

export const defaultAutoCardSettings: AutoCardSettings = {
  enabled: true,
  detectionCondition:
    "when a new named character, location, organization, or significant object is introduced that doesn't already have a story card",
  generationPrompt:
    'Based on the story, a new entity or fact worth remembering has appeared. Write a concise story card for it. Return ONLY valid JSON: {"title": string, "content": string, "keys": string (comma-separated trigger keywords)}',
  cooldownTurns: 3,
};

export function createDefaultAdventure(title = "Untitled Adventure"): Adventure {
  const timestamp = nowIso();
  return {
    id: createId("adv"),
    title,
    openingScene: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {},
    components: [
      makeComponent({
        title: "Global Generation Rules",
        type: "aiInstructions",
        content:
          "Write immersive interactive fiction. Respect established continuity. Ask no meta questions unless the player asks for them. Keep the next scene actionable.",
        priority: 100,
        alwaysOn: true,
        pinned: true,
      }),
    ],
    storyCards: [],
    brains: [],
    autoCards: [],
    triggerRules: [],
    quests: [],
    questState: {},
    rollingSummary: { content: "", updatedAt: timestamp },
    messages: [],
    activeState: {
      turn: 0,
      forceIncludeNextTurn: [],
      triggerLog: [],
      evaluationLog: [],
      autoCardReviewQueue: [],
      memoryProposals: [],
      pendingUpdates: [],
      storyUndoStack: [],
      storyRedoStack: [],
      rawImports: [],
      stateFlags: {},
    },
    tokenBudgetSettings: defaultTokenBudgetSettings,
    modelConfig: defaultModelConfig,
    semanticEvaluationSettings: defaultSemanticEvaluationSettings,
    autoCardSettings: defaultAutoCardSettings,
  };
}

export function makeComponent(
  overrides: Partial<ComponentEntry> & Pick<ComponentEntry, "title" | "content">,
): ComponentEntry {
  const timestamp = nowIso();
  const type = overrides.type ?? "custom";
  const defaultProtected = type === "aiInstructions" || type === "plotEssentials" || type === "authorNote";
  const alwaysOn = overrides.alwaysOn ?? false;
  return {
    id: overrides.id ?? createId("component"),
    title: overrides.title,
    type,
    content: overrides.content,
    priority: overrides.priority ?? 0,
    alwaysOn,
    active: overrides.active ?? true,
    pinned: overrides.pinned ?? false,
    protected: overrides.protected ?? defaultProtected,
    inclusionPolicy: overrides.inclusionPolicy ?? (alwaysOn || defaultProtected ? "always" : "manual"),
    state: overrides.state ?? "",
    tokenBudget: overrides.tokenBudget,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export function makeStoryCard(overrides: Partial<StoryCard> & Pick<StoryCard, "title" | "content">): StoryCard {
  const timestamp = nowIso();
  return {
    id: overrides.id ?? createId("story"),
    title: overrides.title,
    keys: overrides.keys ?? [],
    matchType: overrides.matchType ?? "phrase",
    content: overrides.content,
    type: overrides.type ?? "custom",
    active: overrides.active ?? true,
    pinned: overrides.pinned ?? false,
    protected: overrides.protected ?? false,
    inclusionPolicy: overrides.inclusionPolicy ?? "triggered",
    priority: overrides.priority ?? 0,
    state: overrides.state ?? "",
    tokenBudget: overrides.tokenBudget,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export function makeBrain(overrides: Partial<BrainEntry> & Pick<BrainEntry, "characterName">): BrainEntry {
  const timestamp = nowIso();
  return {
    id: overrides.id ?? createId("brain"),
    characterName: overrides.characterName,
    aliases: overrides.aliases ?? [],
    triggers: overrides.triggers ?? [],
    source: overrides.source ?? "manual",
    currentState: overrides.currentState ?? "",
    thoughts: overrides.thoughts ?? "",
    relationshipPressure: overrides.relationshipPressure ?? "",
    emotionalInterpretation: overrides.emotionalInterpretation ?? "",
    recentDevelopments: overrides.recentDevelopments ?? "",
    active: overrides.active ?? true,
    pinned: overrides.pinned ?? false,
    protected: overrides.protected ?? false,
    inclusionPolicy: overrides.inclusionPolicy ?? "triggered",
    priority: overrides.priority ?? 0,
    tokenBudget: overrides.tokenBudget,
    updateCondition:
      overrides.updateCondition ??
      `when ${overrides.characterName} appears in the scene or is meaningfully referenced`,
    updatePrompt: overrides.updatePrompt ?? "",
    updateMode: overrides.updateMode ?? "replace",
    lastUpdatedTurn: overrides.lastUpdatedTurn,
    lastUpdatedAt: overrides.lastUpdatedAt,
    lastGeneratedUpdatePreview: overrides.lastGeneratedUpdatePreview,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export function makeAutoCard(overrides: Partial<AutoCard> & Pick<AutoCard, "title" | "content">): AutoCard {
  const timestamp = nowIso();
  return {
    id: overrides.id ?? createId("auto"),
    title: overrides.title,
    detectedEntity: overrides.detectedEntity ?? overrides.title,
    triggers: overrides.triggers ?? [],
    content: overrides.content,
    source: overrides.source ?? "manual",
    active: overrides.active ?? true,
    pinned: overrides.pinned ?? false,
    protected: overrides.protected ?? false,
    inclusionPolicy: overrides.inclusionPolicy ?? "systemSuggested",
    priority: overrides.priority ?? 0,
    updateMode: overrides.updateMode ?? "manual",
    cooldownTurns: overrides.cooldownTurns ?? 0,
    lastUpdatedTurn: overrides.lastUpdatedTurn,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export function makeTriggerRule(overrides: Partial<TriggerRule> & Pick<TriggerRule, "name">): TriggerRule {
  const timestamp = nowIso();
  return {
    id: overrides.id ?? createId("trigger"),
    name: overrides.name,
    enabled: overrides.enabled ?? true,
    source: overrides.source ?? "both",
    evaluationMode: overrides.evaluationMode ?? "semantic",
    condition: overrides.condition ?? "",
    updatePrompt: overrides.updatePrompt ?? "",
    matchType: overrides.matchType ?? "keyword",
    patterns: overrides.patterns ?? [],
    conditions: overrides.conditions ?? [],
    actions: overrides.actions ?? [],
    priority: overrides.priority ?? 0,
    cooldownTurns: overrides.cooldownTurns ?? 0,
    lastFiredTurn: overrides.lastFiredTurn,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export function makeQuest(overrides: Partial<Quest> & Pick<Quest, "title">): Quest {
  const timestamp = nowIso();
  return {
    id: overrides.id ?? createId("quest"),
    title: overrides.title,
    description: overrides.description ?? "",
    status: overrides.status ?? "inactive",
    currentStepId: overrides.currentStepId,
    steps:
      overrides.steps?.map((step) => ({
        ...step,
        completionCondition: step.completionCondition ?? "",
      })) ?? [],
    relatedCards: overrides.relatedCards ?? [],
    priority: overrides.priority ?? 0,
    pinned: overrides.pinned ?? false,
    protected: overrides.protected ?? false,
    inclusionPolicy: overrides.inclusionPolicy ?? "always",
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export function normalizeAdventure(adventure: Adventure): Adventure {
  const baseline = createDefaultAdventure(adventure.title || "Untitled Adventure");
  return {
    ...baseline,
    ...adventure,
    openingScene: adventure.openingScene ?? "",
    activeState: {
      ...baseline.activeState,
      ...adventure.activeState,
      evaluationLog: adventure.activeState?.evaluationLog ?? [],
      autoCardReviewQueue: adventure.activeState?.autoCardReviewQueue ?? [],
      memoryProposals: adventure.activeState?.memoryProposals ?? [],
      pendingUpdates: adventure.activeState?.pendingUpdates ?? [],
      storyUndoStack: adventure.activeState?.storyUndoStack ?? [],
      storyRedoStack: adventure.activeState?.storyRedoStack ?? [],
      rawImports: adventure.activeState?.rawImports ?? [],
      stateFlags: adventure.activeState?.stateFlags ?? {},
      triggerLog: adventure.activeState?.triggerLog ?? [],
      forceIncludeNextTurn: adventure.activeState?.forceIncludeNextTurn ?? [],
    },
    brains: (adventure.brains ?? []).map((brain) => ({
      ...brain,
      source: brain.source ?? "manual",
      protected: brain.protected ?? false,
      inclusionPolicy: brain.inclusionPolicy ?? "triggered",
      updateCondition:
        brain.updateCondition || `when ${brain.characterName} appears in the scene or is meaningfully referenced`,
      updatePrompt: brain.updatePrompt ?? "",
      updateMode: brain.updateMode ?? "replace",
    })),
    storyCards: (adventure.storyCards ?? []).map((card) => ({
      ...card,
      matchType: card.matchType ?? "phrase",
      protected: card.protected ?? false,
      inclusionPolicy: card.inclusionPolicy ?? "triggered",
    })),
    components: (adventure.components ?? []).map((component) => {
      const defaultProtected =
        component.type === "aiInstructions" || component.type === "plotEssentials" || component.type === "authorNote";
      return {
        ...component,
        protected: component.protected ?? defaultProtected,
        inclusionPolicy: component.inclusionPolicy ?? (component.alwaysOn || defaultProtected ? "always" : "manual"),
      };
    }),
    autoCards: (adventure.autoCards ?? []).map((card) => ({
      ...card,
      priority: card.priority ?? 0,
      pinned: card.pinned ?? false,
      protected: card.protected ?? false,
      inclusionPolicy: card.inclusionPolicy ?? "systemSuggested",
    })),
    triggerRules: (adventure.triggerRules ?? []).map((rule) => ({
      ...rule,
      evaluationMode: rule.evaluationMode ?? "semantic",
      condition: rule.condition ?? "",
      updatePrompt: rule.updatePrompt ?? "",
    })),
    quests: (adventure.quests ?? []).map((quest) => ({
      ...quest,
      priority: quest.priority ?? 0,
      pinned: quest.pinned ?? false,
      protected: quest.protected ?? false,
      inclusionPolicy: quest.inclusionPolicy ?? "always",
      steps: quest.steps.map((step) => ({
        ...step,
        completionCondition: step.completionCondition ?? "",
      })),
    })),
    semanticEvaluationSettings: {
      ...defaultSemanticEvaluationSettings,
      ...(adventure.semanticEvaluationSettings ?? {}),
    },
    autoCardSettings: {
      ...defaultAutoCardSettings,
      ...(adventure.autoCardSettings ?? {}),
    },
    tokenBudgetSettings: {
      ...defaultTokenBudgetSettings,
      ...(adventure.tokenBudgetSettings ?? {}),
    },
  };
}
