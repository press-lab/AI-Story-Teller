import type {
  Adventure,
  AutoCard,
  BrainEntry,
  ComponentEntry,
  MemoryDetectionSettings,
  NextTurnNote,
  ProviderConfig,
  Quest,
  SemanticEvaluationSettings,
  StoryCard,
  TokenBudgetSettings,
  TriggerRule,
  AutoCardSettings,
  ProviderRequestThrottle,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";

export const defaultTokenBudgetSettings: TokenBudgetSettings = {
  maxContextTokens: 16000,
  maxRecentMessages: 40,
  memoryPriorityMode: "userLocked",
  allowSystemToPrioritizeMemory: false,
  allowSystemToDropUnpinnedTriggeredCards: true,
  allowSystemToTruncateSummary: true,
  recentMessageWindow: 12,
  sectionBudgets: {
    rollingSummary: 1800,
    sceneState: 400,
    recentMessages: 6000,
  },
  autoSummarize: true,
  autoSummarizeEveryNTurns: 20,
  autoSceneStateEveryNTurns: 1,
  sceneStateEnabled: true,
};

export const lightTokenBudgetPreset: Partial<TokenBudgetSettings> = {
  maxContextTokens: 8000,
  maxRecentMessages: 15,
  sectionBudgets: { rollingSummary: 800, recentMessages: 3000 },
  autoSummarize: true,
  autoSummarizeEveryNTurns: 10,
};

export const heavyTokenBudgetPreset: Partial<TokenBudgetSettings> = {
  maxContextTokens: 32000,
  maxRecentMessages: 80,
  sectionBudgets: { rollingSummary: 4000, recentMessages: 12000 },
  autoSummarize: true,
  autoSummarizeEveryNTurns: 30,
};

export const defaultProviderRequestThrottle: ProviderRequestThrottle = {
  enabled: false,
  minSecondsBetweenRequests: 2,
  maxRequestsPerMinute: 20,
};

export const defaultModelConfig: ProviderConfig = {
  name: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  temperature: 1.0,
  maxOutputTokens: 1200,
  requestThrottle: defaultProviderRequestThrottle,
};

export const defaultSemanticEvaluationSettings: SemanticEvaluationSettings = {
  evaluationModel: "",
  messagesIncluded: 8,
  enabled: true,
  showLog: true,
  maxParallelUpdateCalls: 3,
  requireApprovalForAutoUpdates: true,
  semanticEvalEveryNTurns: 1,
};

export const defaultMemoryDetectionSettings: MemoryDetectionSettings = {
  enabled: true,
  generateContent: true,
  everyNTurns: 1,
};

export const defaultAutoCardSettings: AutoCardSettings = {
  enabled: true,
  detectionCondition:
    "when a new named character, location, organization, or significant object is introduced that doesn't already have a story card",
  generationPrompt:
    'A new entity worth remembering has appeared in the story. Write a story card for it. Content must be third-person prose: complete sentences, mention the entity by name in each sentence, focus only on durable plot-significant details, avoid temporary or scene-specific observations, imitate the story\'s writing style and tone. Do NOT include current location, who is currently present in a scene, active mission status, or any "currently X" state — these are temporary and belong in Scene State, not a Story Card. Return ONLY valid JSON: {"title": string, "content": string, "keys": string (comma-separated trigger keywords)}',
  cooldownTurns: 3,
};

export function defaultNextTurnNote(): NextTurnNote {
  return {
    content: "",
    active: true,
    pinned: true,
    protected: false,
    priority: 85,
    expiresAfterUse: true,
  };
}

function clampSummaryIndex(index: number | undefined, messageCount: number): number | undefined {
  if (index === undefined) return undefined;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(Math.floor(index), messageCount));
}

export const defaultNarrationRulesContent = `You are the narrator of a collaborative interactive fiction adventure.
Continue the story in response to the player, then leave the scene open for their next action.

END OPEN: Never resolve a decision for the player. End each response on an actionable moment, not a conclusion.

PERSPECTIVE: Follow the perspective the player has established — first person, second person, or third person. Match it exactly. Do not override or reassign it.

PLAYER INPUT MODES:
- Messages starting with "You " are direct player actions. Continue the scene from them.
- Plain narrative messages are story direction from the author. Incorporate and continue.
- [Out of Character: ...] messages are author notes. Step out of the story, respond briefly as a collaborator, then stop. Do not write story prose in this mode.

CONTINUITY: All context sections (plot essentials, story cards, character brains, rolling summary) are established canon. Never contradict them. When details are absent, invent consistently with what is established.

TONE: Match the tone the adventure has established. Do not break the fourth wall, moralize, or editorialize unless in [Out of Character] mode.`;

