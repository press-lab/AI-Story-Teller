import type { Adventure, Message, ProviderConfig, StoryCard } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";

export type AuditAction = "edit" | "delete" | "create";
export type AuditDecision = "pending" | "approved" | "rejected";
export type AuditSource = "deterministic" | "llm";

export interface AuditRecommendation {
  id: string;
  action: AuditAction;
  source: AuditSource;
  cardId?: string;
  title: string;
  rationale: string;
  suggestedContent: string;
  suggestedKeys: string[];
  suggestedType: string;
  decision: AuditDecision;
  editedContent: string;
  editedKeys: string;
}

// ── Provider ──────────────────────────────────────────────────────────────────

function resolvedProviderConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (bg?.baseUrl) {
    return { ...providerConfig, baseUrl: bg.baseUrl, apiKey: bg.apiKey ?? providerConfig.apiKey, model: bg.model || providerConfig.model };
  }
  return { ...providerConfig, model: adventure.semanticEvaluationSettings.evaluationModel || providerConfig.model };
}

// ── Message helpers ───────────────────────────────────────────────────────────

export function lastNTurns(messages: Message[], n: number): Message[] {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") count++;
    if (count === n) return messages.slice(i);
  }
  return messages;
}

function formatMessages(messages: Message[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Player" : "Story"}: ${m.content}`)
    .join("\n\n");
}

// ── Deterministic checks ──────────────────────────────────────────────────────

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
}

function makeRec(
  id: string,
  action: AuditAction,
  card: StoryCard,
  rationale: string,
  overrides: Partial<AuditRecommendation> = {},
): AuditRecommendation {
  return {
    id,
    action,
    source: "deterministic",
    cardId: card.id,
    title: card.title,
    rationale,
    suggestedContent: card.content,
    suggestedKeys: card.keys,
    suggestedType: card.type,
    decision: "pending",
    editedContent: card.content,
    editedKeys: card.keys.join(", "),
    ...overrides,
  };
}

function detectRedundant(cards: StoryCard[]): AuditRecommendation[] {
  const results: AuditRecommendation[] = [];
  const flagged = new Set<string>();
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      if (flagged.has(a.id) || flagged.has(b.id)) continue;
      const wordsA = wordSet(a.content);
      const wordsB = wordSet(b.content);
      if (wordsA.size < 10 || wordsB.size < 10) continue;
      const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
      const overlap = intersection / Math.min(wordsA.size, wordsB.size);
      if (overlap > 0.5) {
        const [keep, drop] = wordsA.size >= wordsB.size ? [a, b] : [b, a];
        flagged.add(drop.id);
        results.push(makeRec(
          `det-overlap-${drop.id}`,
          "delete",
          drop,
          `${Math.round(overlap * 100)}% word overlap with "${keep.title}" — likely redundant.`,
          { suggestedContent: "", suggestedKeys: [], editedContent: "", editedKeys: "" },
        ));
      }
    }
  }
  return results;
}

function detectNoKeys(cards: StoryCard[]): AuditRecommendation[] {
  return cards
    .filter((c) => c.active && c.keys.length === 0)
    .map((c) => makeRec(
      `det-nokeys-${c.id}`,
      "edit",
      c,
      "No trigger keys — this card will never be automatically included in context.",
    ));
}

function detectTinyContent(cards: StoryCard[]): AuditRecommendation[] {
  return cards
    .filter((c) => c.active && c.content.trim().split(/\s+/).filter(Boolean).length < 15)
    .map((c) => makeRec(
      `det-tiny-${c.id}`,
      "edit",
      c,
      "Very short content — likely a stub that needs more detail.",
    ));
}

function detectZeroFrequency(cards: StoryCard[], recentMessages: Message[], rollingSummary: string): AuditRecommendation[] {
  const corpus = [
    ...recentMessages.filter((m) => m.role !== "system").map((m) => m.content),
    rollingSummary,
  ].join(" ").toLowerCase();

  return cards
    .filter((c) => {
      if (!c.active || c.keys.length === 0) return false;
      if (c.inclusionPolicy === "always") return false;
      return !c.keys.some((k) => corpus.includes(k.toLowerCase()));
    })
    .map((c) => makeRec(
      `det-freq-${c.id}`,
      "delete",
      c,
      "Trigger keys not found anywhere in the story — this entity may be stale or the keys may be wrong.",
      { suggestedContent: "", suggestedKeys: [], editedContent: "", editedKeys: "" },
    ));
}

// ── LLM pass ─────────────────────────────────────────────────────────────────

