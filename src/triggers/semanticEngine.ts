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
  StoryCard,
  TriggerAction,
  TriggerRule,
} from "../types/adventure";
import { isNativeDeepSeekProvider, sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { applyAIMemoryUpdate } from "../memory/applyAIMemoryUpdate";
import { createId, nowIso } from "../utils/id";
import { matchPatterns, splitList } from "./matching";
import { isTriggerOnCooldown, triggerActionToAdventureActions } from "./triggerEngine";

const EVALUATION_SYSTEM_PROMPT =
  'You are an evaluation engine. Given a story excerpt, evaluate which conditions are currently true. Respond ONLY with a valid JSON array of condition IDs that are true. No explanation, no prose, no markdown. Example: ["id1", "id3"]';

const MEMORY_EVALUATION_SYSTEM_PROMPT =
  'You are an evaluation engine. Given a story excerpt and a list of conditions, return the ID of the SINGLE most story-relevant condition that is currently true — the one that best reflects what just happened. Respond with a JSON array containing at most one ID. Return [] if none clearly apply. No explanation, no prose, no markdown. Example: ["id1"]';

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
  const thoughtEntries = Object.entries(brain.thoughts);
  const existingBlock = thoughtEntries.length > 0
    ? `\n\nExisting thoughts (do NOT repeat these):\n${thoughtEntries.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`
    : "";
  return `You are recording one new thought, reaction, or private plan for ${brain.characterName} based on what just happened. Current turn: ${turn}.${existingBlock}

Return ONLY valid JSON. Only include keys that changed.

For "thoughts": add ONE new entry. Key is snake_case label. Value is "${turn} → first-person observation, reaction, or plan". Write in ${brain.characterName}'s own voice — cite specific people, what was said or done, and what it privately means or what they intend to do about it. Never use generic labels ("excited", "uneasy", "focused"). Optionally set one stale entry to null to archive it.

Do NOT record: current location, who is present in this scene, or stable personality traits. Location and scene presence belong in Scene State. Permanent behavioral patterns belong in a Story Card, not here.

Example: { "thoughts": { "azula_praise_after_council": "${turn} → Her 'good to have you back' landed too clean. Azula doesn't give compliments — she extends leashes. I need to find out how much she knows before the delegation arrives." } }

If this thought reveals something fundamental and permanent about how ${brain.characterName} behaves, thinks, or operates — something that would be true in any scene, not just this one — also include:
"storyCardNote": "one concise sentence describing the trait or behavioral pattern"

Only include storyCardNote if it genuinely describes a stable character truth (not a scene reaction). Leave it out otherwise.`;
}

const BRAIN_CONDENSE_THRESHOLD = 1600;

function condenseBrainPrompt(brain: BrainEntry, fullThoughts: Record<string, string>): string {
  const thoughtsFormatted = Object.entries(fullThoughts).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  return `You are pruning ${brain.characterName}'s thought log because it has grown too long. Keep the 3-5 most important and still-relevant entries. Set the rest to null — they will be archived, not deleted.

Current thought entries:
${thoughtsFormatted}

Return ONLY valid JSON:
{ "thoughts": { "key_to_keep": "${brain.lastUpdatedTurn ?? 0} → text unchanged", "key_to_archive": null } }

Keep all values verbatim and unchanged. Do not rewrite or summarize any entry.`;
}

function storyCardPrompt(card: StoryCard): string {
  return `You are updating a persistent world fact card titled '${card.title}'.

Current content:
${card.content}

Based on what just happened, rewrite or extend this card. Format the content as concise bullet points, one per line, using the • character. Each bullet should be a single self-contained fact, trait, or rule. Preserve all existing facts that are still true; update or remove only what has changed.

If this is a character card with a VOICE CONTRACT section, keep that section after the bullets — preserve it verbatim unless the character's voice has genuinely shifted, in which case refine it in place (keep the Rhythm / Default move / Emotional defense / Never sounds like / Example lines shape).

Do NOT include: current location, who is currently present in a scene, active mission status, or any "currently X" state. These are temporary and belong in Scene State, not a Story Card. Only record facts that are durably true regardless of which scene is happening.

Example format:
• Permanent trait, history, or rule about the entity.
• Relationship or constraint that holds across all scenes.
• Canon fact the story must always respect.

Return ONLY the bullet-pointed content — no title, no headers, no commentary.`;
}

