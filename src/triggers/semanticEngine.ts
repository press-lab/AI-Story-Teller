import type {
  Adventure,
  AdventureAction,
  BrainEntry,
  BrainStateField,
  ChatMessage,
  ComponentEntry,
  EvaluatedCondition,
  EvaluationLogEntry,
  GeneratedContentPreview,
  MemoryProposal,
  ProviderConfig,
  Quest,
  QuestStep,
  StoryCard,
  TriggerAction,
  TriggerRule,
} from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { applyAIMemoryUpdate } from "../memory/applyAIMemoryUpdate";
import { createId, nowIso } from "../utils/id";
import { splitList } from "./matching";
import { isTriggerOnCooldown, triggerActionToAdventureActions } from "./triggerEngine";

const EVALUATION_SYSTEM_PROMPT =
  'You are an evaluation engine. Given a story excerpt, evaluate which conditions are currently true. Respond ONLY with a valid JSON array of condition IDs that are true. No explanation, no prose, no markdown. Example: ["id1", "id3"]';

interface SemanticCondition extends EvaluatedCondition {
  actionFactory: (adventure: Adventure) => TriggerAction[];
}

export interface SemanticRunResult {
  actions: AdventureAction[];
  logEntry: EvaluationLogEntry;
}

function evaluationConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  return {
    ...providerConfig,
    model: adventure.semanticEvaluationSettings.evaluationModel || providerConfig.model,
  };
}

function recentExcerpt(adventure: Adventure): string {
  return adventure.messages
    .slice(-adventure.semanticEvaluationSettings.messagesIncluded)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");
}

function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  return JSON.parse(fenced ?? trimmed) as T;
}

function preview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

function defaultBrainPrompt(brain: BrainEntry): string {
  return `You are modeling the internal state of ${brain.characterName}. Based on what just happened, update their mental state. Return ONLY valid JSON with any of these keys: currentState, thoughts, relationshipPressure, emotionalInterpretation, recentDevelopments. Only include keys that should change. Every value must be a plain string; do not return nested objects or arrays.`;
}

function storyCardPrompt(card: StoryCard): string {
  return `You are updating a persistent world fact card titled '${card.title}'. Current content: '${card.content}'. Based on what just happened, rewrite or extend this card. Return ONLY the new card content as a plain string. Be concise.`;
}

function componentPrompt(component: ComponentEntry): string {
  return `You are updating a context component titled '${component.title}'. Current content: '${component.content}'. Based on what just happened, update this component. Return ONLY the new content as a plain string.`;
}

function autoCardPrompt(adventure: Adventure): string {
  return adventure.autoCardSettings.generationPrompt;
}

function isAutoCardsOnCooldown(adventure: Adventure): boolean {
  const last = adventure.autoCardSettings.lastGeneratedTurn;
  if (last === undefined) return false;
  return adventure.activeState.turn - last < adventure.autoCardSettings.cooldownTurns;
}

function isStoryCardOnAutoUpdateCooldown(adventure: Adventure, card: StoryCard): boolean {
  const last = card.lastAutoUpdateTurn;
  if (last === undefined) return false;
  return adventure.activeState.turn - last < (card.autoUpdateCooldownTurns ?? 3);
}

function activeSemanticRules(adventure: Adventure): SemanticCondition[] {
  return adventure.triggerRules
    .filter((rule) => rule.enabled)
    .filter((rule) => (rule.evaluationMode ?? "semantic") === "semantic")
    .filter((rule) => Boolean(rule.condition.trim()))
    .filter((rule) => !isTriggerOnCooldown(adventure, rule))
    .map((rule) => ({
      id: `trigger:${rule.id}`,
      label: rule.name,
      condition: rule.condition,
      sourceType: "triggerRule" as const,
      actionFactory: () => rule.actions,
    }));
}

function brainConditions(adventure: Adventure): SemanticCondition[] {
  return adventure.brains
    .filter((brain) => brain.active)
    .map((brain) => ({
      id: `brain:${brain.id}`,
      label: `Brain: ${brain.characterName}`,
      condition: brain.updateCondition || `when ${brain.characterName} appears in the scene or is meaningfully referenced`,
      sourceType: "brain" as const,
      actionFactory: () => [{ type: brain.updateMode === "append" ? "appendBrain" : "updateBrain", brainId: brain.id }],
    }));
}

