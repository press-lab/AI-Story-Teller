import { makeStoryCard } from "../state/defaults";
import type { StoryCard, StoryCardType } from "../types/adventure";

export interface ParsedStoryCard {
  id: string;
  sourceIndex: number;
  title: string;
  keysText: string;
  content: string;
  originalType: string;
  storyCard: StoryCard;
  raw: unknown;
}

export interface SkippedStoryCard {
  sourceIndex: number;
  reason: string;
  raw: unknown;
}

export interface StoryCardParseResult {
  cards: ParsedStoryCard[];
  skipped: SkippedStoryCard[];
  warnings: string[];
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (value == null) return "";
  return String(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value);
    if (text.trim()) return text;
  }
  return "";
}

function keysToArray(keysText: string): string[] {
  return keysText
    .split(",")
    .map((key) => key.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function mapStoryCardType(typeText: string): StoryCardType {
  const lower = typeText.toLowerCase();
  if (lower === "character") return "character";
  if (lower === "location" || lower === "place") return "location";
  if (lower === "plot") return "plot";
  if (lower === "lore" || lower === "concept" || lower === "class") return "lore";
  return "custom";
}

function collectCards(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    if (Array.isArray(value.storyCards)) return value.storyCards;
    if (isRecord(value.state) && Array.isArray(value.state.storyCards)) return value.state.storyCards;
    if ("title" in value || "keys" in value || "entry" in value || "value" in value || "content" in value) return [value];
  }
  return [];
}

function extractTopLevelJsonDocuments(text: string): string[] {
  const documents: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        documents.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return documents;
}

function parseCard(raw: unknown, sourceIndex: number): ParsedStoryCard | SkippedStoryCard {
  if (!isRecord(raw)) {
    return { sourceIndex, reason: "Card was not an object.", raw };
  }

  const keysText = stringValue(raw.keys);
  const content = firstString(raw.entry, raw.value, raw.content);
  const originalType = firstString(raw.type) || "custom";
  const title = firstString(raw.title, `Imported Card ${sourceIndex + 1}`);
  const description = firstString(raw.description, raw.notes);

  if (!title.trim() && !content.trim()) {
    return { sourceIndex, reason: "Card had no title or content.", raw };
  }

  const storyCard = makeStoryCard({
    title,
    keys: keysToArray(keysText),
    content,
    type: mapStoryCardType(originalType),
    active: true,
    pinned: false,
    priority: 0,
    state: JSON.stringify({
      source: "storyCardJson",
      originalType,
      description,
      originalKeys: keysText,
    }),
  });

  return {
    id: storyCard.id,
    sourceIndex,
    title,
    keysText,
    content,
    originalType,
    storyCard,
    raw,
  };
}

function parseJsonValue(value: unknown): StoryCardParseResult {
  const rawCards = collectCards(value);
  if (rawCards.length === 0) {
    return {
      cards: [],
      skipped: [],
      warnings: ["Valid JSON was found, but it did not contain reference cards."],
    };
  }

  const cards: ParsedStoryCard[] = [];
  const skipped: SkippedStoryCard[] = [];
  rawCards.forEach((rawCard, index) => {
    const parsed = parseCard(rawCard, index);
    if ("storyCard" in parsed) cards.push(parsed);
    else skipped.push(parsed);
  });

  return {
    cards,
    skipped,
    warnings: skipped.length > 0 ? [`Skipped ${skipped.length} card(s). Review reasons before importing.`] : [],
  };
}

function tryParseMultipleDocuments(text: string): StoryCardParseResult | undefined {
  const documents = extractTopLevelJsonDocuments(text);
  if (documents.length <= 1) return undefined;
  const results: StoryCardParseResult[] = [];
  for (const document of documents) {
    try {
      results.push(parseJsonValue(JSON.parse(document)));
    } catch {
      return undefined;
    }
  }
  return mergeStoryCardParseResults(results);
}

export function mergeStoryCardParseResults(results: StoryCardParseResult[]): StoryCardParseResult {
  return {
    cards: results.flatMap((result) => result.cards),
    skipped: results.flatMap((result) => result.skipped),
    warnings: results.flatMap((result) => result.warnings),
    error: results.find((result) => result.error)?.error,
  };
}

export function parseStoryCardsJson(rawText: string): StoryCardParseResult {
  const text = rawText.trim();
  if (!text) {
    return {
      cards: [],
      skipped: [],
      warnings: ["Reference Card JSON is empty."],
    };
  }

  try {
    return parseJsonValue(JSON.parse(text));
  } catch (error) {
    const multiDocumentResult = tryParseMultipleDocuments(text);
    if (multiDocumentResult) return multiDocumentResult;
    return {
      cards: [],
      skipped: [],
      warnings: [],
      error: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}