function componentPrompt(component: ComponentEntry): string {
  if (component.type === "plotEssentials") {
    const current = component.content?.trim();
    return `You are contributing to a Plot Essentials arc document for an interactive fiction story.

Current arc:
${current || "(empty)"}

Based on the most recent story events, write ONLY new permanent developments to append — completed arc beats, sealed consequences, major relationship shifts, or revealed plot truths. Do NOT repeat anything already captured above. If nothing new and permanent happened, respond with an empty string.

Do NOT include: character emotional states, reactions, or desires. Do not describe the current scene or who is present. Do not record temporary mission status or active assignments. Only sealed consequences and permanent world constraints belong here.

Write as tight bullet points (• one per line). Return ONLY the new additions.`;
  }
  return `You are updating a context component titled "${component.title}". Current content: "${component.content}". Based on what just happened, update this component. Return ONLY the new content as a plain string.`;
}

function plotPressurePrompt(adventure: Adventure): string {
  const current = adventure.components.find((c) => c.type === "activePressure")?.content ?? "(none)";
  return `You are updating the Active Pressure for this story.

Active Pressure is the current threat, obligation, or force bearing on the player character — what is pushing or threatening them right now at the story level. It replaces the previous value entirely when it changes.

Current Active Pressure:
${current}

Do not describe how characters feel, think, or what they want. Describe only the external story pressure — the threat, obligation, or force acting on the situation.

Write 1–3 sentences describing the current active pressure. Return ONLY the new content as plain text.`;
}

