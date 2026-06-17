import type { AdventureAction, Adventure, MemoryProposal, ProviderConfig, StoryCard } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { classifyMemory } from "./classificationPolicy";
import { createId, nowIso } from "../utils/id";

const STOP_WORDS_LOWER = new Set([
  "the", "a", "an", "he", "she", "they", "it", "we", "you", "your",
  "his", "her", "their", "this", "that", "these", "those", "my", "our", "its", "i",
]);

function resolvedProviderConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (bg?.baseUrl) {
    return { ...providerConfig, baseUrl: bg.baseUrl, apiKey: bg.apiKey ?? providerConfig.apiKey, model: bg.model || providerConfig.model };
  }
  return { ...providerConfig, model: adventure.semanticEvaluationSettings.evaluationModel || providerConfig.model };
}

function hasNovelSignal(adventure: Adventure, text: string): boolean {
  const classification = classifyMemory(text, {
    existingBrainNames: adventure.brains.map((b) => b.characterName),
    existingStoryCards: adventure.storyCards.map((c) => ({ id: c.id, title: c.title, keys: c.keys })),
  });
  if (classification.proposedType !== "ignore") return true;

  const existingKeys = new Set([
    ...adventure.storyCards.map((c) => c.title.toLowerCase()),
    ...adventure.storyCards.flatMap((c) => c.keys.map((k) => k.toLowerCase())),
    ...adventure.brains.map((b) => b.characterName.toLowerCase()),
    ...adventure.activeState.memoryProposals
      .filter((p) => p.status === "rejected")
      .map((p) => p.title.toLowerCase()),
  ]);

  const properNouns = [...text.matchAll(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)]
    .map((m) => m[0].toLowerCase())
    .filter((word) => !STOP_WORDS_LOWER.has(word));

  return properNouns.some((word) => !existingKeys.has(word));
}

