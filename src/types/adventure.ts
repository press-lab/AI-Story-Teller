export type ISODateString = string;
export type JsonObject = Record<string, unknown>;

export type MessageRole = "system" | "user" | "assistant";
export type MemoryPriorityMode = "userLocked" | "systemSuggested" | "hybrid";
export type ContextInclusionPolicy = "always" | "triggered" | "manual" | "systemSuggested";
export type InputMode = "do" | "story" | "comms";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  inputMode?: InputMode;
  usage?: ProviderUsage;
  createdAt: ISODateString;
}

export type ComponentType =
  | "narrationRules"
  | "aiInstructions"
  | "plotEssentials"
  | "currentArc"
  | "activePressure"
  | "immediateMomentum"
  | "authorNote"
  | "memory"
  | "custom";

/** Arc Director runtime state — lives on a `currentArc` component. Deterministic; never set by an LLM. */
export type ArcPhase = "simmer" | "escalate" | "break" | "aftermath";

export interface ArcPacingState {
  phase: ArcPhase;
  /** Display tier 0–5, derived from total engagement vs the break threshold. */
  tier: number;
  /** Per-thread engagement counts, keyed by Story Card / Brain id. Incremented when a thread triggers in-scene. */
  threadEngagement: Record<string, number>;
  /** Ask-mode: the break gate has opened and is awaiting the player's confirmation. */
  pendingBreak: boolean;
  /** Turn the arc entered the break phase, used to time the transition to aftermath. */
  brokeAtTurn?: number;
}

export type ArcPace = "short" | "medium" | "long" | "epic";
export type ArcTriggerMode = "auto" | "ask";

/** A generated "where the story goes next" direction, offered when an arc resolves. */
export interface ArcContinuationOption {
  /** Short button label, e.g. "Azula takes the Society". */
  label: string;
  premise: string;
  /** Story Card / Brain ids carried forward as the next arc's threads. */
  threadKeys: string[];
  simmerInstruction: string;
  breakInstruction: string;
  pace: ArcPace;
}

