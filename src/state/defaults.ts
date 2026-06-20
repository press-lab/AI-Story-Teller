import type {
  Adventure,
  ArcPacingState,
  BrainEntry,
  ComponentEntry,
  MemoryDetectionSettings,
  NextTurnNote,
  ProviderConfig,
  SemanticEvaluationSettings,
  StoryCard,
  SystemTriggerSettings,
  TokenBudgetSettings,
  TriggerRule,
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
  summaryEnabled: true,
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
  // Storytelling profile (mirrors AID): cooler temp + nucleus trim + a strong presence penalty so
  // prose stays coherent without looping. topK left unset — DeepSeek rejects it; set it per-provider.
  temperature: 0.7,
  maxOutputTokens: 1200,
  topP: 0.95,
  presencePenalty: 0.8,
  frequencyPenalty: 0,
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

export const defaultSystemTriggerSettings: SystemTriggerSettings = {
  enabled: true,
  categories: {
    // Only detect genuinely NEW entities by default — new characters, and new places/factions/lore.
    character_reveal: true,
    world_fact: true,
    // Off by default: these generate event/relationship/status cards ("Seth and Jinx's Deal", "The
    // Escape from Gutterglass", "Setu Joins the Team") that restate scene beats rather than durable
    // entities and pile up reworded near-duplicates. Opt in per adventure if you want them.
    relationship: false,
    plot_beat: false,
    status_change: false,
  },
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

END OPEN: Never resolve a decision for the player. End each response on an actionable moment, not a conclusion. Do NOT end with explicit choices, questions directed at the player, or option menus ("Want to X, or Y?"). End at a natural story beat — the player decides what happens next.

PERSPECTIVE: Follow the perspective the player has established — first person, second person, or third person. Match it exactly. Do not override or reassign it.

PLAYER INPUT MODES:
- Messages starting with "You " are direct player actions. Continue the scene from them.
- Plain narrative messages are story direction from the author. Incorporate and continue.
- [Out of Character: ...] messages are author notes. Step out of the story, respond briefly as a collaborator, then stop. Do not write story prose in this mode.

CONTINUITY: All context sections (plot essentials, story cards, character brains, rolling summary) are established canon. Never contradict them. When details are absent, invent consistently with what is established. Even if this adventure uses names, places, factions, or concepts from a published setting or fandom, the adventure context is the only canon. Do not import outside biography, relationships, motives, powers, locations, or events unless they are established in the active context.

TONE: Match the tone the adventure has established. Do not break the fourth wall, moralize, or editorialize unless in [Out of Character] mode.

CHARACTERS: Every character with a Story Card has an established voice, history, and personality. Write them from their card — their speech patterns, concerns, and reactions must reflect what is established. Do not flatten characters into generic helpful or friendly behavior. If two characters would respond differently to the same situation, write them differently. A character's card is their identity; treat it as binding. If a familiar or famous character name appears without a matching active Story Card, Brain, Plot Essential, or Recent Message detail, treat those missing details as unknown instead of filling them from outside canon.

LANGUAGE: Write only in the language the player is using. Never translate or repeat the response in another language. One language, one response.

NARRATOR STANCE: Never flag a decision point. Never write "the choice is yours," "she's leaving it up to you," or any line that announces the player has options. The player always has options — the narrator does not need to say so. End at a story beat. The player acts next.

SCENE TRANSITIONS: Never execute a scene transition on behalf of the player. If an NPC proposes moving somewhere — "walk me back," "come with me," "let's go" — end there, at the proposal or at the threshold. Do not narrate the walk, the arrival, or what happens at the destination. The player moves the story forward. One location per response.`;

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
    ],
    storyCards: [],
    brains: [],
    triggerRules: [],
    rollingSummary: { content: "", updatedAt: timestamp },
    sceneState: { content: "", updatedAt: timestamp },
    messages: [],
    activeState: {
      turn: 0,
      forceIncludeNextTurn: [],
      triggerLog: [],
      evaluationLog: [],
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
    memoryAutoApprove: { summaryUpdate: false, plotEssentialsUpdate: false, currentArcUpdate: true, plotPressureUpdate: true, plotMomentumUpdate: false, storyCard: false, brainUpdate: false },
    memoryDetectionSettings: defaultMemoryDetectionSettings,
    systemTriggers: defaultSystemTriggerSettings,
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
    arcPremise: overrides.arcPremise,
    arcThreadKeys: overrides.arcThreadKeys,
    arcPace: overrides.arcPace,
    arcTriggerMode: overrides.arcTriggerMode,
    arcSimmerInstruction: overrides.arcSimmerInstruction,
    arcBreakInstruction: overrides.arcBreakInstruction,
    arcState: overrides.arcState ?? (type === "currentArc" ? defaultArcState() : undefined),
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

export function defaultArcState(): ArcPacingState {
  return { phase: "simmer", tier: 0, threadEngagement: {}, pendingBreak: false };
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
    archivedFacts: overrides.archivedFacts,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

/**
 * True if `name` refers to this card — by its exact title OR any of its trigger keys (aliases),
 * case-insensitive. Used so a development about "Toph" lands on the "Toph Beifong" card (whose keys
 * include "Toph") instead of spawning a duplicate.
 */
export function cardMatchesName(card: Pick<StoryCard, "title" | "keys">, name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (card.title.trim().toLowerCase() === n) return true;
  return (card.keys ?? []).some((k) => k.trim().toLowerCase() === n);
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
    // Brains accumulate thoughts by default (Inner Self style). "replace" keeps only
    // the latest thought and is opt-in via the Brains UI dropdown.
    updateMode: overrides.updateMode ?? "append",
    condenseThreshold: overrides.condenseThreshold,
    autoUpdateCooldownTurns: overrides.autoUpdateCooldownTurns,
    lastUpdatedTurn: overrides.lastUpdatedTurn,
    lastUpdatedAt: overrides.lastUpdatedAt,
    lastGeneratedUpdatePreview: overrides.lastGeneratedUpdatePreview,
    printThoughts: overrides.printThoughts ?? false,
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
      memoryProposals: adventure.activeState?.memoryProposals ?? [],
      pendingUpdates: adventure.activeState?.pendingUpdates ?? [],
      storyUndoStack: adventure.activeState?.storyUndoStack ?? [],
      storyRedoStack: adventure.activeState?.storyRedoStack ?? [],
      nextTurnNote: {
        ...defaultNextTurnNote(),
        ...(adventure.activeState?.nextTurnNote ?? {}),
      },
      rawImports: adventure.activeState?.rawImports ?? [],
      stateFlags: { ...(adventure.activeState?.stateFlags ?? {}), brainsAppendMigrated: true },
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
      // One-time migration: brains created under the old "replace" default never
      // accumulated thoughts. Flip them to "append" once (gated by the stateFlag
      // below) so existing adventures heal; users can still opt back to replace.
      updateMode: !adventure.activeState?.stateFlags?.brainsAppendMigrated && (brain.updateMode ?? "replace") === "replace"
        ? "append"
        : (brain.updateMode ?? "append"),
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
          // Arc Director: every Current Arc carries pacing state so the gate has something to read.
          // No behavior change until the user actually configures threads + a break instruction.
          arcState: component.type === "currentArc" ? (component.arcState ?? defaultArcState()) : component.arcState,
        };
      });
      // Deduplicate singleton types: keep the first occurrence of each singleton type.
      // This fixes adventures that were created with duplicate narrationRules (or other
      // singleton) components due to a bug in createAdventure merging baseline + setup.
      const singletonTypes = new Set(["narrationRules", "aiInstructions", "plotEssentials", "authorNote", "currentArc"]);
      const seenSingletons = new Set<string>();
      const deduped = normalized.filter((component) => {
        if (!singletonTypes.has(component.type)) return true;
        if (seenSingletons.has(component.type)) return false;
        seenSingletons.add(component.type);
        return true;
      });
      const hasActivePressure = deduped.some((c) => c.type === "activePressure");
      return [
        ...deduped,
        ...(hasActivePressure ? [] : [makeComponent({ title: "Active Pressure", type: "activePressure", content: "", priority: 245, active: true })]),
      ];
    })(),
    triggerRules: (adventure.triggerRules ?? []).map((rule) => ({
      ...rule,
      evaluationMode: rule.evaluationMode ?? "semantic",
      condition: rule.condition ?? "",
      updatePrompt: rule.updatePrompt ?? "",
    })),
    semanticEvaluationSettings: {
      ...defaultSemanticEvaluationSettings,
      ...(adventure.semanticEvaluationSettings ?? {}),
      semanticEvalEveryNTurns: adventure.semanticEvaluationSettings?.semanticEvalEveryNTurns ?? 1,
    },
    memoryAutoApprove: {
      ...{ summaryUpdate: false, plotEssentialsUpdate: false, currentArcUpdate: true, plotPressureUpdate: true, plotMomentumUpdate: false, storyCard: false, brainUpdate: false },
      ...(adventure.memoryAutoApprove ?? {}),
      plotMomentumUpdate: false,
    },
    memoryDetectionSettings: {
      ...defaultMemoryDetectionSettings,
      ...(adventure.memoryDetectionSettings ?? {}),
    },
    systemTriggers: {
      ...defaultSystemTriggerSettings,
      ...(adventure.systemTriggers ?? {}),
      categories: {
        ...defaultSystemTriggerSettings.categories,
        ...(adventure.systemTriggers?.categories ?? {}),
      },
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