export function createDefaultAdventure(title = "Untitled Adventure"): Adventure {
  const timestamp = nowIso();
  return {
    id: createId("adv"),
    title,
    openingScene: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {},
    autoSaveEnabled: true,
    autoSaveEveryNTurns: 3,
    components: [
      makeComponent({
        title: "Global Generation Rules",
        type: "narrationRules",
        content: defaultNarrationRulesContent,
        priority: 100,
        alwaysOn: true,
        pinned: true,
      }),
      makeComponent({ title: "Active Pressure", type: "activePressure", content: "", priority: 245, active: true }),
      makeComponent({ title: "Immediate Momentum", type: "immediateMomentum", content: "", priority: 240, active: true }),
    ],
    storyCards: [],
    brains: [],
    autoCards: [],
    triggerRules: [],
    quests: [],
    questState: {},
    rollingSummary: { content: "", updatedAt: timestamp },
    sceneState: { content: "", updatedAt: timestamp },
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
      nextTurnNote: defaultNextTurnNote(),
      rawImports: [],
      stateFlags: {},
      responseLengthHint: 150,
      backgroundTokenUsage: { promptTokens: 0, completionTokens: 0 },
      challengeMode: false,
      lastMemoryCycleTurn: undefined,
    },
    tokenBudgetSettings: defaultTokenBudgetSettings,
    modelConfig: defaultModelConfig,
    semanticEvaluationSettings: defaultSemanticEvaluationSettings,
    autoCardSettings: defaultAutoCardSettings,
    memoryAutoApprove: { summaryUpdate: false, plotEssentialsUpdate: false, plotPressureUpdate: true, plotMomentumUpdate: true, storyCard: false, brainUpdate: false },
    memoryDetectionSettings: defaultMemoryDetectionSettings,
  };
}