function questStepConditions(adventure: Adventure): SemanticCondition[] {
  return adventure.quests.flatMap((quest) => {
    if (quest.status !== "active") return [];
    const step = quest.steps.find((entry) => entry.id === quest.currentStepId);
    if (!step?.completionCondition.trim()) return [];
    return [
      {
        id: `questStep:${quest.id}:${step.id}`,
        label: `Quest step: ${quest.title} / ${step.title}`,
        condition: step.completionCondition,
        sourceType: "questStep" as const,
        actionFactory: () => [
          { type: "progressQuest", questId: quest.id, stepId: step.id },
          ...step.onCompleteActions,
        ],
      },
    ];
  });
}

function autoCardConditions(adventure: Adventure): SemanticCondition[] {
  if (!adventure.autoCardSettings.enabled || isAutoCardsOnCooldown(adventure)) return [];
  return [
    {
      id: "autoCards:global",
      label: "Auto-Cards global detector",
      condition: adventure.autoCardSettings.detectionCondition,
      sourceType: "autoCards" as const,
      actionFactory: () => [{ type: "createAutoCard" }],
    },
  ];
}

function plotEssentialsConditions(adventure: Adventure): SemanticCondition[] {
  return adventure.components
    .filter((c) => c.type === "plotEssentials" && c.active)
    .map((component) => ({
      id: `plotEssentials:${component.id}`,
      label: `Plot Essentials: ${component.title}`,
      condition: `when the story has revealed new plot-essential information, completed significant events, or established new permanent facts that should be recorded in "${component.title}" — ignore minor flavour details, only fire for durable canon changes`,
      sourceType: "component" as const,
      actionFactory: () => [{ type: "updateComponent" as const, componentId: component.id }],
    }));
}

function storyCardUpdateConditions(adventure: Adventure): SemanticCondition[] {
  return adventure.storyCards
    .filter((card) => card.active && card.autoUpdate)
    .filter((card) => !isStoryCardOnAutoUpdateCooldown(adventure, card))
    .map((card) => ({
      id: `storyCard:${card.id}`,
      label: `Story Card: ${card.title}`,
      condition: `when the story has established new details, developments, or changes that should update the fact card titled "${card.title}" — only fire when something meaningfully new has been revealed about this entity`,
      sourceType: "storyCard" as const,
      actionFactory: () => [{ type: "updateStoryCard" as const, storyCardId: card.id }],
    }));
}

function buildConditions(adventure: Adventure): SemanticCondition[] {
  if (!adventure.semanticEvaluationSettings.enabled) return [];
  return [
    ...activeSemanticRules(adventure),
    ...brainConditions(adventure),
    ...plotEssentialsConditions(adventure),
    ...storyCardUpdateConditions(adventure),
    ...questStepConditions(adventure),
    ...autoCardConditions(adventure),
  ];
}

async function evaluateConditionIds(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  conditions: SemanticCondition[],
): Promise<{ firedIds: string[]; errors: string[] }> {
  if (conditions.length === 0) return { firedIds: [], errors: [] };
  try {
    const response = await sendOpenAICompatibleChatCompletion({
      config: evaluationConfig(adventure, providerConfig),
      messages: [
        { role: "system", content: EVALUATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify(
            {
              storyExcerpt: recentExcerpt(adventure),
              conditions: conditions.map(({ id, condition }) => ({ id, condition })),
            },
            null,
            2,
          ),
        },
      ],
    });
    const parsed = parseJsonResponse<unknown>(response.content);
    if (!Array.isArray(parsed)) return { firedIds: [], errors: ["Semantic condition response was not an array."] };
    return { firedIds: parsed.filter((id): id is string => typeof id === "string"), errors: [] };
  } catch (error) {
    return { firedIds: [], errors: [error instanceof Error ? error.message : "Semantic condition evaluation failed."] };
  }
}