function buildPrompt(cards: StoryCard[], rollingSummary: string, recentStory: string): string {
  const cardList = cards
    .map((c) => `[${c.id}] "${c.title}" (${c.type}) keys: ${c.keys.join(", ")}\n${c.content.slice(0, 150)}`)
    .join("\n\n---\n\n");

  return `You are auditing story cards for an interactive fiction game. Structural issues (redundancy, missing keys, stale entries) have already been flagged — focus on semantic accuracy and gaps.

STORY CARDS UNDER REVIEW:
${cardList || "(none)"}

STORY SO FAR (summary):
${rollingSummary || "(none)"}

RECENT STORY:
${recentStory || "(none)"}

Return ONLY a JSON array — no markdown, no prose. Each item must be one of:
- {"action":"edit","cardId":"...","title":"...","rationale":"...","suggestedContent":"...","suggestedKeys":["..."],"suggestedType":"character"|"location"|"lore"|"plot"|"custom"}
- {"action":"delete","cardId":"...","title":"...","rationale":"..."}
- {"action":"create","title":"...","rationale":"...","suggestedContent":"...","suggestedKeys":["..."],"suggestedType":"character"|"location"|"lore"|"plot"|"custom"}

Rules:
- Edit: card content is outdated or factually wrong based on recent events
- Delete: card covers something that no longer exists in the story
- Create: a recurring entity or fact has no card at all
- Be selective — only changes with clear story justification
- Rationale: one specific sentence
- Return [] if no changes are needed`;
}

const VALID_TYPES = new Set(["character", "location", "lore", "plot", "custom"]);

function parseLLMResponse(raw: string): AuditRecommendation[] {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!cleaned || cleaned === "[]" || !cleaned.startsWith("[")) return [];

  let parsed: unknown[];
  try {
    parsed = JSON.parse(cleaned) as unknown[];
  } catch {
    return [];
  }

  return (parsed as unknown[])
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => typeof item.action === "string" && ["edit", "delete", "create"].includes(item.action as string))
    .filter((item) => typeof item.title === "string" && (item.title as string).trim())
    .filter((item) => typeof item.rationale === "string" && (item.rationale as string).trim())
    .map((item, i) => {
      const suggestedContent = typeof item.suggestedContent === "string" ? item.suggestedContent : "";
      const suggestedKeys = Array.isArray(item.suggestedKeys)
        ? (item.suggestedKeys as unknown[]).filter((k): k is string => typeof k === "string")
        : [];
      const suggestedType = typeof item.suggestedType === "string" && VALID_TYPES.has(item.suggestedType)
        ? item.suggestedType
        : "custom";
      return {
        id: `llm-${Date.now()}-${i}`,
        action: item.action as AuditAction,
        source: "llm" as AuditSource,
        cardId: typeof item.cardId === "string" ? item.cardId : undefined,
        title: (item.title as string).trim(),
        rationale: (item.rationale as string).trim(),
        suggestedContent,
        suggestedKeys,
        suggestedType,
        decision: "pending" as AuditDecision,
        editedContent: suggestedContent,
        editedKeys: suggestedKeys.join(", "),
      };
    });
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function runStoryCardAudit(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  nTurns: number,
): Promise<AuditRecommendation[]> {
  const recentMessages = lastNTurns(adventure.messages, nTurns);
  const summary = adventure.rollingSummary.content;

  // Deterministic pass — free, runs first
  const detRedundant = detectRedundant(adventure.storyCards);
  const detNoKeys = detectNoKeys(adventure.storyCards);
  const detTiny = detectTinyContent(adventure.storyCards);
  const detFreq = detectZeroFrequency(adventure.storyCards, recentMessages, summary);
  const detRecs = [...detRedundant, ...detNoKeys, ...detTiny, ...detFreq];

  // Cards already handled deterministically — exclude from LLM
  const flaggedIds = new Set(detRecs.map((r) => r.cardId).filter(Boolean) as string[]);

  // Also skip cards auto-updated within the review window
  const currentTurn = adventure.activeState.turn;
  const llmCards = adventure.storyCards.filter((c) => {
    if (flaggedIds.has(c.id)) return false;
    if (c.lastAutoUpdateTurn !== undefined && currentTurn - c.lastAutoUpdateTurn <= nTurns) return false;
    return true;
  });

  // LLM pass — only for cards that passed the deterministic filter
  let llmRecs: AuditRecommendation[] = [];
  if (llmCards.length > 0) {
    const config = resolvedProviderConfig(adventure, providerConfig);
    const recentStory = formatMessages(recentMessages);
    const prompt = buildPrompt(llmCards, summary, recentStory);

    try {
      const response = await sendOpenAICompatibleChatCompletion({
        config,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Audit these story cards and return your recommendations as a JSON array." },
        ],
      });
      llmRecs = parseLLMResponse(response.content);
    } catch {
      // LLM failure — return deterministic results only
    }

    // Drop LLM recs for cards already handled deterministically
    llmRecs = llmRecs.filter((r) => !r.cardId || !flaggedIds.has(r.cardId));
  }

  return [...detRecs, ...llmRecs];
}
