import type {
  Adventure,
  AdventureAction,
  BrainEntry,
  BrainPatch,
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
import { matchPatterns, splitList } from "./matching";
import { isTriggerOnCooldown, triggerActionToAdventureActions } from "./triggerEngine";

const EVALUATION_SYSTEM_PROMPT =
  'You are an evaluation engine. Given a story excerpt, evaluate which conditions are currently true. Respond ONLY with a valid JSON array of condition IDs that are true. No explanation, no prose, no markdown. Example: ["id1", "id3"]';

interface SemanticCondition extends EvaluatedCondition {
  actionFactory: (adventure: Adventure) => TriggerAction[];
}

export interface SemanticRunResult {
  actions: AdventureAction[];
  logEntry: EvaluationLogEntry;
  tokenUsage?: { promptTokens: number; completionTokens: number };
}

function evaluationConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (bg?.baseUrl) {
    return {
      ...providerConfig,
      baseUrl: bg.baseUrl,
      apiKey: bg.apiKey ?? providerConfig.apiKey,
      model: bg.model || providerConfig.model,
    };
  }
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

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function parseJsonResponse<T>(text: string): T {
  const trimmed = stripThinkTags(text);
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  return JSON.parse(fenced ?? trimmed) as T;
}

function preview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

function defaultBrainPrompt(brain: BrainEntry, turn: number): string {
  const existing: string[] = [];
  if (brain.currentState?.trim()) existing.push(`currentState: ${brain.currentState}`);
  const thoughtEntries = Object.entries(brain.thoughts);
  if (thoughtEntries.length > 0) {
    existing.push(`thoughts (existing — do NOT repeat these):\n${thoughtEntries.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`);
  }
  if (brain.relationshipPressure?.trim()) existing.push(`relationshipPressure: ${brain.relationshipPressure}`);
  if (brain.emotionalInterpretation?.trim()) existing.push(`emotionalInterpretation: ${brain.emotionalInterpretation}`);
  if (brain.recentDevelopments?.trim()) existing.push(`recentDevelopments: ${brain.recentDevelopments}`);
  const stateBlock = existing.length > 0 ? `\n\nEstablished state — maintain this voice and psychology:\n${existing.join("\n")}` : "";
  return `You are adding one new inner observation for ${brain.characterName} based on what just happened in the scene. Current turn: ${turn}.${stateBlock}

Return ONLY valid JSON. Only include keys that actually changed.

For "thoughts": return an object where each key is a snake_case label and each value is "${turn} → first-person observation". Add ONE new thought entry. Optionally set one stale entry to null to delete it. Write in ${brain.characterName}'s own first-person voice from their specific vantage point — not a generic participant. Name actual people, cite what was said or done, say what it privately means. Never use generic labels ("excited", "focused", "intense").
Example: { "thoughts": { "azula_evaluates_setu_power": "${turn} → Setu matched her escalation without flinching. That's either confidence or recklessness — I need to know which before I point him at something." } }

Other updatable fields — all in first person from ${brain.characterName}'s voice (e.g. currentState: "I'm holding ground but watching for the moment Azula shifts"): currentState, relationshipPressure, emotionalInterpretation, recentDevelopments.`;
}

const BRAIN_CONDENSE_THRESHOLD = 1600;

function condenseBrainPrompt(brain: BrainEntry, fullThoughts: Record<string, string>, fullRecent: string): string {
  const thoughtsFormatted = Object.entries(fullThoughts).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  return `You are pruning ${brain.characterName}'s thought log because it has grown too long. Keep the 3-5 most important and still-relevant entries. Delete the rest by setting them to null.
${brain.notes ? `\nExisting notes log (do NOT modify):\n${brain.notes}` : ""}

Current thought entries:
${thoughtsFormatted}
${fullRecent ? `\nRecent developments to condense:\n${fullRecent}` : ""}

Return ONLY valid JSON:
{
  "thoughts": { "key_to_keep": "${brain.lastUpdatedTurn ?? 0} → text unchanged", "key_to_delete": null },
  "recentDevelopments": "condensed to 1-3 items if applicable, otherwise omit this key",
  "notes": "one short line summarizing what was compressed, e.g. \\"Compressed turns 40-80: garden walk, cellar tension, council aftermath\\""
}

Keep all values in first-person voice. The notes value gets appended to the permanent log.`;
}

function storyCardPrompt(card: StoryCard): string {
  return `You are updating a persistent world fact card titled '${card.title}'.

Current content:
${card.content}

Based on what just happened, rewrite or extend this card. Format the content as concise bullet points, one per line, using the • character. Each bullet should be a single self-contained fact, trait, or rule. Preserve all existing facts that are still true; update or remove only what has changed.

Example format:
• Fact or trait about the entity.
• Another fact or current status.
• Rule or constraint the story should respect.

Return ONLY the bullet-pointed content — no title, no headers, no commentary.`;
}

function componentPrompt(component: ComponentEntry): string {
  return `You are updating a context component titled "${component.title}". Current content: "${component.content}". Based on what just happened, update this component. Return ONLY the new content as a plain string.`;
}

function plotPressurePrompt(adventure: Adventure): string {
  const current = adventure.components.find((c) => c.type === "activePressure")?.content ?? "(none)";
  return `You are updating the Active Pressure for this story.

Active Pressure is the current threat, obligation, or force bearing on the player character — what is pushing or threatening them right now at the story level. It replaces the previous value entirely when it changes.

Current Active Pressure:
${current}

Write 1–3 sentences describing the current active pressure. Return ONLY the new content as plain text.`;
}

function plotMomentumPrompt(adventure: Adventure): string {
  const current = adventure.components.find((c) => c.type === "immediateMomentum")?.content ?? "(none)";
  return `You are updating the Immediate Momentum for this story.

Immediate Momentum describes the concrete next move or decision the story is driving toward — what action, confrontation, or choice is immediately in front of the player character. It is a direction, not a mood.

GOOD: "Setu needs to answer Kael's challenge before they reach the gate."
GOOD: "The group is moving toward the war room to deliver the report."
BAD: "The tension between them lingers, pulling toward connection." (mood, not direction)
BAD: "Unspoken feelings hang in the air." (subtext, not a next move)

Current Immediate Momentum:
${current}

Write 1–2 sentences stating what concrete action or decision is immediately ahead. Return ONLY the new content as plain text.`;
}

function autoCardPrompt(adventure: Adventure): string {
  const base = adventure.autoCardSettings.generationPrompt;
  return `${base}\n\nAdditional exclusions: Do NOT include "currently aboard [ship/location]", "currently assigned to [mission]", "is now present in [location]", or any other "currently X" facts. If the only noteworthy detail is scene presence or current location, do not create a card — that belongs in Scene State.`;
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
  const excerpt = recentExcerpt(adventure);
  return adventure.brains
    .filter((brain) => brain.active)
    .filter((brain) => {
      // Pre-filter: skip semantic evaluation entirely if character has no presence in recent text.
      // Saves one evaluation slot and a generation call when the character wasn't in the scene.
      const patterns = [brain.characterName, ...brain.aliases, ...brain.triggers].filter(Boolean);
      return patterns.length === 0 || matchPatterns(excerpt, patterns, "phrase").matched;
    })
    .map((brain) => ({
      id: `brain:${brain.id}`,
      label: `Brain: ${brain.characterName}`,
      condition: brain.updateCondition || `when something in this scene causes a genuine shift for ${brain.characterName}: a new realization, emotional pivot, changed read on another character, or meaningful reaction to events — do NOT fire just because they appear or speak`,
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
  const queued = adventure.activeState.autoCardReviewQueue.map((item) => item.title);
  const knownCards = adventure.storyCards.map((c) => c.title);
  const knownAll = [...new Set([...queued, ...knownCards])];
  const alreadyKnown = knownAll.length > 0 ? ` Do NOT fire for any of these already-known entities: ${knownAll.join(", ")}.` : "";
  return [
    {
      id: "autoCards:global",
      label: "Auto-Cards global detector",
      condition: `${adventure.autoCardSettings.detectionCondition}${alreadyKnown}`,
      sourceType: "autoCards" as const,
      actionFactory: () => [{ type: "createAutoCard" }],
    },
  ];
}

function plotEssentialsConditions(adventure: Adventure): SemanticCondition[] {
  return adventure.components
    .filter((c) => c.type === "plotEssentials" && c.active)
    .flatMap((component) => [
      {
        id: `plotEssentialsPressure:${component.id}`,
        label: `Active Pressure: ${component.title}`,
        condition: `when the active threat, obligation, or force bearing on the player character has meaningfully changed — a new danger has emerged, stakes have shifted, or a pressure has been resolved or replaced by another. Do NOT fire for minor scene details.`,
        sourceType: "component" as const,
        actionFactory: () => [{ type: "updateComponentPressure" as const, componentId: component.id }],
      },
      {
        id: `plotEssentialsMomentum:${component.id}`,
        label: `Immediate Momentum: ${component.title}`,
        condition: `when the immediate direction of the scene has changed — the concrete next action, confrontation, or decision immediately in front of the player character has shifted. Fires more freely than pressure updates.`,
        sourceType: "component" as const,
        actionFactory: () => [{ type: "updateComponentMomentum" as const, componentId: component.id }],
      },
    ]);
}

function storyCardUpdateConditions(adventure: Adventure): SemanticCondition[] {
  const excerpt = recentExcerpt(adventure);
  return adventure.storyCards
    .filter((card) => card.active && card.autoUpdate)
    .filter((card) => !isStoryCardOnAutoUpdateCooldown(adventure, card))
    .filter((card) => {
      // Pre-filter: skip if none of the card's trigger keywords appear in recent text.
      return card.keys.length === 0 || matchPatterns(excerpt, card.keys, card.matchType ?? "phrase").matched;
    })
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
  accum?: { promptTokens: number; completionTokens: number },
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
    if (accum && response.usage) {
      accum.promptTokens += response.usage.promptTokens ?? 0;
      accum.completionTokens += response.usage.completionTokens ?? 0;
    }
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
    action.type === "updateComponentPressure" ||
    action.type === "updateComponentMomentum" ||
    action.type === "createAutoCard"
  );
}

async function sendTargetedUpdate(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  prompt: string,
  accum?: { promptTokens: number; completionTokens: number },
): Promise<string> {
  const response = await sendOpenAICompatibleChatCompletion({
    config: evaluationConfig(adventure, providerConfig),
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: recentExcerpt(adventure) || "No recent history is available." },
    ],
  });
  if (accum && response.usage) {
    accum.promptTokens += response.usage.promptTokens ?? 0;
    accum.completionTokens += response.usage.completionTokens ?? 0;
  }
  return stripThinkTags(response.content);
}

function sanitizeBrainPatch(value: unknown): BrainPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: BrainPatch = {};

  const stringFields: (keyof Omit<BrainPatch, "thoughts">)[] = [
    "currentState", "relationshipPressure", "emotionalInterpretation", "recentDevelopments", "notes",
  ];
  for (const field of stringFields) {
    const item = raw[field];
    if (typeof item === "string" && item.trim()) result[field] = item.trim();
  }

  const thoughtsRaw = raw["thoughts"];
  if (thoughtsRaw && typeof thoughtsRaw === "object" && !Array.isArray(thoughtsRaw)) {
    const thoughtsPatch: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(thoughtsRaw as Record<string, unknown>)) {
      if (v === null) { thoughtsPatch[k] = null; }
      else if (typeof v === "string" && v.trim()) { thoughtsPatch[k] = v.trim(); }
    }
    if (Object.keys(thoughtsPatch).length > 0) result.thoughts = thoughtsPatch;
  }

  return result;
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
    appendContent: fields.proposedType === "plotEssentialsUpdate",
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
  accum?: { promptTokens: number; completionTokens: number },
): Promise<{ actions: AdventureAction[]; generated?: GeneratedContentPreview; error?: string }> {
  const requireApproval = adventure.semanticEvaluationSettings.requireApprovalForAutoUpdates;
  try {
    if (triggerAction.type === "updateBrain" || triggerAction.type === "appendBrain") {
      const brain = adventure.brains.find((entry) => entry.id === triggerAction.brainId);
      if (!brain) return { actions: [], error: `Brain not found: ${triggerAction.brainId}` };
      if (adventure.activeState.memoryProposals.some((p) => p.status === "pending" && p.proposedType === "brainUpdate" && p.targetId === brain.id)) {
        return { actions: [] };
      }
      const raw = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || brain.updatePrompt || defaultBrainPrompt(brain, adventure.activeState.turn), accum);
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
      const updateMode = triggerAction.type === "appendBrain" ? "append" : brain.updateMode;
      // Simulate post-update state to check condense threshold
      const postThoughtsRecord: Record<string, string> = updateMode === "append"
        ? Object.fromEntries([...Object.entries(brain.thoughts), ...Object.entries(patch.thoughts ?? {}).filter(([, v]) => v !== null)] as [string, string][])
        : Object.fromEntries(Object.entries(patch.thoughts ?? brain.thoughts).filter(([, v]) => v !== null) as [string, string][]);
      const postRecent = updateMode === "append"
        ? [brain.recentDevelopments, patch.recentDevelopments].filter(Boolean).join("\n")
        : (patch.recentDevelopments ?? brain.recentDevelopments ?? "");
      const postThoughtsText = Object.values(postThoughtsRecord).join("\n");
      const condenseNeeded = (postThoughtsText.length + postRecent.length) > (brain.condenseThreshold ?? BRAIN_CONDENSE_THRESHOLD);
      if (condenseNeeded) {
        const condensedRaw = await sendTargetedUpdate(adventure, providerConfig, condenseBrainPrompt(brain, postThoughtsRecord, postRecent), accum);
        const condensed = sanitizeBrainPatch(parseJsonResponse<unknown>(condensedRaw));
        if (Object.keys(condensed).length > 0) {
          const notesEntry = condensed.notes;
          const finalPatch: BrainPatch = {
            ...condensed,
            notes: [brain.notes, notesEntry].filter(Boolean).join("\n") || undefined,
          };
          const condenseUpdate = applyAIMemoryUpdate(adventure, [{
            type: "brainPatch", brainId: brain.id, patch: finalPatch, mode: "replace",
            turn: adventure.activeState.turn, preview: `[condensed] ${preview(condensedRaw)}`,
          }]);
          return {
            actions: condenseUpdate.actions,
            generated: { targetType: "brain", targetId: brain.id, title: brain.characterName, preview: `[condensed] ${preview(condensedRaw)}` },
            error: condenseUpdate.rejectedUpdates[0]?.reason,
          };
        }
      }
      const memoryUpdate = applyAIMemoryUpdate(adventure, [
        {
          type: "brainPatch",
          brainId: brain.id,
          patch,
          mode: updateMode,
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
      const content = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || storyCardPrompt(card), accum);
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
      const content = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || componentPrompt(component), accum);
      const proposal = makeProposal(
        { proposedType: "plotEssentialsUpdate", title: component.title, content, targetId: component.id, rationale: `Auto-update for "${component.title}".` },
        adventure,
      );
      return {
        actions: [{ type: "ADD_MEMORY_PROPOSAL", proposal }],
        generated: { targetType: "component", targetId: component.id, title: component.title, preview: preview(content) },
      };
    }

    if (triggerAction.type === "updateComponentPressure") {
      const pressureComp = adventure.components.find((c) => c.type === "activePressure");
      const content = await sendTargetedUpdate(adventure, providerConfig, plotPressurePrompt(adventure), accum);
      const proposal = makeProposal(
        { proposedType: "plotPressureUpdate", title: "Active Pressure", content, targetId: pressureComp?.id, rationale: "Active Pressure update." },
        adventure,
      );
      return {
        actions: [{ type: "ADD_MEMORY_PROPOSAL", proposal }],
        generated: { targetType: "component", targetId: pressureComp?.id, title: "Active Pressure", preview: preview(content) },
      };
    }

    if (triggerAction.type === "updateComponentMomentum") {
      const momentumComp = adventure.components.find((c) => c.type === "immediateMomentum");
      const content = await sendTargetedUpdate(adventure, providerConfig, plotMomentumPrompt(adventure), accum);
      const proposal = makeProposal(
        { proposedType: "plotMomentumUpdate", title: "Immediate Momentum", content, targetId: momentumComp?.id, rationale: "Immediate Momentum update." },
        adventure,
      );
      return {
        actions: [{ type: "ADD_MEMORY_PROPOSAL", proposal }],
        generated: { targetType: "component", targetId: momentumComp?.id, title: "Immediate Momentum", preview: preview(content) },
      };
    }

    if (triggerAction.type === "createAutoCard") {
      const raw = await sendTargetedUpdate(adventure, providerConfig, rule?.updatePrompt || autoCardPrompt(adventure), accum);
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
  const accum = { promptTokens: 0, completionTokens: 0 };
  const conditions = buildConditions(adventure);
  const { firedIds, errors } = await evaluateConditionIds(adventure, providerConfig, conditions, accum);
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
        generationTasks.push(() => generatedActionsFor(adventure, providerConfig, triggerAction, condition.id, sourceRule, accum));
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

  return { actions: [...actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry, tokenUsage: accum };
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

export async function runManualPlotEssentialsUpdate(
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<SemanticRunResult> {
  const components = adventure.components.filter((c) => c.type === "plotEssentials" && c.active);
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

  if (components.length === 0) {
    const logEntry = { ...emptyLog, errors: ["No active Plot Essentials components found."] };
    return { actions: [{ type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
  }

  // Always route to Memory Inbox regardless of requireApprovalForAutoUpdates setting
  const forcePropose = {
    ...adventure,
    semanticEvaluationSettings: { ...adventure.semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
  };

  const tasks = components.map((component) => () =>
    generatedActionsFor(forcePropose, providerConfig, { type: "updateComponent", componentId: component.id }, `manualPlot:${component.id}`),
  );
  const results = await runLimited(adventure.semanticEvaluationSettings.maxParallelUpdateCalls, tasks);

  const actions: AdventureAction[] = [];
  const generatedContent: GeneratedContentPreview[] = [];
  const errors: string[] = [];
  const actionsExecuted: string[] = [];

  for (const result of results) {
    actions.push(...result.actions);
    if (result.generated) { generatedContent.push(result.generated); actionsExecuted.push(`Manual plot update: ${result.generated.title}`); }
    if (result.error) errors.push(result.error);
  }

  const logEntry: EvaluationLogEntry = { ...emptyLog, conditionsFired: components.map((c) => `manualPlot:${c.id}`), actionsExecuted, generatedContent, errors };
  return { actions: [...actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
}

export async function runManualStoryCardsUpdate(
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<SemanticRunResult> {
  const cards = adventure.storyCards.filter((c) => c.active);
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

  if (cards.length === 0) {
    const logEntry = { ...emptyLog, errors: ["No active Story Cards found."] };
    return { actions: [{ type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
  }

  const forcePropose = {
    ...adventure,
    semanticEvaluationSettings: { ...adventure.semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
  };

  const tasks = cards.map((card) => () =>
    generatedActionsFor(forcePropose, providerConfig, { type: "updateStoryCard", storyCardId: card.id }, `manualCard:${card.id}`),
  );
  const results = await runLimited(adventure.semanticEvaluationSettings.maxParallelUpdateCalls, tasks);

  const actions: AdventureAction[] = [];
  const generatedContent: GeneratedContentPreview[] = [];
  const errors: string[] = [];
  const actionsExecuted: string[] = [];

  for (const result of results) {
    actions.push(...result.actions);
    if (result.generated) { generatedContent.push(result.generated); actionsExecuted.push(`Manual card update: ${result.generated.title}`); }
    if (result.error) errors.push(result.error);
  }

  const logEntry: EvaluationLogEntry = { ...emptyLog, conditionsFired: cards.map((c) => `manualCard:${c.id}`), actionsExecuted, generatedContent, errors };
  return { actions: [...actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
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
    { "action": "update", "cardId": "existing-card-id", "title": "Card Title", "content": "• Bullet fact one.\n• Bullet fact two.", "keys": ["keyword1"] },
    { "action": "create", "title": "New Card Title", "content": "• Bullet fact one.\n• Bullet fact two.", "keys": ["keyword1", "keyword2"] }
  ],
  "rationale": "Brief explanation of choices"
}

The "content" field must use • bullet points, one per line. Each bullet should be a concise, self-contained fact, trait, or story rule about the subject.`;

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