function arcUpdatePrompt(component: ComponentEntry): string {
  const premise = component.arcPremise?.trim();
  const existing = component.content?.trim();
  const premiseNote = premise ? `\nArc Premise: "${premise}"\n` : "";
  const existingNote = existing ? `\nExisting arc log (do NOT repeat entries already here):\n${existing}\n` : "";
  return `You are appending to a running log of an active story arc.${premiseNote}${existingNote}
Your job: write 1–3 sentences capturing the specific development that just occurred and how it advances or complicates this arc. Be concrete — name what happened, not how characters felt about it.

Do NOT restate anything already in the existing log. Do NOT summarize the whole story. Append only what is new and arc-relevant.

Return ONLY the new sentences as plain text.`;
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

Do not describe character emotional states or desires. Describe only the concrete next action or decision the story is driving toward.

Write 1–2 sentences stating what concrete action or decision is immediately ahead. Return ONLY the new content as plain text.`;
}


function isStoryCardOnAutoUpdateCooldown(adventure: Adventure, card: StoryCard): boolean {
  const last = card.lastAutoUpdateTurn;
  if (last === undefined) return false;
  return adventure.activeState.turn - last < (card.autoUpdateCooldownTurns ?? 3);
}

function isStoryCardSystemOnCooldown(adventure: Adventure): boolean {
  const cooldown = adventure.semanticEvaluationSettings.storyCardCooldownTurns;
  if (!cooldown) return false;
  const lastUpdate = Math.max(-1, ...adventure.storyCards.map((c) => c.lastAutoUpdateTurn ?? -1));
  if (lastUpdate < 0) return false;
  return adventure.activeState.turn - lastUpdate < cooldown;
}

function isBrainOnCooldown(adventure: Adventure, brain: BrainEntry): boolean {
  if (!brain.autoUpdateCooldownTurns) return false;
  if (brain.lastUpdatedTurn === undefined) return false;
  return adventure.activeState.turn - brain.lastUpdatedTurn < brain.autoUpdateCooldownTurns;
}

function isPEComponentOnCooldown(adventure: Adventure, component: ComponentEntry): boolean {
  const last = component.lastAutoUpdateTurn;
  if (last === undefined) return false;
  return adventure.activeState.turn - last < (component.autoUpdateCooldownTurns ?? 3);
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
  const eligible = adventure.brains
    .filter((brain) => brain.active)
    .filter((brain) => !isBrainOnCooldown(adventure, brain))
    .filter((brain) => {
      const patterns = [brain.characterName, ...brain.triggers].filter(Boolean);
      return patterns.length === 0 || matchPatterns(excerpt, patterns, "phrase").matched;
    });
  return eligible.map((brain) => ({
    id: `brain:${brain.id}`,
    label: `Brain: ${brain.characterName}`,
    condition: brain.updateCondition || `when something in this scene causes a genuine shift for ${brain.characterName}: a new realization, emotional pivot, changed read on another character, or meaningful reaction to events — do NOT fire just because they appear or speak`,
    sourceType: "brain" as const,
    actionFactory: () => [{ type: brain.updateMode === "append" ? "appendBrain" : "updateBrain", brainId: brain.id }],
  }));
}

function plotEssentialsConditions(adventure: Adventure): SemanticCondition[] {
  const arc = adventure.components
    .filter((c) => c.type === "plotEssentials" && c.active && c.autoUpdate === true && !isPEComponentOnCooldown(adventure, c))
    .map((component) => ({
      id: `plotEssentialsArc:${component.id}`,
      label: `Plot Arc: ${component.title}`,
      condition: `when a significant, permanent story development has occurred — a major arc beat completed, key relationship sealed, permanent consequence established, or plot truth revealed. Do NOT fire for minor scene events or details already established.`,
      sourceType: "component" as const,
      actionFactory: () => [{ type: "updateComponent" as const, componentId: component.id }],
    }));
  const currentArc = adventure.components
    .filter((c) => c.type === "currentArc" && c.active && !isPEComponentOnCooldown(adventure, c) && Boolean(c.arcPremise?.trim()))
    .map((component) => {
      const premise = component.arcPremise!.trim();
      return {
        id: `currentArc:${component.id}`,
        label: `Current Arc: ${component.title}`,
        condition: `when an event in the recent story meaningfully advances or complicates the arc described as: "${premise}". Do NOT fire for routine scene beats, minor dialogue, or character moments that don't shift the arc's trajectory.`,
        sourceType: "component" as const,
        actionFactory: () => [{ type: "updateComponentArc" as const, componentId: component.id }],
      };
    });
  const pressure = adventure.components
    .filter((c) => c.type === "activePressure" && c.active && !isPEComponentOnCooldown(adventure, c))
    .map((component) => ({
      id: `plotEssentialsPressure:${component.id}`,
      label: `Active Pressure: ${component.title}`,
      condition: `when the active threat, obligation, or force bearing on the player character has meaningfully changed — a new danger has emerged, stakes have shifted, or a pressure has been resolved or replaced by another. Do NOT fire for minor scene details.`,
      sourceType: "component" as const,
      actionFactory: () => [{ type: "updateComponentPressure" as const, componentId: component.id }],
    }));
  const momentum = adventure.components
    .filter((c) => c.type === "immediateMomentum" && c.active && !isPEComponentOnCooldown(adventure, c))
    .map((component) => ({
      id: `plotEssentialsMomentum:${component.id}`,
      label: `Immediate Momentum: ${component.title}`,
      condition: `when the immediate direction of the scene has changed — the concrete next action, confrontation, or decision immediately in front of the player character has shifted. Fires more freely than pressure updates.`,
      sourceType: "component" as const,
      actionFactory: () => [{ type: "updateComponentMomentum" as const, componentId: component.id }],
    }));
  return [...arc, ...currentArc, ...pressure, ...momentum];
}

function storyCardUpdateConditions(adventure: Adventure): SemanticCondition[] {
  if (isStoryCardSystemOnCooldown(adventure)) return [];
  const excerpt = recentExcerpt(adventure);
  const eligible = adventure.storyCards
    .filter((card) => card.active && card.autoUpdate)
    .filter((card) => !isStoryCardOnAutoUpdateCooldown(adventure, card))
    .filter((card) => card.keys.length === 0 || matchPatterns(excerpt, card.keys, card.matchType ?? "phrase").matched);
  const target = eligible[0];
  if (!target) return [];
  return [{
    id: `storyCard:${target.id}`,
    label: `Story Card: ${target.title}`,
    condition: `when the story has established new details, developments, or changes that should update the fact card titled "${target.title}" — only fire when something meaningfully new has been revealed about this entity`,
    sourceType: "storyCard" as const,
    actionFactory: () => [{ type: "updateStoryCard" as const, storyCardId: target.id }],
  }];
}

function buildMemoryConditions(adventure: Adventure): SemanticCondition[] {
  // brainConditions removed — character thoughts are now captured inline during story generation
  return [
    ...storyCardUpdateConditions(adventure),
    ...plotEssentialsConditions(adventure),
  ];
}

function buildConditions(adventure: Adventure): SemanticCondition[] {
  if (!adventure.semanticEvaluationSettings.enabled) return [];
  return [
    ...activeSemanticRules(adventure),
    // Auto-card detection is now deterministic (regex) — handled separately in runSemanticPostTurnEvaluation
  ];
}

async function evaluateConditionIds(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  conditions: SemanticCondition[],
  accum?: { promptTokens: number; completionTokens: number },
  options?: { singlePick?: boolean },
): Promise<{ firedIds: string[]; errors: string[] }> {
  if (conditions.length === 0) return { firedIds: [], errors: [] };
  const systemPrompt = options?.singlePick ? MEMORY_EVALUATION_SYSTEM_PROMPT : EVALUATION_SYSTEM_PROMPT;
  try {
    const response = await sendOpenAICompatibleChatCompletion({
      config: evaluationConfig(adventure, providerConfig),
      messages: [
        { role: "system", content: systemPrompt },
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
  if (triggerAction.type === "updateBrain" || triggerAction.type === "appendBrain") return [];
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
    action.type === "updateSummary"
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
    appendContent: fields.proposedType === "plotEssentialsUpdate" || fields.proposedType === "summaryUpdate" || fields.proposedType === "currentArcUpdate",
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
      const rawParsed = parseJsonResponse<unknown>(raw);
      const storyCardNote = rawParsed && typeof rawParsed === "object" && "storyCardNote" in rawParsed && typeof (rawParsed as Record<string, unknown>).storyCardNote === "string"
        ? (rawParsed as Record<string, unknown>).storyCardNote as string
        : undefined;
      const patch = sanitizeBrainPatch(rawParsed);
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
      const postThoughtsText = Object.values(postThoughtsRecord).join("\n");
      const condenseNeeded = postThoughtsText.length > (brain.condenseThreshold ?? BRAIN_CONDENSE_THRESHOLD);
      if (condenseNeeded) {
        const condensedRaw = await sendTargetedUpdate(adventure, providerConfig, condenseBrainPrompt(brain, postThoughtsRecord), accum);
        const condensed = sanitizeBrainPatch(parseJsonResponse<unknown>(condensedRaw));
        if (Object.keys(condensed).length > 0) {
          const condenseUpdate = applyAIMemoryUpdate(adventure, [{
            type: "brainPatch", brainId: brain.id, patch: condensed, mode: "replace",
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
      const extraActions: AdventureAction[] = [];
      if (storyCardNote && brain.linkedStoryCardId) {
        const card = adventure.storyCards.find((c) => c.id === brain.linkedStoryCardId);
        if (card) {
          const scProposal = makeProposal(
            {
              proposedType: "storyCard",
              title: card.title,
              content: storyCardNote,
              suggestedTriggers: card.keys,
              targetId: card.id,
              rationale: `Brain thought for ${brain.characterName} revealed a stable character trait.`,
            },
            adventure,
          );
          extraActions.push({ type: "ADD_MEMORY_PROPOSAL", proposal: { ...scProposal, appendContent: true } });
        }
      }
      return {
        actions: [...memoryUpdate.actions, ...extraActions],
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
        actions: [{ type: "ADD_MEMORY_PROPOSAL", proposal }, { type: "MARK_COMPONENT_UPDATED", componentId: component.id, turn: adventure.activeState.turn }],
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
      const actions: AdventureAction[] = [{ type: "ADD_MEMORY_PROPOSAL", proposal }];
      if (pressureComp) actions.push({ type: "MARK_COMPONENT_UPDATED", componentId: pressureComp.id, turn: adventure.activeState.turn });
      return {
        actions,
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
      const actions: AdventureAction[] = [{ type: "ADD_MEMORY_PROPOSAL", proposal }];
      if (momentumComp) actions.push({ type: "MARK_COMPONENT_UPDATED", componentId: momentumComp.id, turn: adventure.activeState.turn });
      return {
        actions,
        generated: { targetType: "component", targetId: momentumComp?.id, title: "Immediate Momentum", preview: preview(content) },
      };
    }

    if (triggerAction.type === "updateComponentArc") {
      const arcComp = adventure.components.find((c) => c.id === triggerAction.componentId && c.type === "currentArc");
      if (!arcComp) return { actions: [], error: `Current Arc component not found: ${triggerAction.componentId}` };
      const content = await sendTargetedUpdate(adventure, providerConfig, arcUpdatePrompt(arcComp), accum);
      if (!content.trim()) return { actions: [] };
      const proposal = makeProposal(
        { proposedType: "currentArcUpdate", title: arcComp.title, content, targetId: arcComp.id, rationale: "Arc event logged." },
        adventure,
      );
      const actions: AdventureAction[] = [{ type: "ADD_MEMORY_PROPOSAL", proposal }];
      actions.push({ type: "MARK_COMPONENT_UPDATED", componentId: arcComp.id, turn: adventure.activeState.turn });
      return {
        actions,
        generated: { targetType: "component", targetId: arcComp.id, title: arcComp.title, preview: preview(content) },
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
  const firedCounts: Partial<Record<string, number>> = {};
  const fired = conditions.filter((condition) => {
    if (!firedIds.includes(condition.id)) return false;
    if (condition.sourceType === "brain" || condition.sourceType === "storyCard") {
      const count = firedCounts[condition.sourceType] ?? 0;
      if (count >= 1) return false;
      firedCounts[condition.sourceType] = count + 1;
    }
    return true;
  });
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

  const systemPrompt = `You are a world memory assistant for an interactive fiction game. The player described something they want represented as durable story memory.

Examine the description against existing story cards and characters:
- If the fact is a property or development of existing entities, propose updating those cards (action "update" with the cardId)
- If the fact is a distinct event, concept, or relationship with its own identity, propose a new card (action "create")
- You may propose both updates AND a new card for the same fact
- Prefer one focused proposal. Return multiple proposals only when the description clearly contains separate durable subjects.
- Do not propose temporary scene state, one-off scenery, generic movement, or short-lived emotional reactions.

Respond ONLY with valid JSON:
{
  "proposals": [
    { "action": "update", "cardId": "existing-card-id", "title": "Card Title", "content": "• Bullet fact one.\n• Bullet fact two.", "keys": ["keyword1"] },
    { "action": "create", "title": "New Card Title", "content": "• Bullet fact one.\n• Bullet fact two.", "keys": ["keyword1", "keyword2"] }
  ],
  "rationale": "Brief explanation of choices"
}

The "content" field must use • bullet points, one per line. Each bullet should be a concise, self-contained fact, trait, or story rule about the subject.
For a CHARACTER card, after the bullets append a VOICE CONTRACT so the model can voice them consistently. Use exactly this shape:
VOICE CONTRACT
Rhythm: <how they speak — pace, sentence structure>
Default move: <what they reach for under pressure>
Emotional defense: <how they deflect or armor up>
Never sounds like: <what to avoid — generic, "I feel…" statements, offering choices>
Example lines: "<line>" / "<line>" / "<line>"
Write the example lines in the character's actual voice. Omit the VOICE CONTRACT only if there is no usable sense of how they speak.`;

  const userPrompt = `Description to turn into durable Story Card memory:\n${fact.trim()}\n\nExisting Story Cards:\n${cardList || "(none)"}\n\nExisting Characters:\n${brainList || "(none)"}`;

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
    const resolvedConfig = evaluationConfig(adventure, config);
    const response = await sendOpenAICompatibleChatCompletion({
      config: resolvedConfig,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      ...(isNativeDeepSeekProvider(resolvedConfig)
        ? { responseFormat: "json_object" as const, thinking: "disabled" as const }
        : {}),
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

export async function runManualPEComponentUpdate(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  componentId: string,
): Promise<SemanticRunResult> {
  const component = adventure.components.find((c) => c.id === componentId);
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

  if (!component || (component.type !== "plotEssentials" && component.type !== "activePressure" && component.type !== "immediateMomentum")) {
    const errorLog = { ...emptyLog, errors: [`Component not found or wrong type: ${componentId}`] };
    return { actions: [{ type: "LOG_EVALUATION_RESULT", entry: errorLog }], logEntry: errorLog };
  }

  const triggerAction = component.type === "activePressure"
    ? { type: "updateComponentPressure" as const, componentId }
    : component.type === "immediateMomentum"
    ? { type: "updateComponentMomentum" as const, componentId }
    : { type: "updateComponent" as const, componentId };

  const forcePropose = {
    ...adventure,
    semanticEvaluationSettings: { ...adventure.semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
  };

  const result = await generatedActionsFor(
    forcePropose,
    providerConfig,
    triggerAction,
    `manual${component.type === "activePressure" ? "Pressure" : component.type === "immediateMomentum" ? "Momentum" : "Arc"}:${componentId}`,
  );

  const logEntry: EvaluationLogEntry = {
    ...emptyLog,
    conditionsFired: [`manual:${componentId}`],
    actionsExecuted: result.generated ? [`Manual ${component.title} update`] : [],
    generatedContent: result.generated ? [result.generated] : [],
    errors: result.error ? [result.error] : [],
  };

  return { actions: [...result.actions, { type: "LOG_EVALUATION_RESULT", entry: logEntry }], logEntry };
}

export async function runMemoryCycle(
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<SemanticRunResult> {
  const accum = { promptTokens: 0, completionTokens: 0 };
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

  const forcePropose = {
    ...adventure,
    semanticEvaluationSettings: { ...adventure.semanticEvaluationSettings, requireApprovalForAutoUpdates: true },
  };

  const conditions = buildMemoryConditions(adventure);
  if (conditions.length === 0) {
    return { actions: [{ type: "LOG_EVALUATION_RESULT", entry: emptyLog }], logEntry: emptyLog };
  }

  const { firedIds, errors } = await evaluateConditionIds(forcePropose, providerConfig, conditions, accum, { singlePick: true });

  const firedCondition = conditions.find((c) => c.id === firedIds[0]);
  if (!firedCondition) {
    const logEntry: EvaluationLogEntry = { ...emptyLog, conditionsEvaluated: conditions.map(({ id, label, condition, sourceType }) => ({ id, label, condition, sourceType })), errors };
    return {
      actions: [
        { type: "SET_LAST_MEMORY_CYCLE_TURN", turn: adventure.activeState.turn },
        { type: "LOG_EVALUATION_RESULT", entry: logEntry },
      ],
      logEntry,
      tokenUsage: accum,
    };
  }

  const triggerActions = firedCondition.actionFactory(adventure);
  const results = await runLimited(1, triggerActions.map((ta) => () => generatedActionsFor(forcePropose, providerConfig, ta, firedCondition.id, undefined, accum)));

  const generatedContent: GeneratedContentPreview[] = [];
  const allActions: AdventureAction[] = [];
  const resultErrors: string[] = [...errors];

  for (const result of results) {
    allActions.push(...result.actions);
    if (result.generated) generatedContent.push(result.generated);
    if (result.error) resultErrors.push(result.error);
  }

  const logEntry: EvaluationLogEntry = {
    ...emptyLog,
    conditionsEvaluated: conditions.map(({ id, label, condition, sourceType }) => ({ id, label, condition, sourceType })),
    conditionsFired: [firedCondition.id],
    actionsExecuted: [`Memory cycle: ${firedCondition.label}`],
    generatedContent,
    errors: resultErrors,
  };

  return {
    actions: [
      ...allActions,
      { type: "SET_LAST_MEMORY_CYCLE_TURN", turn: adventure.activeState.turn },
      { type: "ACCUMULATE_BACKGROUND_TOKENS", promptTokens: accum.promptTokens, completionTokens: accum.completionTokens },
      { type: "LOG_EVALUATION_RESULT", entry: logEntry },
    ],
    logEntry,
    tokenUsage: accum,
  };
}
