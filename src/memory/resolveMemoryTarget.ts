import type { Adventure, MemoryProposalType, StoryCard, StoryCardMemoryMode } from "../types/adventure";

export interface MemoryTargetDraft {
  proposedType: MemoryProposalType;
  title: string;
  content: string;
  sourceText?: string;
  suggestedTriggers?: string[];
  targetId?: string;
  appendContent?: boolean;
  memoryMode?: StoryCardMemoryMode;
  category?: string;
  rationale?: string;
}

export interface MemoryTargetResolution {
  proposedType: MemoryProposalType;
  title: string;
  content: string;
  suggestedTriggers: string[];
  targetId?: string;
  appendContent?: boolean;
  memoryMode?: StoryCardMemoryMode;
  rationale?: string;
}

const TOKEN_STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "before", "being", "between", "card",
  "current", "during", "from", "has", "have", "into", "its", "new", "now", "official", "only", "that",
  "the", "their", "them", "this", "through", "turn", "under", "was", "were", "with", "without",
]);

const GENERIC_TRIGGER_WORDS = new Set([
  "active", "currently", "connection", "date", "event", "facts", "missing", "mutual interest", "now",
  "official", "romantic", "search", "specialists", "status", "termination", "the search",
]);

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizedTokens(value: string): Set<string> {
  const tokens = normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !TOKEN_STOPWORDS.has(token));
  return new Set(tokens);
}

function overlapScore(input: Set<string>, candidate: Set<string>): number {
  let score = 0;
  for (const token of input) {
    if (candidate.has(token)) score += 1;
  }
  return score;
}

export function isLivingStoryCard(card: Pick<StoryCard, "memoryMode" | "state">): boolean {
  return card.memoryMode === "living" || (card.state ?? "").split(/\s+/).includes("living");
}

export function inferStoryCardMemoryMode(draft: Pick<MemoryTargetDraft, "title" | "content" | "sourceText" | "category" | "memoryMode">): StoryCardMemoryMode {
  if (draft.memoryMode) return draft.memoryMode;
  const text = normalize([draft.title, draft.content, draft.sourceText].filter(Boolean).join(" "));
  if (draft.category === "plot_beat") return "historical";
  if (draft.category === "relationship" || draft.category === "status_change") return "living";
  if (draft.category === "character_reveal" || draft.category === "world_fact") return "static";
  if (/\b(currently|right now|actively|ongoing|periodic|maintenance|retainer|requires?|mandated|monitoring|searching|hunting)\b/.test(text)) {
    return "living";
  }
  if (/\b(escaped|stole|sold|agreed|revealed|confirmed|completed|defeated|rescued|sealed|concluded|first worked|first time)\b/.test(text)) {
    return "historical";
  }
  return "static";
}

function exactStoryCardTarget(adventure: Adventure, draft: MemoryTargetDraft, inferredMode: StoryCardMemoryMode): StoryCard | undefined {
  if (draft.targetId) {
    const target = adventure.storyCards.find((card) => card.id === draft.targetId);
    if (target) return target;
  }
  const titleNorm = normalize(draft.title);
  const exactTitle = adventure.storyCards.find((card) => normalize(card.title) === titleNorm);
  if (exactTitle && (isLivingStoryCard(exactTitle) || inferredMode === "living" || draft.appendContent === true)) {
    return exactTitle;
  }
  return adventure.storyCards.find((card) => card.keys.some((key) => normalize(key) === titleNorm));
}

function bestLivingTarget(adventure: Adventure, draft: MemoryTargetDraft): StoryCard | undefined {
  const inputTokens = normalizedTokens([draft.title, draft.content, draft.sourceText].filter(Boolean).join(" "));
  if (inputTokens.size === 0) return undefined;
  const candidates = adventure.storyCards.filter((card) => card.active && isLivingStoryCard(card));
  let best: { card: StoryCard; score: number } | undefined;
  for (const card of candidates) {
    const subjectTokens = normalizedTokens([card.title, ...card.keys].join(" "));
    const contentTokens = normalizedTokens(card.content.slice(0, 1200));
    const score =
      overlapScore(inputTokens, subjectTokens) * 4 +
      Math.min(8, overlapScore(inputTokens, contentTokens));
    if (score >= 8 && (!best || score > best.score)) best = { card, score };
  }
  return best?.card;
}

function triggerBelongsToOtherCard(adventure: Adventure, normalizedTrigger: string, targetId?: string): boolean {
  return adventure.storyCards.some((card) => {
    if (card.id === targetId) return false;
    return [card.title, ...card.keys].some((key) => normalize(key) === normalizedTrigger);
  });
}

export function sanitizeStoryCardTriggers(
  adventure: Adventure,
  title: string,
  triggers: string[] | undefined,
  targetId?: string,
): string[] {
  const titleNorm = normalize(title);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of triggers ?? []) {
    const clean = raw.trim();
    if (!clean) continue;
    const norm = normalize(clean);
    if (!norm || (norm === titleNorm && titleNorm.includes(" "))) continue;
    if (seen.has(norm)) continue;
    if (GENERIC_TRIGGER_WORDS.has(norm)) continue;
    if (triggerBelongsToOtherCard(adventure, norm, targetId)) continue;
    seen.add(norm);
    result.push(clean);
    if (result.length >= 5) break;
  }
  return result;
}

export function resolveMemoryTarget(adventure: Adventure, draft: MemoryTargetDraft): MemoryTargetResolution {
  if (draft.proposedType !== "storyCard") {
    return {
      proposedType: draft.proposedType,
      title: draft.title,
      content: draft.content,
      suggestedTriggers: draft.suggestedTriggers ?? [],
      targetId: draft.targetId,
      appendContent: draft.appendContent,
      memoryMode: draft.memoryMode,
      rationale: draft.rationale,
    };
  }

  const inferredMode = inferStoryCardMemoryMode(draft);
  const target = exactStoryCardTarget(adventure, draft, inferredMode) ?? bestLivingTarget(adventure, draft);
  const targetMode = target ? (isLivingStoryCard(target) ? "living" : target.memoryMode) : undefined;
  const memoryMode = target && inferredMode === "living" && targetMode !== "historical" ? "living" : (targetMode ?? inferredMode);
  const appendContent = draft.appendContent ?? (target ? true : undefined);
  const title = target?.title ?? draft.title;
  const suggestedTriggers = sanitizeStoryCardTriggers(adventure, title, draft.suggestedTriggers, target?.id);
  const rationale = target && !draft.targetId
    ? [draft.rationale, `Routed to existing ${memoryMode} Story Card "${target.title}".`].filter(Boolean).join(" ")
    : draft.rationale;

  return {
    proposedType: "storyCard",
    title,
    content: draft.content,
    suggestedTriggers,
    targetId: target?.id,
    appendContent,
    memoryMode,
    rationale,
  };
}