function immediateActionsFor(adventure: Adventure, triggerAction: TriggerAction): AdventureAction[] {
  if (triggerAction.type === "updateBrain" || triggerAction.type === "appendBrain" || triggerAction.type === "createAutoCard") return [];
  if (triggerAction.type === "progressQuest") {
    return [{ type: "COMPLETE_QUEST_STEP", questId: triggerAction.questId, stepId: triggerAction.stepId }];
  }
  return triggerActionToAdventureActions(adventure, triggerAction);
}

function isGeneratedAction(action: TriggerAction): boolean {
  return (
    action.type === "updateBrain" ||
    action.type === "appendBrain" ||
    action.type === "updateStoryCard" ||
    action.type === "updateComponent" ||
    action.type === "createAutoCard"
  );
}

async function sendTargetedUpdate(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  prompt: string,
): Promise<string> {
  const response = await sendOpenAICompatibleChatCompletion({
    config: evaluationConfig(adventure, providerConfig),
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: recentExcerpt(adventure) || "No recent history is available." },
    ],
  });
  return response.content.trim();
}

function sanitizeBrainPatch(value: unknown): Partial<Record<BrainStateField, string>> {
  if (!value || typeof value !== "object") return {};
  const allowed: BrainStateField[] = [
    "currentState",
    "thoughts",
    "relationshipPressure",
    "emotionalInterpretation",
    "recentDevelopments",
  ];

  function stringifyValue(item: unknown): string | undefined {
    if (typeof item === "string") return item.trim() || undefined;
    if (typeof item === "number" || typeof item === "boolean") return String(item);
    if (Array.isArray(item)) {
      const text = item
        .map((entry) => stringifyValue(entry))
        .filter(Boolean)
        .join("; ");
      return text || undefined;
    }
    if (item && typeof item === "object") {
      const text = Object.entries(item as Record<string, unknown>)
        .map(([key, entry]) => {
          const valueText = stringifyValue(entry);
          return valueText ? `${key}: ${valueText}` : undefined;
        })
        .filter(Boolean)
        .join("; ");
      return text || undefined;
    }
    return undefined;
  }

  return Object.fromEntries(
    allowed.flatMap((key) => {
      const item = (value as Record<string, unknown>)[key];
      const text = stringifyValue(item);
      return text ? [[key, text]] : [];
    }),
  ) as Partial<Record<BrainStateField, string>>;
}

function makeProposal(
  fields: {
    proposedType: MemoryProposal["proposedType"];
    title: string;
    content: string;
    suggestedTriggers?: string[];
    targetId?: string;
    rationale?: string;
  },
  adventure: Adventure,
): MemoryProposal {
  const now = nowIso();
  return {
    id: createId("proposal"),
    sourceTurnId: String(adventure.activeState.turn),
    sourceText: "",
    proposedType: fields.proposedType,
    title: fields.title,
    content: fields.content,
    suggestedTriggers: fields.suggestedTriggers ?? [],
    confidence: 0.8,
    rationale: fields.rationale ?? "Auto-generated by semantic evaluation.",
    status: "pending",
    targetId: fields.targetId,
    createdAt: now,
    updatedAt: now,
  };
}

