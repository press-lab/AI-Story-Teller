import type { StoryCard } from "../types/adventure";

type StoryCardPolicyInput = Pick<StoryCard, "title" | "content" | "memoryMode"> &
  Partial<Pick<StoryCard, "keys" | "state" | "archivedFacts" | "pinned" | "protected" | "priority" | "tokenBudget">>;

export const GUARDED_STORY_CARD_STATE_TAG = "guardedMemory";
export const GUARDED_STORY_CARD_MIN_PRIORITY = 80;
export const GUARDED_STORY_CARD_MIN_TOKEN_BUDGET = 450;

const GUARDED_CARD_TERMS = [
  "alliance",
  "bargain",
  "compact",
  "cover story",
  "deal",
  "official cover",
  "official story",
  "oath",
  "pact",
  "political shield",
  "promise",
  "secret alliance",
  "shield",
  "truce",
  "vow",
];

const GUARDED_FACT_PATTERNS = [
  /\b(alliance|bargain|compact|deal|oath|pact|promise|promised|truce|vow)\b/i,
  /\b(agreed|agreement|condition|conditional|terms?)\b/i,
  /\b(no more killing|self-protection|repent|mentor|mentorship|visit|visits)\b/i,
  /\b(rune(?:-etched)? coin|summon)\b/i,
  /\b(secret|cover story|official cover|official story|political shield|shielded|shielding|shield)\b/i,
  /\b(councilor|stay(?:ing)? on (?:the )?council|remain(?:s|ed|ing)? on (?:the )?council)\b/i,
  /\b(accomplice|fugitive|harboring|reprisal|leash|obligation|debt|blackmail|betrayal)\b/i,
];

function normalizePolicyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function appendStateTag(state: string | undefined, tag: string): string {
  const tags = new Set((state ?? "").split(/\s+/).filter(Boolean));
  tags.add(tag);
  return Array.from(tags).join(" ");
}

export function splitStoryCardFacts(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeStoryCardFact(fact: string): string {
  return normalizePolicyText(fact.replace(/^[-*\u2022]\s*/, ""));
}

export function isGuardedStoryCardMemory(card: StoryCardPolicyInput, incomingContent = ""): boolean {
  const titleText = normalizePolicyText([card.title, ...(card.keys ?? [])].join(" "));
  if (GUARDED_CARD_TERMS.some((term) => titleText.includes(term))) return true;

  const bodyText = [card.content, card.archivedFacts, incomingContent, card.state]
    .filter(Boolean)
    .map((value) => normalizePolicyText(value ?? ""))
    .join(" ");
  return GUARDED_FACT_PATTERNS.some((pattern) => pattern.test(bodyText));
}

export function isGuardedStoryCardFact(card: StoryCardPolicyInput, fact: string): boolean {
  if (!isGuardedStoryCardMemory(card)) return false;
  const normalized = normalizePolicyText(fact);
  return GUARDED_FACT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function applyGuardedStoryCardPolicy<T extends StoryCardPolicyInput>(card: T): T {
  if (!isGuardedStoryCardMemory(card)) return card;
  const tokenBudget = card.tokenBudget && card.tokenBudget > 0
    ? card.tokenBudget
    : GUARDED_STORY_CARD_MIN_TOKEN_BUDGET;
  return {
    ...card,
    pinned: true,
    protected: true,
    priority: Math.max(card.priority ?? 0, GUARDED_STORY_CARD_MIN_PRIORITY),
    tokenBudget,
    state: appendStateTag(card.state, GUARDED_STORY_CARD_STATE_TAG),
  };
}

export function restoreGuardedFactsToLiveContent<T extends StoryCardPolicyInput>(card: T): T {
  if (!isGuardedStoryCardMemory(card) || !card.archivedFacts?.trim()) return card;

  const seen = new Set<string>();
  const orderedFacts = [
    ...splitStoryCardFacts(card.archivedFacts).filter((fact) => isGuardedStoryCardFact(card, fact)),
    ...splitStoryCardFacts(card.content),
  ].filter((fact) => {
    const normalized = normalizeStoryCardFact(fact);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return { ...card, content: orderedFacts.join("\n") };
}