function buildSystemPrompt(adventure: Adventure, generateContent: boolean): string {
  const cardList = adventure.storyCards
    .filter((c) => c.active)
    .map((c) => `"${c.title}" [keys: ${c.keys.slice(0, 4).join(", ")}]: ${c.content.slice(0, 120)}`)
    .join("\n");

  const brainList = adventure.brains
    .filter((b) => b.active)
    .map((b) => `${b.characterName}: ${b.currentState.slice(0, 80)}`)
    .join("\n");

  const storyCardContentField = generateContent
    ? `"content": "bullet points using • character, one per line, no title in the body; if the entity is a character, append a VOICE CONTRACT block after the bullets (see rules)",`
    : "";

  return `You are a world-memory assistant for an interactive fiction game. Detect if the story response establishes a NEW durable fact worth storing permanently.

Existing story cards (already in memory):
${cardList || "(none)"}

Existing tracked characters (these already have their own entries — facts about them, including how they relate to each other, are tracked there, NOT in new cards):
${brainList || "(none)"}

If there is a new durable fact, respond with ONLY this JSON (no markdown, no prose):
- New entity card: {"proposedType": "storyCard", "title": "...", ${storyCardContentField}"suggestedTriggers": ["keyword1"], "rationale": "one line"}
- Update to an EXISTING card: {"proposedType": "storyCard", "updateExisting": "<exact existing card title>", "content": "• the single NEW development, phrased as current (now / has now / no longer)", "suggestedTriggers": ["keyword"], "rationale": "one line"}
- Plot update: {"proposedType": "plotEssentialsUpdate", "title": "...", "content": "1–2 bullet points capturing only the NEW constraint or development to append", "suggestedTriggers": [], "rationale": "one line"}

If nothing is new: respond with the word null

Rules:
- PREFER updating over creating. If the development concerns a subject that an existing card above ALREADY covers — including a relationship, bond, or dynamic between tracked characters that already has its own card — set "updateExisting" to that card's exact title and write ONLY the new development. NEVER create a second card for a subject that already has one.
- storyCard (new): ONLY a genuinely NEW named entity with no existing card — a specific person, place, faction, organization, or named object/rule just introduced. Its title is that entity's own proper name.
- A relationship/bond/dynamic between tracked characters may have at most ONE living card. If it already exists, UPDATE it. If it does not and the bond is clearly recurring and important, you may create it once with a clear title (e.g. "Setu and Nyxa").
- When updating, the content is just the NEW development as ONE bullet, written as the current state — do not restate old facts; the card keeps its own history.${generateContent ? `\n- VOICE CONTRACT: if a NEW card's entity is a character (a person the story will voice), the content MUST end with a VOICE CONTRACT block after the bullets, written in their actual voice:\\nVOICE CONTRACT\\nRhythm: <pace, sentence structure>\\nDefault move: <what they reach for under pressure>\\nEmotional defense: <how they deflect or armor up>\\nNever sounds like: <what to avoid — generic, "I feel…", offering choices>\\nExample lines: "<line>" / "<line>"` : ""}
- plotEssentialsUpdate: ONLY for immediate active constraints (tonight, currently, right now, actively) — write only the new addition as 1–2 bullets, not a full rewrite
- Do not propose what is already covered — only flag genuinely new information
- suggestedTriggers: 2–5 specific keywords, no stop words`;
}

export async function detectMemoryFromTurn(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  responseText: string,
  accum?: { promptTokens: number; completionTokens: number },
): Promise<Extract<AdventureAction, { type: "ADD_MEMORY_PROPOSAL" }> | undefined> {
  if (!hasNovelSignal(adventure, responseText)) return undefined;

  const { generateContent } = adventure.memoryDetectionSettings;
  const systemPrompt = buildSystemPrompt(adventure, generateContent);

  let raw: string;
  try {
    const response = await sendOpenAICompatibleChatCompletion({
      config: resolvedProviderConfig(adventure, providerConfig),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: responseText.slice(0, 1000) },
      ],
    });
    if (accum && response.usage) {
      accum.promptTokens += response.usage.promptTokens ?? 0;
      accum.completionTokens += response.usage.completionTokens ?? 0;
    }
    raw = response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  } catch {
    return undefined;
  }

  if (!raw || raw === "null" || !raw.startsWith("{")) return undefined;

  let parsed: { proposedType?: unknown; title?: unknown; updateExisting?: unknown; content?: unknown; suggestedTriggers?: unknown; rationale?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return undefined;
  }

  const validTypes = new Set(["storyCard", "plotEssentialsUpdate"]);
  if (typeof parsed.proposedType !== "string" || !validTypes.has(parsed.proposedType)) return undefined;

  // Living-card routing: if the model named an existing card to update, target it instead of creating
  // a sibling. Match by exact title (case-insensitive) against active cards — conservative on purpose.
  let targetCard: StoryCard | undefined;
  if (parsed.proposedType === "storyCard" && typeof parsed.updateExisting === "string" && parsed.updateExisting.trim()) {
    const wanted = parsed.updateExisting.trim().toLowerCase();
    targetCard = adventure.storyCards.find((c) => c.active && c.title.trim().toLowerCase() === wanted);
    if (!targetCard) return undefined; // named a card that doesn't exist — drop rather than spawn a sibling
  }

  const title = targetCard ? targetCard.title : typeof parsed.title === "string" ? parsed.title.trim() : "";
  if (!title) return undefined;
  if (parsed.proposedType === "plotEssentialsUpdate" && (typeof parsed.content !== "string" || !parsed.content.trim())) return undefined;
  if (targetCard && (typeof parsed.content !== "string" || !parsed.content.trim())) return undefined; // an update with no new fact is noise
  const isCardUpdate = Boolean(targetCard);

  // Don't stack duplicate work: block a second pending proposal of the same type AND target.
  if (
    adventure.activeState.memoryProposals.some(
      (p) =>
        p.status === "pending" &&
        p.proposedType === parsed.proposedType &&
        (p.targetId ?? "") === (targetCard?.id ?? "") &&
        (targetCard ? true : p.title.trim().toLowerCase() === title.toLowerCase()),
    )
  ) {
    return undefined;
  }

  const proposal: MemoryProposal = {
    id: createId("proposal"),
    sourceTurnId: String(adventure.activeState.turn),
    sourceText: responseText.slice(0, 500),
    proposedType: parsed.proposedType as MemoryProposal["proposedType"],
    title,
    content: (generateContent || isCardUpdate) && typeof parsed.content === "string" ? parsed.content : "",
    suggestedTriggers: Array.isArray(parsed.suggestedTriggers)
      ? (parsed.suggestedTriggers as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 6)
      : [],
    confidence: 0.8,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "AI-detected durable fact.",
    status: "pending",
    targetId: targetCard?.id,
    // appendContent drives the living-card merge (append + archive) on approval; plot updates also append.
    appendContent: isCardUpdate || parsed.proposedType === "plotEssentialsUpdate",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return { type: "ADD_MEMORY_PROPOSAL", proposal };
}

export async function regenerateProposalContent(
  proposal: MemoryProposal,
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<string> {
  const systemPrompt = `You are a world-memory assistant for an interactive fiction game.
The user has a memory suggestion they want better content for.
Write improved content for the suggestion titled "${proposal.title}" (type: ${proposal.proposedType}).
Source text from the story: ${proposal.sourceText}
${proposal.proposedType === "storyCard" ? 'Format: bullet points using the • character, one per line, no title in the body. If this card is a character (a person the story will voice), append a VOICE CONTRACT block after the bullets, written in their actual voice:\nVOICE CONTRACT\nRhythm: <pace, sentence structure>\nDefault move: <what they reach for under pressure>\nEmotional defense: <how they deflect or armor up>\nNever sounds like: <what to avoid — generic, "I feel…", offering choices>\nExample lines: "<line>" / "<line>"' : 'Format: 1–2 bullet points capturing only the NEW constraint or development to append. Do not rewrite the full block.'}
Respond with ONLY the content — no JSON, no preamble, no labels.`;

  const response = await sendOpenAICompatibleChatCompletion({
    config: resolvedProviderConfig(adventure, providerConfig),
    messages: [{ role: "user", content: systemPrompt }],
  });

  return response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