export function makeComponent(
  overrides: Partial<ComponentEntry> & Pick<ComponentEntry, "title" | "content">,
): ComponentEntry {
  const timestamp = nowIso();
  const type = overrides.type ?? "custom";
  const defaultProtected = type === "narrationRules" || type === "aiInstructions" || type === "plotEssentials" || type === "authorNote";
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
    autoUpdate: overrides.autoUpdate,
    lastAutoUpdateTurn: overrides.lastAutoUpdateTurn,
    autoUpdateCooldownTurns: overrides.autoUpdateCooldownTurns,
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
    autoUpdate: overrides.autoUpdate ?? false,
    autoUpdateCooldownTurns: overrides.autoUpdateCooldownTurns ?? 3,
    lastAutoUpdateTurn: overrides.lastAutoUpdateTurn,
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
    triggers: overrides.triggers ?? [],
    source: overrides.source ?? "manual",
    currentState: overrides.currentState ?? "",
    thoughts: overrides.thoughts ?? {},
    archivedThoughts: overrides.archivedThoughts ?? {},
    linkedStoryCardId: overrides.linkedStoryCardId,
    relationshipPressure: overrides.relationshipPressure ?? "",
    emotionalInterpretation: overrides.emotionalInterpretation ?? "",
    recentDevelopments: overrides.recentDevelopments ?? "",
    notes: overrides.notes ?? "",
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
    autoUpdateCooldownTurns: overrides.autoUpdateCooldownTurns,
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

function migrateThoughts(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, string>;
  if (typeof raw === "string" && raw.trim()) return { legacy: raw.trim() };
  return {};
}

export function normalizeAdventure(adventure: Adventure): Adventure {
  const baseline = createDefaultAdventure(adventure.title || "Untitled Adventure");
  return {
    ...baseline,
    ...adventure,
    openingScene: adventure.openingScene ?? "",
    metadata: adventure.metadata ?? {},
    autoSaveEnabled: adventure.autoSaveEnabled ?? true,
    autoSaveEveryNTurns: adventure.autoSaveEveryNTurns ?? 3,
    activeState: {
      ...baseline.activeState,
      ...adventure.activeState,
      evaluationLog: adventure.activeState?.evaluationLog ?? [],
      autoCardReviewQueue: adventure.activeState?.autoCardReviewQueue ?? [],
      memoryProposals: adventure.activeState?.memoryProposals ?? [],
      pendingUpdates: adventure.activeState?.pendingUpdates ?? [],
      storyUndoStack: adventure.activeState?.storyUndoStack ?? [],
      storyRedoStack: adventure.activeState?.storyRedoStack ?? [],
      nextTurnNote: {
        ...defaultNextTurnNote(),
        ...(adventure.activeState?.nextTurnNote ?? {}),
      },
      rawImports: adventure.activeState?.rawImports ?? [],
      stateFlags: adventure.activeState?.stateFlags ?? {},
      triggerLog: adventure.activeState?.triggerLog ?? [],
      forceIncludeNextTurn: adventure.activeState?.forceIncludeNextTurn ?? [],
      // Coerce old string hints ("short"/"medium"/"long") from pre-slider saves to numbers
      responseLengthHint: typeof adventure.activeState?.responseLengthHint === "number"
        ? adventure.activeState.responseLengthHint
        : adventure.activeState?.responseLengthHint === "short" ? 75
        : adventure.activeState?.responseLengthHint === "long" ? 175
        : 150,
      backgroundTokenUsage: adventure.activeState?.backgroundTokenUsage ?? { promptTokens: 0, completionTokens: 0 },
      challengeMode: adventure.activeState?.challengeMode ?? false,
      lastMemoryCycleTurn: adventure.activeState?.lastMemoryCycleTurn,
      lastSemanticEvalTurn: adventure.activeState?.lastSemanticEvalTurn,
      lastSceneStateTurn: adventure.activeState?.lastSceneStateTurn,
    },
    rollingSummary: {
      ...baseline.rollingSummary,
      ...(adventure.rollingSummary ?? {}),
      lastSummarizedMessageIndex: clampSummaryIndex(
        adventure.rollingSummary?.lastSummarizedMessageIndex,
        (adventure.messages ?? []).length,
      ),
    },
    sceneState: adventure.sceneState ?? { content: "", updatedAt: nowIso() },
    brains: (adventure.brains ?? []).map((brain) => ({
      ...brain,
      source: brain.source ?? "manual",
      protected: brain.protected ?? false,
      inclusionPolicy: brain.inclusionPolicy ?? "triggered",
      updateCondition: (() => {
        const old = brain.updateCondition?.trim();
        if (!old || /^when \S.* appears in the scene or is meaningfully referenced$/.test(old)) {
          return `when something in this scene causes a genuine shift for ${brain.characterName}: a new realization, emotional pivot, changed read on another character, or meaningful reaction to events — do NOT fire just because they appear or speak`;
        }
        return old;
      })(),
      updatePrompt: brain.updatePrompt ?? "",
      updateMode: brain.updateMode ?? "replace",
      thoughts: migrateThoughts((brain as unknown as Record<string, unknown>).thoughts),
      archivedThoughts: brain.archivedThoughts ?? {},
      linkedStoryCardId: brain.linkedStoryCardId,
    })),
    storyCards: (adventure.storyCards ?? []).map((card) => ({
      ...card,
      matchType: card.matchType ?? "phrase",
      protected: card.protected ?? false,
      inclusionPolicy: card.inclusionPolicy ?? "triggered",
      autoUpdate: card.autoUpdate ?? false,
      autoUpdateCooldownTurns: card.autoUpdateCooldownTurns ?? 3,
    })),
    components: (() => {
      const existing = adventure.components ?? [];
      const normalized = existing.map((component) => {
        const defaultProtected =
          component.type === "narrationRules" || component.type === "aiInstructions" || component.type === "plotEssentials" || component.type === "authorNote";
        return {
          ...component,
          protected: component.protected ?? defaultProtected,
          inclusionPolicy: component.inclusionPolicy ?? (component.alwaysOn || defaultProtected ? "always" : "manual"),
        };
      });
      const hasActivePressure = normalized.some((c) => c.type === "activePressure");
      const hasImmediateMomentum = normalized.some((c) => c.type === "immediateMomentum");
      return [
        ...normalized,
        ...(hasActivePressure ? [] : [makeComponent({ title: "Active Pressure", type: "activePressure", content: "", priority: 245, active: true })]),
        ...(hasImmediateMomentum ? [] : [makeComponent({ title: "Immediate Momentum", type: "immediateMomentum", content: "", priority: 240, active: true })]),
      ];
    })(),
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
      semanticEvalEveryNTurns: adventure.semanticEvaluationSettings?.semanticEvalEveryNTurns ?? 1,
    },
    autoCardSettings: {
      ...defaultAutoCardSettings,
      ...(adventure.autoCardSettings ?? {}),
    },
    memoryAutoApprove: {
      ...{ summaryUpdate: false, plotEssentialsUpdate: false, plotPressureUpdate: true, plotMomentumUpdate: true, storyCard: false, brainUpdate: false },
      ...(adventure.memoryAutoApprove ?? {}),
    },
    memoryDetectionSettings: {
      ...defaultMemoryDetectionSettings,
      ...(adventure.memoryDetectionSettings ?? {}),
    },
    tokenBudgetSettings: {
      ...defaultTokenBudgetSettings,
      ...(adventure.tokenBudgetSettings ?? {}),
      // Ensure new fields always present even on old saves
      autoSummarize: adventure.tokenBudgetSettings?.autoSummarize ?? true,
      autoSummarizeEveryNTurns: adventure.tokenBudgetSettings?.autoSummarizeEveryNTurns ?? 20,
      autoSceneStateEveryNTurns: adventure.tokenBudgetSettings?.autoSceneStateEveryNTurns ?? 1,
      sceneStateEnabled: adventure.tokenBudgetSettings?.sceneStateEnabled ?? true,
    },
    modelConfig: {
      ...defaultModelConfig,
      ...(adventure.modelConfig ?? {}),
      requestThrottle: {
        ...defaultProviderRequestThrottle,
        ...(adventure.modelConfig?.requestThrottle ?? {}),
      },
    },
  };
}
