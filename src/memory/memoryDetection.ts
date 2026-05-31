import type { AdventureAction, Adventure, MemoryProposal, ProviderConfig } from "../types/adventure";
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
    ...adventure.brains.flatMap((b) => b.aliases.map((a) => a.toLowerCase())),
    ...adventure.activeState.memoryProposals
      .filter((p) => p.status === "rejected" || p.status === "ignored")
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
    ? `"content": "bullet points using • character, one per line, no title in the body",`
    : "";

  return `You are a world-memory assistant for an interactive fiction game. Detect if the story response establishes a NEW durable fact worth storing permanently.

Existing story cards (already in memory):
${cardList || "(none)"}

Existing tracked characters (character brains are managed separately — do NOT propose brainUpdate):
${brainList || "(none)"}

If there is a new durable fact, respond with ONLY this JSON (no markdown, no prose):
- For a story card: {"proposedType": "storyCard", "title": "...", ${storyCardContentField}"suggestedTriggers": ["keyword1"], "rationale": "one line"}
- For a plot update: {"proposedType": "plotEssentialsUpdate", "title": "...", "content": "the full updated plot essentials text", "suggestedTriggers": [], "rationale": "one line"}

If nothing is new: respond with the word null

Rules:
- storyCard: named entities, relationships, secrets, rules, or recurring facts NOT already in existing cards
- plotEssentialsUpdate: ONLY for immediate active constraints (tonight, currently, right now, actively) — content must be the complete replacement text for the plot essentials block
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

  let parsed: { proposedType?: unknown; title?: unknown; content?: unknown; suggestedTriggers?: unknown; rationale?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return undefined;
  }

  const validTypes = new Set(["storyCard", "plotEssentialsUpdate"]);
  if (typeof parsed.proposedType !== "string" || !validTypes.has(parsed.proposedType)) return undefined;
  if (typeof parsed.title !== "string" || !parsed.title.trim()) return undefined;
  if (parsed.proposedType === "plotEssentialsUpdate" && (typeof parsed.content !== "string" || !parsed.content.trim())) return undefined;

  if (adventure.activeState.memoryProposals.some((p) => p.status === "pending" && p.proposedType === parsed.proposedType)) return undefined;

  const proposal: MemoryProposal = {
    id: createId("proposal"),
    sourceTurnId: String(adventure.activeState.turn),
    sourceText: responseText.slice(0, 500),
    proposedType: parsed.proposedType as MemoryProposal["proposedType"],
    title: parsed.title.trim(),
    content: generateContent && typeof parsed.content === "string" ? parsed.content : "",
    suggestedTriggers: Array.isArray(parsed.suggestedTriggers)
      ? (parsed.suggestedTriggers as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 6)
      : [],
    confidence: 0.8,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "AI-detected durable fact.",
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return { type: "ADD_MEMORY_PROPOSAL", proposal };
}
