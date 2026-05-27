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
  createdAt: ISODateString;
}

export type ComponentType =
  | "aiInstructions"
  | "plotEssentials"
  | "authorNote"
  | "memory"
  | "custom";

export interface ComponentEntry {
  id: string;
  title: string;
  type: ComponentType;
  content: string;
  priority: number;
  alwaysOn: boolean;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  state: string;
  tokenBudget?: number;
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
  aliases: string[];
  triggers: string[];
  source?: "manual" | "imported" | "generated";
  currentState: string;
  thoughts: string;
  relationshipPressure: string;
  emotionalInterpretation: string;
  recentDevelopments: string;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  priority: number;
  tokenBudget?: number;
  updateCondition: string;
  updatePrompt: string;
  updateMode: "replace" | "append";
  lastUpdatedTurn?: number;
  lastUpdatedAt?: ISODateString;
  lastGeneratedUpdatePreview?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type AutoCardSource = "manual" | "imported" | "generated";
export type AutoCardUpdateMode = "manual" | "append" | "replace";

export interface AutoCard {
  id: string;
  title: string;
  detectedEntity: string;
  triggers: string[];
  content: string;
  source: AutoCardSource;
  active: boolean;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
  priority: number;
  updateMode: AutoCardUpdateMode;
  cooldownTurns: number;
  lastUpdatedTurn?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type TriggerSource = "input" | "output" | "both";
export type TriggerMatchType = "keyword" | "phrase" | "regex";
export type TriggerEvaluationMode = "semantic" | "keyword" | "regex";

export interface TriggerCondition {
  field: "turn" | "questStatus" | "stateFlag";
  operator: "equals" | "notEquals" | "gte" | "lte" | "includes";
  value: string | number | boolean;
  questId?: string;
  key?: string;
}

export type TriggerAction =
  | { type: "activateComponent"; componentId: string }
  | { type: "deactivateComponent"; componentId: string }
  | { type: "pinComponent"; componentId: string }
  | { type: "unpinComponent"; componentId: string }
  | { type: "updateComponent"; componentId: string; patch?: Partial<ComponentEntry> }
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
  | { type: "startQuest"; questId: string }
  | { type: "progressQuest"; questId: string; stepId?: string }
  | { type: "completeQuest"; questId: string }
  | { type: "activateQuestCard"; questId: string; storyCardId?: string }
  | { type: "createMilestoneCard"; questId?: string; title: string; content: string }
  | { type: "createAutoCard"; questId?: string }
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

export type QuestStatus = "inactive" | "active" | "completed" | "failed";
export type QuestStepStatus = "pending" | "active" | "completed" | "failed";

export interface QuestStep {
  id: string;
  title: string;
  objective: string;
  status: QuestStepStatus;
  completionCondition: string;
  triggerConditions: TriggerCondition[];
  onStartActions: TriggerAction[];
  onCompleteActions: TriggerAction[];
  contextText: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  currentStepId?: string;
  steps: QuestStep[];
  relatedCards: string[];
  priority: number;
  pinned: boolean;
  protected: boolean;
  inclusionPolicy: ContextInclusionPolicy;
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

export interface SemanticEvaluationSettings {
  evaluationModel: string;
  messagesIncluded: number;
  enabled: boolean;
  showLog: boolean;
  maxParallelUpdateCalls: number;
  /** When true, all LLM-generated memory updates go to the inbox for approval instead of applying directly. */
  requireApprovalForAutoUpdates: boolean;
}

export interface AutoCardSettings {
  enabled: boolean;
  detectionCondition: string;
  generationPrompt: string;
  cooldownTurns: number;
  lastGeneratedTurn?: number;
}

export type ForceIncludeTargetType = "component" | "storyCard" | "brain" | "autoCard" | "quest";

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

export type MemoryProposalType =
  | "storyCard"
  | "brainUpdate"
  | "plotEssentialsUpdate"
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
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AutoCardReviewItem {
  id: string;
  title: string;
  content: string;
  keys: string[];
  source: "generated";
  generatedAtTurn: number;
  conditionId?: string;
  rawResponse?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface EvaluatedCondition {
  id: string;
  label: string;
  condition: string;
  sourceType: "triggerRule" | "brain" | "questStep" | "autoCards" | "component" | "storyCard";
}

export interface GeneratedContentPreview {
  targetType: "brain" | "component" | "storyCard" | "autoCard";
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
  source: "semanticEvaluation" | "autoSummary" | "manual";
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
  autoCardReviewQueue: AutoCardReviewItem[];
  memoryProposals: MemoryProposal[];
  pendingUpdates: PendingAdventureUpdate[];
  storyUndoStack: StoryEditHistoryEntry[];
  storyRedoStack: StoryEditHistoryEntry[];
  nextTurnNote: NextTurnNote;
  rawImports: RawImportEntry[];
  stateFlags: Record<string, string | number | boolean>;
  /** Per-adventure response length preference — injected as a length instruction into every turn. */
  responseLengthHint: ResponseLengthHint;
}

export interface Adventure {
  id: string;
  title: string;
  openingScene: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  metadata: JsonObject;
  components: ComponentEntry[];
  storyCards: StoryCard[];
  brains: BrainEntry[];
  autoCards: AutoCard[];
  triggerRules: TriggerRule[];
  quests: Quest[];
  questState: JsonObject;
  rollingSummary: RollingSummary;
  messages: Message[];
  activeState: ActiveState;
  tokenBudgetSettings: TokenBudgetSettings;
  modelConfig: ProviderConfig;
  semanticEvaluationSettings: SemanticEvaluationSettings;
  autoCardSettings: AutoCardSettings;
}

export interface NewAdventureSetup {
  title: string;
  openingScene: string;
  components: ComponentEntry[];
  storyCards: StoryCard[];
}

export interface CloudSyncSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  createPrivateRepoIfMissing: boolean;
}

export type ContextSectionKind =
  | "system"          // A. System Shell
  | "aiInstructions"  // B. AI Instructions components
  | "plotEssentials"  // C. Plot Essentials components
  | "authorNote"      // D. Author's Note components
  | "components"      // E. General always-on / pinned components
  | "storyCards"      // F. Story Cards + Auto-Cards (triggered / pinned)
  | "brains"          // G. Brain entries
  | "questState"      // H. Active quest state
  | "rollingSummary"  // I. Rolling Summary
  | "nextTurnNote"    // J. Next Output Bias
  | "recentMessages"; // K. Recent Messages

export type ExcludedReason = "budget_exceeded" | "inactive" | "cooldown" | "not_triggered";

export interface ContextItem {
  id: string;
  sourceType:
    | "system"
    | "component"
    | "storyCard"
    | "brain"
    | "autoCard"
    | "quest"
    | "summary"
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
  | "recentDevelopments";

export type AdventureAction =
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_OPENING_SCENE"; content: string }
  | { type: "UPDATE_METADATA"; metadata: JsonObject }
  | { type: "ADD_MESSAGE"; role: MessageRole; content: string; id?: string; createdAt?: ISODateString; inputMode?: InputMode }
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
  | { type: "APPLY_BRAIN_UPDATE"; brainId: string; patch: Partial<Record<BrainStateField, string>>; mode?: "replace" | "append"; turn?: number; preview?: string }
  | { type: "UPSERT_AUTO_CARD"; autoCard: AutoCard }
  | { type: "DELETE_AUTO_CARD"; autoCardId: string }
  | { type: "ACTIVATE_AUTO_CARD"; autoCardId: string }
  | { type: "DEACTIVATE_AUTO_CARD"; autoCardId: string }
  | { type: "UPDATE_AUTO_CARD"; autoCardId: string; patch: Partial<AutoCard> }
  | { type: "MARK_AUTO_CARD_UPDATED"; autoCardId: string; turn: number }
  | { type: "CREATE_AUTO_CARD"; title: string; content: string; keys: string[]; turn: number; conditionId?: string; rawResponse?: string }
  | { type: "APPROVE_AUTO_CARD"; reviewId: string; patch?: Partial<Pick<AutoCardReviewItem, "title" | "content" | "keys">> }
  | { type: "DISCARD_AUTO_CARD"; reviewId: string }
  | { type: "UPSERT_TRIGGER_RULE"; triggerRule: TriggerRule }
  | { type: "DELETE_TRIGGER_RULE"; triggerRuleId: string }
  | { type: "UPDATE_TRIGGER_RULE"; triggerRuleId: string; patch: Partial<TriggerRule> }
  | { type: "MARK_TRIGGER_FIRED"; triggerRuleId: string; turn: number }
  | { type: "LOG_TRIGGER_FIRE"; entry: TriggerLogEntry }
  | { type: "LOG_EVALUATION_RESULT"; entry: EvaluationLogEntry }
  | { type: "UPSERT_QUEST"; quest: Quest }
  | { type: "DELETE_QUEST"; questId: string }
  | { type: "START_QUEST"; questId: string }
  | { type: "PROGRESS_QUEST"; questId: string; stepId?: string }
  | { type: "COMPLETE_QUEST"; questId: string }
  | { type: "COMPLETE_QUEST_STEP"; questId: string; stepId?: string }
  | { type: "FAIL_QUEST"; questId: string }
  | { type: "ACTIVATE_QUEST_CARD"; questId: string; storyCardId?: string }
  | { type: "CREATE_MILESTONE_CARD"; questId?: string; title: string; content: string }
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
  | { type: "SET_TOKEN_BUDGET_SETTINGS"; settings: TokenBudgetSettings }
  | { type: "SET_MODEL_CONFIG"; config: ProviderConfig }
  | { type: "SET_SEMANTIC_EVALUATION_SETTINGS"; settings: SemanticEvaluationSettings }
  | { type: "SET_AUTO_CARD_SETTINGS"; settings: AutoCardSettings }
  | { type: "SET_STATE_FLAG"; key: string; value: string | number | boolean }
  | { type: "SET_RESPONSE_LENGTH_HINT"; hint: number }
  | { type: "SET_NEXT_TURN_NOTE"; note: Partial<NextTurnNote> }
  | { type: "CLEAR_NEXT_TURN_NOTE" }
  | { type: "CONSUME_NEXT_TURN_NOTE" }
  | { type: "QUEUE_PENDING_UPDATE"; update: PendingAdventureUpdate }
  | { type: "FLUSH_PENDING_UPDATES" }
  | { type: "RESET_RUNTIME_STATE" };