async function generatedActionsFor(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  triggerAction: TriggerAction,
  conditionId: string,
  rule?: TriggerRule,
): Promise<{ actions: AdventureAction[]; generated?: GeneratedContentPreview; error?: string }> {
  const requireApproval = adventure.semanticEvaluationSettings.requireApprovalForAutoUpdates;
  try {
    if (triggerAction.type === "updateBrain" || triggerAction.type === "appendBrain") {
      const brain = adventure.brains.find((entry) => entry.id === triggerAction.brainId);
      if (!brain) return { actions: [], error: `Brain not found: ${triggerAction.brainId}` };
      const raw = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || brain.updatePrompt || defaultBrainPrompt(brain));
      const patch = sanitizeBrainPatch(parseJsonResponse<unknown>(raw));
      if (Object.keys(patch).length === 0) return { actions: [], error: `Brain update returned no recognized keys for ${brain.characterName}.` };
      if (requireApproval) {
        const proposal = makeProposal(
          { proposedType: "brainUpdate", title: brain.characterName, content: JSON.stringify(patch), targetId: brain.id, rationale: `Auto-update for ${brain.characterName}.` },
          adventure,
        );
        return {
          actions: [{ type: "ADD_MEMORY_PROPOSAL", proposal }],
          generated: { targetType: "brain", targetId: brain.id, title: brain.characterName, preview: preview(raw) },
        };
      }
      const memoryUpdate = applyAIMemoryUpdate(adventure, [
        {
          type: "brainPatch",
          brainId: brain.id,
          patch,
          mode: triggerAction.type === "appendBrain" ? "append" : brain.updateMode,
          turn: adventure.activeState.turn,
          preview: preview(raw),
        },
      ]);
      return {
        actions: memoryUpdate.actions,
        generated: { targetType: "brain", targetId: brain.id, title: brain.characterName, preview: preview(raw) },
        error: memoryUpdate.rejectedUpdates[0]?.reason,
      };
    }

    if (triggerAction.type === "updateStoryCard") {
      const card = adventure.storyCards.find((entry) => entry.id === triggerAction.storyCardId);
      if (!card) return { actions: [], error: `Story card not found: ${triggerAction.storyCardId}` };
      const content = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || storyCardPrompt(card));
      if (requireApproval) {
        const proposal = makeProposal(
          { proposedType: "storyCard", title: card.title, content, suggestedTriggers: card.keys, targetId: card.id, rationale: `Auto-update for story card "${card.title}".` },
          adventure,
        );
        return {
          actions: [
            { type: "ADD_MEMORY_PROPOSAL", proposal },
            { type: "MARK_STORY_CARD_UPDATED", storyCardId: card.id, turn: adventure.activeState.turn },
          ],
          generated: { targetType: "storyCard", targetId: card.id, title: card.title, preview: preview(content) },
        };
      }
      const memoryUpdate = applyAIMemoryUpdate(adventure, [
        { type: "storyCardUpdate", storyCardId: card.id, content },
      ]);
      return {
        actions: [
          ...memoryUpdate.actions,
          { type: "MARK_STORY_CARD_UPDATED", storyCardId: card.id, turn: adventure.activeState.turn },
        ],
        generated: { targetType: "storyCard", targetId: card.id, title: card.title, preview: preview(content) },
        error: memoryUpdate.rejectedUpdates[0]?.reason,
      };
    }

    if (triggerAction.type === "updateComponent") {
      const component = adventure.components.find((entry) => entry.id === triggerAction.componentId);
      if (!component) return { actions: [], error: `Component not found: ${triggerAction.componentId}` };
      const content = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || componentPrompt(component));
      if (requireApproval) {
        const proposal = makeProposal(
          { proposedType: "plotEssentialsUpdate", title: component.title, content, targetId: component.id, rationale: `Auto-update for "${component.title}".` },
          adventure,
        );
        return {
          actions: [{ type: "ADD_MEMORY_PROPOSAL", proposal }],
          generated: { targetType: "component", targetId: component.id, title: component.title, preview: preview(content) },
        };
      }
      const memoryUpdate = applyAIMemoryUpdate(adventure, [
        { type: "componentUpdate", componentId: component.id, content },
      ]);
      return {
        actions: memoryUpdate.actions,
        generated: { targetType: "component", targetId: component.id, title: component.title, preview: preview(content) },
        error: memoryUpdate.rejectedUpdates[0]?.reason,
      };
    }

    if (triggerAction.type === "createAutoCard") {
      const raw = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || autoCardPrompt(adventure));
      const parsed = parseJsonResponse<{ title?: unknown; content?: unknown; keys?: unknown }>(raw);
      if (typeof parsed.title !== "string" || typeof parsed.content !== "string") {
        return { actions: [], error: "Auto-Card generation returned invalid JSON." };
      }
      const keys = typeof parsed.keys === "string" ? splitList(parsed.keys) : [];
      return {
        actions: [
          {
            type: "CREATE_AUTO_CARD",
            title: parsed.title,
            content: parsed.content,
            keys,
            turn: adventure.activeState.turn,
            conditionId,
            rawResponse: raw,
          },
        ],
        generated: { targetType: "autoCard", title: parsed.title, preview: preview(parsed.content) },
      };
    }

    return { actions: [] };
  } catch (error) {
    return { actions: [], error: error instanceof Error ? error.message : "Generated update failed." };
  }
}