export interface ComponentEntry {
  id: string;
  title: string;
  type: ComponentType;
  content: string;
  /** Current Story Arc only — the one-line premise seeding this arc's auto-update filter. */
  arcPremise?: string;
  /** Arc Director (currentArc only) — Story Card / Brain ids that are this arc's "baddie" threads. */
  arcThreadKeys?: string[];
  /** Arc Director — how long the arc simmers before it can break. */
  arcPace?: ArcPace;
  /** Arc Director — who springs the break: the AI (auto) or the player via a prompt (ask). */
  arcTriggerMode?: ArcTriggerMode;
  /** Arc Director — instruction injected while simmering/escalating (recur, hint, stay off-screen). */
  arcSimmerInstruction?: string;
  /** Arc Director — the cost policy, injected only once the arc reaches the break phase. */
  arcBreakInstruction?: string;
  /** Arc Director — deterministic pacing state. */
  arcState?: ArcPacingState;
  /** Arc Director — generated next-arc directions, offered once this arc reaches aftermath. */
  arcContinuationOptions?: ArcContinuationOption[];
  /** Arc Director — when true, the Director silently picks and seeds the next arc at aftermath (no chooser, no spoiler). */
  arcAutoContinue?: boolean;
  priority: number;
  alwaysOn: boolean;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  state: string;
  tokenBudget?: number;
  autoUpdate?: boolean;
  lastAutoUpdateTurn?: number;
  autoUpdateCooldownTurns?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type StoryCardType = "character" | "location" | "lore" | "plot" | "custom";

export interface StoryCard {
  id: string;
  title: string;
  keys: string[];
  matchType: TriggerMatchType;
  content: string;
  type: StoryCardType;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  priority: number;
  state: string;
  tokenBudget?: number;
  /** When true, the LLM will automatically update this card after relevant scenes. */
  autoUpdate: boolean;
  /** Minimum turns between AI-generated updates or proposals for this card. */
  autoUpdateCooldownTurns: number;
  lastAutoUpdateTurn?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface BrainEntry {
  id: string;
  characterName: string;
  triggers: string[];
  source?: "manual" | "imported" | "generated";
  currentState: string;
  thoughts: Record<string, string>;
  archivedThoughts: Record<string, string>;
  linkedStoryCardId?: string;
  relationshipPressure: string;
  emotionalInterpretation: string;
  recentDevelopments: string;
  notes: string;
  condenseThreshold?: number;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  priority: number;
  tokenBudget?: number;
  updateCondition: string;
  updatePrompt: string;
  updateMode: "replace" | "append";
  autoUpdateCooldownTurns?: number;
  lastUpdatedTurn?: number;
  lastUpdatedAt?: ISODateString;
  lastGeneratedUpdatePreview?: string;
  /** When true, thought tags captured from this character are appended visibly to the story output. */
  printThoughts?: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}


export type TriggerSource = "input" | "output" | "both";
export type TriggerMatchType = "keyword" | "phrase" | "regex";
export type TriggerEvaluationMode = "semantic" | "keyword" | "regex";

export interface TriggerCondition {
  field: "turn" | "stateFlag";
  operator: "equals" | "notEquals" | "gte" | "lte" | "includes";
  value: string | number | boolean;
  key?: string;
}

export type TriggerAction =
  | { type: "activateComponent"; componentId: string }
  | { type: "deactivateComponent"; componentId: string }
  | { type: "pinComponent"; componentId: string }
  | { type: "unpinComponent"; componentId: string }
  | { type: "updateComponent"; componentId: string; patch?: Partial<ComponentEntry> }
  | { type: "updateComponentPressure"; componentId: string }
  | { type: "updateComponentMomentum"; componentId: string }
  | { type: "updateComponentArc"; componentId: string }
  | { type: "updateSummary" }
  | { type: "activateStoryCard"; storyCardId: string }
  | { type: "deactivateStoryCard"; storyCardId: string }
  | { type: "pinStoryCard"; storyCardId: string }
  | { type: "unpinStoryCard"; storyCardId: string }
  | { type: "updateStoryCard"; storyCardId: string; patch?: Partial<StoryCard> }
  | { type: "activateBrain"; brainId: string }
  | { type: "deactivateBrain"; brainId: string }
  | { type: "updateBrain"; brainId: string }
  | { type: "appendBrain"; brainId: string }
  | { type: "appendBrainState"; brainId: string; field?: BrainStateField; text: string }
  | { type: "replaceBrainState"; brainId: string; field?: BrainStateField; text: string }
  | { type: "forceIncludeNextTurn"; targetType: ForceIncludeTargetType; targetId: string };

export interface TriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  source: TriggerSource;
  evaluationMode: TriggerEvaluationMode;
  condition: string;
  updatePrompt: string;
  matchType: TriggerMatchType;
  patterns: string[];
  conditions: TriggerCondition[];
  actions: TriggerAction[];
  priority: number;
  cooldownTurns: number;
  lastFiredTurn?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RollingSummary {
  content: string;
  updatedAt: ISODateString;
  /** Index into adventure.messages — everything before this index is captured in the summary. */
  lastSummarizedMessageIndex?: number;
}

export interface TokenBudgetSettings {
  maxContextTokens: number;
  maxRecentMessages: number;
  memoryPriorityMode: MemoryPriorityMode;
  allowSystemToPrioritizeMemory: boolean;
  allowSystemToDropUnpinnedTriggeredCards: boolean;
  allowSystemToTruncateSummary: boolean;
  recentMessageWindow: number;
  sectionBudgets: Partial<Record<ContextSectionKind, number>>;
  /** Automatically regenerate the rolling summary in the background every N turns. */
  autoSummarize: boolean;
  autoSummarizeEveryNTurns: number;
  /** How often to regenerate scene state in the background. 0 = manual only, 1 = every turn. Default 1. */
  autoSceneStateEveryNTurns: number;
  /** When false, scene state is excluded from context and never auto-updated. Default true. */
  sceneStateEnabled: boolean;
  /** When false, the durable rolling summary is excluded from context and never auto-generated. Default true. */
  summaryEnabled: boolean;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  requestThrottle?: ProviderRequestThrottle;
}

export interface ProviderRequestThrottle {
  enabled: boolean;
  minSecondsBetweenRequests: number;
  maxRequestsPerMinute: number;
}

/** Target word count for AI responses (50–200). Injected into every turn as a RESPONSE LENGTH instruction. */
export type ResponseLengthHint = number;

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface BackgroundProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export interface SemanticEvaluationSettings {
  evaluationModel: string;
  messagesIncluded: number;
  enabled: boolean;
  showLog: boolean;
  maxParallelUpdateCalls: number;
  /** When true, all LLM-generated memory updates go to the inbox for approval instead of applying directly. */
  requireApprovalForAutoUpdates: boolean;
  /** When set, all background LLM calls (eval, brain updates, scene state) use this provider instead of the active preset. */
  backgroundProviderConfig?: BackgroundProviderConfig;
  /** Global cooldown: skip story-card update conditions if any card was updated within this many turns. 0 or undefined = no global limit. */
  storyCardCooldownTurns?: number;
  /** How often to run semantic evaluation (quests, triggers, auto-cards). 0 = disabled, 1 = every turn. Default 1. */
  semanticEvalEveryNTurns: number;
}


export interface MemoryDetectionSettings {
  enabled: boolean;
  generateContent: boolean;
  everyNTurns: number;
}

export type ForceIncludeTargetType = "component" | "storyCard" | "brain";

export interface ForceIncludeEntry {
  id: string;
  targetType: ForceIncludeTargetType;
  targetId: string;
  expiresTurn: number;
  createdAt: ISODateString;
}

export interface TriggerLogEntry {
  id: string;
  triggerRuleId: string;
  triggerName: string;
  source: "input" | "output";
  turn: number;
  matchedPattern?: string;
  textSnippet: string;
  actionCount: number;
  createdAt: ISODateString;
}

export interface RawImportEntry {
  id: string;
  source: "json" | "manual";
  type: "raw";
  title: string;
  content: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Categories for inline memory tagging (zero-cost, piggybacks on story generation). */
export type InlineMemoryCategory = "relationship" | "world_fact" | "character_reveal" | "plot_beat" | "status_change";

export interface SystemTriggerSettings {
  /** When false, no <memory> tag instructions are injected and no proposals are generated. */
  enabled: boolean;
  /** Per-category opt-out. All true by default. */
  categories: Record<InlineMemoryCategory, boolean>;
}

export type MemoryProposalType =
  | "storyCard"
  | "brainUpdate"
  | "plotEssentialsUpdate"
  | "currentArcUpdate"
  | "arcProposal"
  | "plotPressureUpdate"
  | "plotMomentumUpdate"
  | "summaryUpdate"
  | "ignore";

export type MemoryProposalStatus = "pending" | "approved" | "rejected" | "ignored";

export interface MemoryProposal {
  id: string;
  sourceTurnId: string;
  sourceText: string;
  proposedType: MemoryProposalType;
  title: string;
  content: string;
  suggestedTriggers: string[];
  confidence: number;
  rationale: string;
  status: MemoryProposalStatus;
  targetId?: string;
  appendContent?: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}


export interface EvaluatedCondition {
  id: string;
  label: string;
  condition: string;
  sourceType: "triggerRule" | "brain" | "component" | "storyCard" | "summary";
}

export interface GeneratedContentPreview {
  targetType: "brain" | "component" | "storyCard";
  targetId?: string;
  title: string;
  preview: string;
}

export interface EvaluationLogEntry {
  id: string;
  turn: number;
  createdAt: ISODateString;
  conditionsEvaluated: EvaluatedCondition[];
  conditionsFired: string[];
  actionsExecuted: string[];
  generatedContent: GeneratedContentPreview[];
  errors: string[];
}

export interface PendingAdventureUpdate {
  id: string;
  createdAt: ISODateString;
  source: "semanticEvaluation" | "autoSummary" | "autoSceneState" | "memoryCycle" | "manual";
  actions: AdventureAction[];
}

export interface NextTurnNote {
  content: string;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  priority: number;
  expiresAfterUse: boolean;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export type StoryEditPatch =
  | { type: "insertMessage"; message: Message; index?: number }
  | { type: "deleteMessage"; messageId: string }
  | { type: "updateMessage"; messageId: string; content: string }
  | { type: "updateOpeningScene"; content: string };

export interface StoryEditHistoryEntry {
  id: string;
  label: string;
  createdAt: ISODateString;
  undo: StoryEditPatch;
  redo: StoryEditPatch;
}

export interface ActiveState {
  turn: number;
  forceIncludeNextTurn: ForceIncludeEntry[];
  triggerLog: TriggerLogEntry[];
  evaluationLog: EvaluationLogEntry[];
  memoryProposals: MemoryProposal[];
  pendingUpdates: PendingAdventureUpdate[];
  storyUndoStack: StoryEditHistoryEntry[];
  storyRedoStack: StoryEditHistoryEntry[];
  nextTurnNote: NextTurnNote;
  rawImports: RawImportEntry[];
  stateFlags: Record<string, string | number | boolean>;
  /** Per-adventure response length preference — injected as a length instruction into every turn. */
  responseLengthHint: ResponseLengthHint;
  /** Cumulative token usage for background calls (brain updates, evaluation, summary, scene state). */
  backgroundTokenUsage: { promptTokens: number; completionTokens: number };
  /** Set when the player's input matches a continuity challenge phrase. Consumed after one turn. */
  challengeMode: boolean;
  /** Turn number when the memory cycle last ran for this adventure. */
  lastMemoryCycleTurn?: number;
  /** Turn number when semantic evaluation last ran. */
  lastSemanticEvalTurn?: number;
  /** Turn number when scene state last ran. */
  lastSceneStateTurn?: number;
}

export interface Adventure {
  id: string;
  title: string;
  openingScene: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  metadata: JsonObject;
  autoSaveEnabled: boolean;
  autoSaveEveryNTurns: number;
  autoSaveEveryNMinutes?: number;
  components: ComponentEntry[];
  storyCards: StoryCard[];
  brains: BrainEntry[];
  triggerRules: TriggerRule[];
  rollingSummary: RollingSummary;
  sceneState?: RollingSummary;
  messages: Message[];
  activeState: ActiveState;
  tokenBudgetSettings: TokenBudgetSettings;
  modelConfig: ProviderConfig;
  semanticEvaluationSettings: SemanticEvaluationSettings;
  memoryAutoApprove: MemoryAutoApproveSettings;
  memoryDetectionSettings: MemoryDetectionSettings;
  systemTriggers: SystemTriggerSettings;
}

export interface MemoryAutoApproveSettings {
  summaryUpdate: boolean;
  plotEssentialsUpdate: boolean;
  currentArcUpdate: boolean;
  plotPressureUpdate: boolean;
  plotMomentumUpdate: boolean;
  storyCard: boolean;
  brainUpdate: boolean;
}

export interface AdventureThumbnailImage {
  dataUrl: string;
  name?: string;
  altText?: string;
  mimeType?: string;
  updatedAt?: ISODateString;
}

export interface NewAdventureSetup {
  title: string;
  openingScene: string;
  components: ComponentEntry[];
  storyCards: StoryCard[];
  thumbnailImage?: AdventureThumbnailImage;
}

export interface CloudSyncSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  createPrivateRepoIfMissing: boolean;
}

export interface GitHubSaveSettings {
  savesBasePath: string;
}

export interface GitHubSaveSlot {
  saveId: string;
  adventureId: string;
  title: string;
  savedAt: ISODateString;
  turnCount: number;
  saveType: "manual" | "auto";
}

export type ContextSectionKind =
  | "system"          // A. System Shell
  | "aiInstructions"  // B. AI Instructions components
  | "plotEssentials"  // C. Plot Essentials components
  | "currentArc"      // C2. Current Story Arc — active arc log with premise
  | "authorNote"      // D. Author's Note components
  | "components"      // E. General always-on / pinned components
  | "storyCards"      // F. Story Cards + Auto-Cards (triggered / pinned)
  | "brains"          // G. Brain entries
  | "rollingSummary"  // I. Rolling Summary — durable canon (deprecated, kept for saves compat)
  | "nextTurnNote"    // J. Next Output Bias
  | "recentMessages"  // K. Recent Messages
  | "sceneState"      // L. Scene State — current location, characters, situation (deprecated)
  | "challengeMode";  // M. Continuity Challenge — one-turn verification instruction

export type ExcludedReason = "budget_exceeded" | "inactive" | "cooldown" | "not_triggered";

export interface ContextItem {
  id: string;
  sourceType:
    | "system"
    | "component"
    | "storyCard"
    | "brain"
    | "summary"
    | "sceneState"
    | "nextTurnNote"
    | "message";
  title: string;
  content: string;
  priority: number;
  tokenEstimate: number;
  protected: boolean;
  pinned: boolean;
  active: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  generatedBy: "user" | "system" | "ai";
}

export interface ContextSection {
  id: ContextSectionKind;
  label: string;
  order: number;
  items: ContextItem[];
  content: string;
  tokenEstimate: number;
}

export interface ExcludedContextItem {
  id: string;
  sourceType: ContextItem["sourceType"];
  title: string;
  reason: ExcludedReason;
  detail?: string;
}

export interface ContextBuildDecision {
  itemId: string;
  sourceType: ContextItem["sourceType"];
  title: string;
  action: "included" | "excluded" | "dropped" | "truncated" | "ordered";
  reason: string;
  detail: string;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ContextBuildResult {
  messages: ChatMessage[];
  sections: ContextSection[];
  totalEstimatedTokens: number;
  excludedItems: ExcludedContextItem[];
  decisions: ContextBuildDecision[];
  /** Pending Memory Proposals — not in model context; shown in preview for user review. */
  pendingProposals: MemoryProposal[];
}

export type BrainStateField =
  | "currentState"
  | "thoughts"
  | "relationshipPressure"
  | "emotionalInterpretation"
  | "recentDevelopments"
  | "notes";

/** Patch produced by AI brain updates. thoughts is a Record where null values archive that key. */
export type BrainPatch = {
  currentState?: string;
  relationshipPressure?: string;
  emotionalInterpretation?: string;
  recentDevelopments?: string;
  notes?: string;
  thoughts?: Record<string, string | null>;
};

export type AdventureAction =
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_OPENING_SCENE"; content: string }
  | { type: "UPDATE_METADATA"; metadata: JsonObject }
  | { type: "ADD_MESSAGE"; role: MessageRole; content: string; id?: string; createdAt?: ISODateString; inputMode?: InputMode; usage?: ProviderUsage }
  | { type: "UPDATE_MESSAGE"; messageId: string; content: string }
  | { type: "DELETE_MESSAGE"; messageId: string }
  | { type: "DELETE_LAST_MESSAGE" }
  | { type: "REMOVE_LAST_ASSISTANT_MESSAGE" }
  | { type: "UNDO_STORY_EDIT" }
  | { type: "REDO_STORY_EDIT" }
  | { type: "INCREMENT_TURN" }
  | { type: "UPSERT_COMPONENT"; component: ComponentEntry }
  | { type: "DELETE_COMPONENT"; componentId: string }
  | { type: "ACTIVATE_COMPONENT"; componentId: string }
  | { type: "DEACTIVATE_COMPONENT"; componentId: string }
  | { type: "PIN_COMPONENT"; componentId: string }
  | { type: "UNPIN_COMPONENT"; componentId: string }
  | { type: "UPDATE_COMPONENT"; componentId: string; patch: Partial<ComponentEntry> }
  | { type: "APPLY_COMPONENT_UPDATE"; componentId: string; content: string }
  | { type: "REORDER_COMPONENT"; componentId: string; direction: "up" | "down" }
  | { type: "UPSERT_STORY_CARD"; storyCard: StoryCard }
  | { type: "DELETE_STORY_CARD"; storyCardId: string }
  | { type: "ACTIVATE_STORY_CARD"; storyCardId: string }
  | { type: "DEACTIVATE_STORY_CARD"; storyCardId: string }
  | { type: "PIN_STORY_CARD"; storyCardId: string }
  | { type: "UNPIN_STORY_CARD"; storyCardId: string }
  | { type: "UPDATE_STORY_CARD"; storyCardId: string; patch: Partial<StoryCard> }
  | { type: "APPLY_STORY_CARD_UPDATE"; storyCardId: string; content: string }
  | { type: "MARK_STORY_CARD_UPDATED"; storyCardId: string; turn: number }
  | { type: "MARK_COMPONENT_UPDATED"; componentId: string; turn: number }
  | { type: "ADVANCE_ARC_PACING"; triggeredIds: string[]; turn: number }
  | { type: "SET_ARC_PHASE"; componentId: string; phase: ArcPhase; turn?: number }
  | { type: "SET_ARC_CONTINUATIONS"; componentId: string; options: ArcContinuationOption[] }
  | { type: "APPLY_ARC_CONTINUATION"; componentId: string; option: ArcContinuationOption }
  | { type: "REORDER_STORY_CARD"; storyCardId: string; direction: "up" | "down" }
  | { type: "UPSERT_BRAIN"; brain: BrainEntry }
  | { type: "DELETE_BRAIN"; brainId: string }
  | { type: "ACTIVATE_BRAIN"; brainId: string }
  | { type: "DEACTIVATE_BRAIN"; brainId: string }
  | { type: "PIN_BRAIN"; brainId: string }
  | { type: "UNPIN_BRAIN"; brainId: string }
  | { type: "UPDATE_BRAIN"; brainId: string; patch: Partial<BrainEntry> }
  | { type: "APPEND_BRAIN_STATE"; brainId: string; field?: BrainStateField; text: string }
  | { type: "REPLACE_BRAIN_STATE"; brainId: string; field?: BrainStateField; text: string }
  | { type: "APPLY_BRAIN_UPDATE"; brainId: string; patch: BrainPatch; mode?: "replace" | "append"; turn?: number; preview?: string }
  | { type: "UPSERT_TRIGGER_RULE"; triggerRule: TriggerRule }
  | { type: "DELETE_TRIGGER_RULE"; triggerRuleId: string }
  | { type: "UPDATE_TRIGGER_RULE"; triggerRuleId: string; patch: Partial<TriggerRule> }
  | { type: "MARK_TRIGGER_FIRED"; triggerRuleId: string; turn: number }
  | { type: "LOG_TRIGGER_FIRE"; entry: TriggerLogEntry }
  | { type: "LOG_EVALUATION_RESULT"; entry: EvaluationLogEntry }
  | { type: "FORCE_INCLUDE_NEXT_TURN"; targetType: ForceIncludeTargetType; targetId: string }
  | { type: "ADD_RAW_IMPORT"; rawImport: RawImportEntry }
  | { type: "UPDATE_RAW_IMPORT"; rawImportId: string; patch: Partial<RawImportEntry> }
  | { type: "DELETE_RAW_IMPORT"; rawImportId: string }
  | { type: "ADD_MEMORY_PROPOSAL"; proposal: MemoryProposal }
  | { type: "UPDATE_MEMORY_PROPOSAL"; proposalId: string; patch: Partial<MemoryProposal> }
  | { type: "APPROVE_MEMORY_PROPOSAL"; proposalId: string; editedProposal?: Partial<MemoryProposal> }
  | { type: "REJECT_MEMORY_PROPOSAL"; proposalId: string }
  | { type: "IGNORE_MEMORY_PROPOSAL"; proposalId: string }
  | { type: "UPDATE_ROLLING_SUMMARY"; content: string; lastSummarizedMessageIndex?: number }
  | { type: "UPDATE_SCENE_STATE"; content: string }
  | { type: "SET_TOKEN_BUDGET_SETTINGS"; settings: TokenBudgetSettings }
  | { type: "SET_SYSTEM_TRIGGER_SETTINGS"; settings: SystemTriggerSettings }
  | { type: "SET_MODEL_CONFIG"; config: ProviderConfig }
  | { type: "SET_SEMANTIC_EVALUATION_SETTINGS"; settings: SemanticEvaluationSettings }
  | { type: "SET_MEMORY_AUTO_APPROVE"; settings: MemoryAutoApproveSettings }
  | { type: "SET_MEMORY_DETECTION_SETTINGS"; settings: MemoryDetectionSettings }
  | { type: "SET_STATE_FLAG"; key: string; value: string | number | boolean }
  | { type: "SET_RESPONSE_LENGTH_HINT"; hint: number }
  | { type: "ACCUMULATE_BACKGROUND_TOKENS"; promptTokens: number; completionTokens: number }
  | { type: "SET_NEXT_TURN_NOTE"; note: Partial<NextTurnNote> }
  | { type: "CLEAR_NEXT_TURN_NOTE" }
  | { type: "CONSUME_NEXT_TURN_NOTE" }
  | { type: "QUEUE_PENDING_UPDATE"; update: PendingAdventureUpdate }
  | { type: "FLUSH_PENDING_UPDATES" }
  | { type: "SET_CHALLENGE_MODE" }
  | { type: "SET_LAST_MEMORY_CYCLE_TURN"; turn: number }
  | { type: "SET_LAST_SEMANTIC_EVAL_TURN"; turn: number }
  | { type: "SET_LAST_SCENE_STATE_TURN"; turn: number }
  | { type: "RESET_RUNTIME_STATE" }
  | { type: "SET_AUTO_SAVE_SETTINGS"; autoSaveEnabled: boolean; autoSaveEveryNTurns: number; autoSaveEveryNMinutes?: number };
