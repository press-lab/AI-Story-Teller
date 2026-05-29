import type { ComponentType, Message } from "../types/adventure";
import { createId, nowIso } from "../utils/id";

export type AidStorySourceKind =
  | "empty"
  | "actions-json"
  | "metadata-json"
  | "marked-transcript"
  | "alternating-paragraphs"
  | "mixed";

export interface AidSetupComponentDraft {
  title: string;
  type: ComponentType;
  content: string;
  priority: number;
  alwaysOn: boolean;
  pinned: boolean;
}

export interface AidStoryParseResult {
  messages: Message[];
  warnings: string[];
  sourceKind: AidStorySourceKind;
  detectedTitle?: string;
  rollingSummarySuggestion?: string;
  openingScene?: string;
  setupComponents: AidSetupComponentDraft[];
}

interface AidAction {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  createdAt?: unknown;
}

function normalizeBlock(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function message(role: Message["role"], content: string, createdAt?: unknown): Message {
  return {
    id: createId("msg"),
    role,
    content,
    createdAt: typeof createdAt === "string" ? createdAt : nowIso(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function cleanUserAction(text: string): string {
  return normalizeBlock(text.replace(/^\s*>\s?/gm, ""));
}

function shouldSkipActionText(text: string): boolean {
  return /^>>>\s*please select ["']?continue["']?\s*\(\d+%\)\s*<<<$/i.test(text.trim());
}

function roleForAction(action: AidAction): Message["role"] {
  const type = typeof action.type === "string" ? action.type.toLowerCase() : "";
  if (type === "do" || type === "say" || type === "story") return "user";
  if (type === "start" || type === "continue") return "assistant";
  const text = typeof action.text === "string" ? action.text : "";
  return /^\s*>/.test(text) ? "user" : "assistant";
}

function parseActions(actions: unknown[]): { messages: Message[]; warnings: string[] } {
  const parsedMessages: Message[] = [];
  const warnings: string[] = [];

  for (const [index, rawAction] of actions.entries()) {
    if (!isRecord(rawAction)) {
      warnings.push(`Skipped action ${index + 1}: action was not an object.`);
      continue;
    }
    const action = rawAction as AidAction;
    if (typeof action.text !== "string") {
      warnings.push(`Skipped action ${index + 1}: missing text.`);
      continue;
    }
    const role = roleForAction(action);
    const content = role === "user" ? cleanUserAction(action.text) : normalizeBlock(action.text);
    if (!content) continue;
    if (shouldSkipActionText(content)) {
      warnings.push(`Skipped action ${index + 1}: AI Dungeon continue marker.`);
      continue;
    }
    parsedMessages.push(message(role, content, action.createdAt));
  }

  return { messages: parsedMessages, warnings };
}

function actionsFromJson(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    if (value.every((item) => isRecord(item) && ("text" in item || "type" in item))) return value;
    const actionParts = value.filter((item) => isRecord(item) && Array.isArray(item.actions));
    if (actionParts.length > 0) {
      return [...actionParts]
        .sort((a, b) => Number((a as Record<string, unknown>).partNumber ?? 0) - Number((b as Record<string, unknown>).partNumber ?? 0))
        .flatMap((item) => (item as { actions: unknown[] }).actions);
    }
  }
  if (isRecord(value)) {
    // Direct actions array on the top-level object
    if (Array.isArray(value.actions)) return value.actions;
    // Nested inside `adventure` (some AID export formats)
    if (isRecord(value.adventure) && Array.isArray(value.adventure.actions)) return value.adventure.actions as unknown[];
    // Nested inside `data`
    if (isRecord(value.data) && Array.isArray(value.data.actions)) return value.data.actions as unknown[];
  }
  return undefined;
}

function setupFromMetadata(value: unknown): {
  title?: string;
  summary?: string;
  openingScene?: string;
  components: AidSetupComponentDraft[];
  isMetadata: boolean;
} {
  if (!isRecord(value)) return { components: [], isMetadata: false };
  const adventure = isRecord(value.adventure) ? value.adventure : undefined;
  const state = isRecord(value.state) ? value.state : undefined;
  const instructions = isRecord(state?.instructions) ? state.instructions : undefined;
  const components: AidSetupComponentDraft[] = [];

  const description = stringField(adventure, "description");

  const memory = stringField(adventure, "memory");
  if (memory) {
    components.push({
      title: "AI Dungeon Memory",
      type: "memory",
      content: memory,
      priority: 95,
      alwaysOn: true,
      pinned: false,
    });
  }

  const authorsNote = stringField(adventure, "authorsNote");
  if (authorsNote) {
    components.push({
      title: "AI Dungeon Author's Note",
      type: "authorNote",
      content: authorsNote,
      priority: 80,
      alwaysOn: true,
      pinned: false,
    });
  }

  const customInstructions = stringField(instructions, "custom") ?? stringField(instructions, "scenario");
  if (customInstructions) {
    components.push({
      title: "AI Dungeon Instructions",
      type: "aiInstructions",
      content: customInstructions,
      priority: 90,
      alwaysOn: true,
      pinned: false,
    });
  }

  return {
    title: stringField(adventure, "title"),
    summary: stringField(state, "storySummary"),
    openingScene: description,
    components,
    isMetadata: Boolean(adventure || state),
  };
}

function parseJsonValue(value: unknown): AidStoryParseResult {
  const metadata = setupFromMetadata(value);
  const actions = actionsFromJson(value);
  const warnings: string[] = [];

  if (actions) {
    const actionResult = parseActions(actions);
    warnings.push(...actionResult.warnings);
    if (metadata.isMetadata && metadata.components.length > 0) {
      warnings.push("Imported AI Dungeon metadata as setup components.");
    }
    return {
      messages: actionResult.messages,
      warnings,
      sourceKind: "actions-json",
      detectedTitle: metadata.title,
      rollingSummarySuggestion: metadata.summary,
      openingScene: metadata.openingScene,
      setupComponents: metadata.components,
    };
  }

  if (metadata.isMetadata) {
    warnings.push("Metadata file detected. No action history was found in this file.");
    return {
      messages: [],
      warnings,
      sourceKind: "metadata-json",
      detectedTitle: metadata.title,
      rollingSummarySuggestion: metadata.summary,
      openingScene: metadata.openingScene,
      setupComponents: metadata.components,
    };
  }

  return {
    messages: [],
    warnings: ["JSON was valid, but no AI Dungeon actions or metadata were found."],
    sourceKind: "empty",
    setupComponents: [],
  };
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
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
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

function tryParseJsonDocuments(text: string): AidStoryParseResult | undefined {
  const documents = extractTopLevelJsonDocuments(text);
  if (documents.length <= 1) return undefined;

  const parsedResults: AidStoryParseResult[] = [];
  for (const document of documents) {
    try {
      parsedResults.push(parseJsonValue(JSON.parse(document)));
    } catch {
      return undefined;
    }
  }
  return mergeAidStoryParseResults(parsedResults);
}

function parseMarkedTranscript(rawText: string): AidStoryParseResult {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const messages: Message[] = [];
  let assistantLines: string[] = [];

  function flushAssistant() {
    const content = normalizeBlock(assistantLines.join("\n"));
    if (content) messages.push(message("assistant", content));
    assistantLines = [];
  }

  for (const line of lines) {
    if (/^\s*>/.test(line)) {
      flushAssistant();
      const content = normalizeBlock(line.replace(/^\s*>\s?/, ""));
      if (content) messages.push(message("user", content));
    } else {
      assistantLines.push(line);
    }
  }
  flushAssistant();

  return {
    messages,
    warnings: [],
    sourceKind: "marked-transcript",
    setupComponents: [],
  };
}

function parseAlternatingParagraphs(rawText: string): AidStoryParseResult {
  const paragraphs = rawText
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map(normalizeBlock)
    .filter(Boolean);

  return {
    messages: paragraphs.map((paragraph, index) => message(index % 2 === 0 ? "assistant" : "user", paragraph)),
    warnings: ["No lines beginning with > were found. Parsed by alternating paragraphs starting with assistant."],
    sourceKind: "alternating-paragraphs",
    setupComponents: [],
  };
}

export function mergeAidStoryParseResults(results: AidStoryParseResult[]): AidStoryParseResult {
  if (results.length === 0) {
    return {
      messages: [],
      warnings: [],
      sourceKind: "empty",
      setupComponents: [],
    };
  }
  if (results.length === 1) return results[0];

  return {
    messages: results.flatMap((result) => result.messages),
    warnings: results.flatMap((result) => result.warnings),
    sourceKind: "mixed",
    detectedTitle: results.find((result) => result.detectedTitle)?.detectedTitle,
    rollingSummarySuggestion: results.find((result) => result.rollingSummarySuggestion)?.rollingSummarySuggestion,
    openingScene: results.find((result) => result.openingScene)?.openingScene,
    setupComponents: results.flatMap((result) => result.setupComponents),
  };
}

export function parseAidStoryText(rawText: string): AidStoryParseResult {
  const text = rawText.trim();
  if (!text) {
    return {
      messages: [],
      warnings: ["Story text is empty. You can still import story cards only."],
      sourceKind: "empty",
      setupComponents: [],
    };
  }

  try {
    return parseJsonValue(JSON.parse(text));
  } catch {
    const parsedDocuments = tryParseJsonDocuments(text);
    if (parsedDocuments) return parsedDocuments;
  }

  if (/^\s*>/m.test(text)) return parseMarkedTranscript(text);
  return parseAlternatingParagraphs(text);
}