async function runLimited<T>(limit: number, tasks: Array<() => Promise<T>>): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runSemanticPostTurnEvaluation(
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<SemanticRunResult> {
  const conditions = buildConditions(adventure);
  const { firedIds, errors } = await evaluateConditionIds(adventure, providerConfig, conditions);
  const fired = conditions.filter((condition) => firedIds.includes(condition.id));
  const actions: AdventureAction[] = [];
  const generatedContent: GeneratedContentPreview[] = [];
  const actionsExecuted: string[] = [];

  const generationTasks: Array<() => Promise<{ actions: AdventureAction[]; generated?: GeneratedContentPreview; error?: string }>> = [];

  for (const condition of fired) {
    const sourceRule =
      condition.sourceType === "triggerRule"
        ? adventure.triggerRules.find((rule) => `trigger:${rule.id}` === condition.id)
        : undefined;
    const triggerActions = condition.actionFactory(adventure);
    for (const triggerAction of triggerActions) {
      if (isGeneratedAction(triggerAction)) {
        generationTasks.push(() => generatedActionsFor(adventure, providerConfig, triggerAction, condition.id, sourceRule));
        actionsExecuted.push(`${condition.label}: ${triggerAction.type} (generated)`);
      } else {
        const mapped = immediateActionsFor(adventure, triggerAction);
        actions.push(...mapped);
        actionsExecuted.push(`${condition.label}: ${triggerAction.type}`);
      }
    }
    if (sourceRule) actions.push({ type: "MARK_TRIGGER_FIRED", triggerRuleId: sourceRule.id, turn: adventure.activeState.turn });
  }

  const generatedResults = await runLimited(adventure.semanticEvaluationSettings.maxParallelUpdateCalls, generationTasks);
  for (const result of generatedResults) {
    actions.push(...result.actions);
    if (result.generated) generatedContent.push(result.generated);
    if (result.error) errors.push(result.error);
  }

  const logEntry: EvaluationLogEntry = {
    id: createId("evaluation"),
    turn: adventure.activeState.turn,
    createdAt: nowIso(),
    conditionsEvaluated: conditions.map(({ id, label, condition, sourceType }) => ({ id, label, condition, sourceType })),
    conditionsFired: firedIds,
    actionsExecuted,
    generatedContent,
    errors,
  };

  return { actions: [...actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
}

export async function runManualBrainUpdate(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  brainId: string,
): Promise<SemanticRunResult> {
  const brain = adventure.brains.find((entry) => entry.id === brainId);
  const emptyLog: EvaluationLogEntry = {
    id: createId("evaluation"),
    turn: adventure.activeState.turn,
    createdAt: nowIso(),
    conditionsEvaluated: [],
    conditionsFired: [],
    actionsExecuted: [],
    generatedContent: [],
    errors: [],
  };
  if (!brain) {
    const errorLog = { ...emptyLog, errors: [`Brain not found: ${brainId}`] };
    return { actions: [{ type: "LOG_EVALUATION_RESULT", entry: errorLog }], logEntry: errorLog };
  }
  const result = await generatedActionsFor(
    adventure,
    providerConfig,
    { type: brain.updateMode === "append" ? "appendBrain" : "updateBrain", brainId },
    `manualBrain:${brainId}`,
  );
  const logEntry = {
    ...emptyLog,
    conditionsFired: [`manualBrain:${brainId}`],
    actionsExecuted: [`Manual brain update: ${brain.characterName}`],
    generatedContent: result.generated ? [result.generated] : [],
    errors: result.error ? [result.error] : [],
  };
  return { actions: [...result.actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
}

export async function runManualAutoCardGeneration(
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<SemanticRunResult> {
  const result = await generatedActionsFor(adventure, providerConfig, { type: "createAutoCard" }, "manualAutoCards");
  const logEntry: EvaluationLogEntry = {
    id: createId("evaluation"),
    turn: adventure.activeState.turn,
    createdAt: nowIso(),
    conditionsEvaluated: [
      {
        id: "manualAutoCards",
        label: "Manual Auto-Card generation",
        condition: "Manual Generate now request",
        sourceType: "autoCards",
      },
    ],
    conditionsFired: ["manualAutoCards"],
    actionsExecuted: ["Manual Auto-Card generation"],
    generatedContent: result.generated ? [result.generated] : [],
    errors: result.error ? [result.error] : [],
  };
  return { actions: [...result.actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
}

export async function runRememberThis(
  adventure: Adventure,
  config: ProviderConfig,
  fact: string,
): Promise<SemanticRunResult> {
  const cardList = adventure.storyCards
    .filter((c) => c.active)
    .map((c) => `[ID: ${c.id}] "${c.title}": ${c.content.slice(0, 150)}`)
    .join("\n");

  const brainList = adventure.brains
    .filter((b) => b.active)
    .map((b) => `[ID: ${b.id}] ${b.characterName}: ${b.currentState.slice(0, 100)}`)
    .join("\n");

  const systemPrompt = `You are a world memory assistant for an interactive fiction game. The player wants to record an important story fact.

Examine the fact against existing story cards and characters:
- If the fact is a property or development of existing entities, propose updating those cards (action "update" with the cardId)
- If the fact is a distinct event, concept, or relationship with its own identity, propose a new card (action "create")
- You may propose both updates AND a new card for the same fact

Respond ONLY with valid JSON:
{
  "proposals": [
    { "action": "update", "cardId": "existing-card-id", "title": "Card Title", "content": "Full updated card content", "keys": ["keyword1"] },
    { "action": "create", "title": "New Card Title", "content": "New card content", "keys": ["keyword1", "keyword2"] }
  ],
  "rationale": "Brief explanation of choices"
}`;

  const userPrompt = `Fact to record: "${fact}"\n\nExisting Story Cards:\n${cardList || "(none)"}\n\nExisting Characters:\n${brainList || "(none)"}`;

  const emptyLog: EvaluationLogEntry = {
    id: createId("evaluation"),
    turn: adventure.activeState.turn,
    createdAt: nowIso(),
    conditionsEvaluated: [],
    conditionsFired: [],
    actionsExecuted: [],
    generatedContent: [],
    errors: [],
  };

  try {
    const response = await sendOpenAICompatibleChatCompletion({
      config: evaluationConfig(adventure, config),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const parsed = parseJsonResponse<{
      proposals: Array<{
        action: "update" | "create";
        cardId?: string;
        title: string;
        content: string;
        keys: string[];
      }>;
      rationale: string;
    }>(response.content);

    const actions: AdventureAction[] = [];
    const now = nowIso();
    const turnId = String(adventure.activeState.turn);

    for (const p of parsed.proposals) {
      const proposal: MemoryProposal = {
        id: createId("proposal"),
        sourceTurnId: turnId,
        sourceText: fact,
        proposedType: "storyCard",
        title: p.title,
        content: p.content,
        suggestedTriggers: Array.isArray(p.keys) ? p.keys : splitList(String(p.keys ?? "")),
        confidence: 0.9,
        rationale: parsed.rationale,
        status: "pending",
        targetId: p.action === "update" ? p.cardId : undefined,
        createdAt: now,
        updatedAt: now,
      };
      actions.push({ type: "ADD_MEMORY_PROPOSAL", proposal });
    }

    const logEntry: EvaluationLogEntry = {
      ...emptyLog,
      conditionsFired: ["rememberThis"],
      actionsExecuted: [`Remember This: ${parsed.proposals.length} proposal(s) — ${parsed.rationale}`],
    };

    return { actions: [...actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const logEntry = { ...emptyLog, errors: [error] };
    return { actions: [{ type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
  }
}
