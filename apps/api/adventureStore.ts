import type { Adventure, ComponentEntry } from "../../src/types/adventure";
import { buildContext } from "../../src/contextBuilder/contextBuilder";
import { parseAidStoryCards } from "../../src/importers/aidCardParser";
import { parseAidStoryText } from "../../src/importers/aidStoryParser";
import { parseComponentsJson } from "../../src/importers/componentParser";
import { createDefaultAdventure, makeComponent, normalizeAdventure, sanitizeAdventureForPersistence } from "../../src/state/defaults";
import { adventureReducer } from "../../src/state/adventureReducer";
import { runTurnPipeline } from "../../src/state/turnPipeline";
import { importAdventureJson } from "../../src/utils/json";
import { sendOpenAICompatibleChatCompletion } from "../../src/providers/openAICompatible";
import type { ApiConfig } from "./config";
import type { BackendAdventureRecord, LocalDbData, UsageLog } from "./apiTypes";
import { assertCanGenerate } from "./accountSafety";
import { assertPolicyAllowed, recordPolicyDecision } from "./policy";
import { effectiveProviderConfig } from "./platformSettings";
import { createId, nowIso } from "./ids";

export interface ImportAdventureInput {
  sourceType: "aist" | "aid" | "githubSave";
  text?: string;
  json?: unknown;
  title?: string;
  storyCardsText?: string;
  componentsText?: string;
}

export interface TurnExecutionResult {
  adventure: Adventure;
  responseContent: string;
}

export interface BackendTurnOptions {
  mode?: "do" | "story" | "comms";
  recordUserInput?: boolean;
  providerCue?: string;
  regenerateLastAssistant?: boolean;
}

function asJsonText(input: ImportAdventureInput): string {
  if (typeof input.text === "string") return input.text;
  return JSON.stringify(input.json, null, 2);
}

function parseJsonInput(input: ImportAdventureInput): unknown {
  if (input.json !== undefined) return input.json;
  return JSON.parse(input.text ?? "{}") as unknown;
}

export function summarizeAdventure(adventure: Adventure) {
  return {
    id: adventure.id,
    title: adventure.title,
    createdAt: adventure.createdAt,
    updatedAt: adventure.updatedAt,
    turnCount: adventure.activeState.turn,
    storyEntryCount: adventure.messages.filter((message) => message.role === "user" || message.role === "assistant").length,
  };
}

export function saveBackendAdventure(
  data: LocalDbData,
  ownerUserId: string,
  adventure: Adventure,
  source: "import" | "turn" | "manualSave",
): BackendAdventureRecord {
  const now = nowIso();
  const cleanAdventure = normalizeAdventure(sanitizeAdventureForPersistence(adventure));
  const existing = data.adventures.find((entry) => entry.id === cleanAdventure.id && entry.ownerUserId === ownerUserId);
  if (existing) {
    existing.adventure = cleanAdventure;
    existing.updatedAt = now;
  } else {
    data.adventures.push({
      id: cleanAdventure.id,
      ownerUserId,
      adventure: cleanAdventure,
      createdAt: now,
      updatedAt: now,
    });
  }
  data.adventureSnapshots.push({
    id: createId("snapshot"),
    adventureId: cleanAdventure.id,
    userId: ownerUserId,
    source,
    adventure: cleanAdventure,
    createdAt: now,
  });
  return data.adventures.find((entry) => entry.id === cleanAdventure.id && entry.ownerUserId === ownerUserId)!;
}

export function importAdventureAsCopy(
  data: LocalDbData,
  ownerUserId: string,
  input: ImportAdventureInput,
  config: ApiConfig,
): Adventure[] {
  const rawText = asJsonText(input);
  const importDecision = recordPolicyDecision(data, {
    gate: "import",
    text: rawText,
    userId: ownerUserId,
    subjectType: "adventureImport",
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(importDecision);

  const imported = input.sourceType === "aist"
    ? [importAist(input)]
    : input.sourceType === "githubSave"
      ? importGitHubSave(input)
      : [importAid(input)];

  for (const adventure of imported) {
    saveBackendAdventure(data, ownerUserId, adventure, "import");
  }
  return imported;
}

export function buildServerContextPreview(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  config: ApiConfig,
) {
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const context = buildContext(record.adventure);
  const contextDecision = recordPolicyDecision(data, {
    gate: "context",
    text: context.messages.map((message) => message.content).join("\n\n"),
    userId: ownerUserId,
    subjectType: "adventure",
    subjectId: adventureId,
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(contextDecision);
  data.contextBuildEvents.push({
    id: createId("context"),
    userId: ownerUserId,
    adventureId,
    gate: "preview",
    context,
    createdAt: nowIso(),
  });
  return context;
}

export async function runBackendTurn(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  input: string,
  config: ApiConfig,
  options: BackendTurnOptions = {},
): Promise<TurnExecutionResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const inputDecision = recordPolicyDecision(data, {
    gate: "input",
    text: input,
    userId: ownerUserId,
    subjectType: "adventure",
    subjectId: adventureId,
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(inputDecision);

  const providerConfig = effectiveProviderConfig(data, config);
  if (!providerConfig.apiKey?.trim()) {
    throw new Error("Backend provider API key is not configured. Set AIST_PROVIDER_API_KEY in .env for backend turns.");
  }

  const baseAdventure = options.regenerateLastAssistant
    ? adventureReducer(record.adventure, { type: "REMOVE_LAST_ASSISTANT_MESSAGE" })
    : record.adventure;
  const lastUser = [...baseAdventure.messages].reverse().find((message) => message.role === "user")?.content;
  const result = await runTurnPipeline({
    adventure: baseAdventure,
    text: input,
    mode: options.mode ?? "story",
    recordUserInput: options.recordUserInput,
    providerCue: options.providerCue,
    currentInputForContext: options.regenerateLastAssistant ? lastUser ?? input : undefined,
    incrementTurn: !options.regenerateLastAssistant,
    advanceArcPacing: !options.regenerateLastAssistant,
    providerConfig,
    sendChatCompletion: async (messages, snapshot, context) => {
      const contextDecision = recordPolicyDecision(data, {
        gate: "context",
        text: messages.map((message) => message.content).join("\n\n"),
        userId: ownerUserId,
        subjectType: "adventure",
        subjectId: adventureId,
        policyMode: config.policyMode,
      });
      assertPolicyAllowed(contextDecision);
      data.contextBuildEvents.push({
        id: createId("context"),
        userId: ownerUserId,
        adventureId,
        gate: "turn",
        context,
        createdAt: nowIso(),
      });
      const providerResponse = await sendOpenAICompatibleChatCompletion({ messages, config: providerConfig });
      const outputDecision = recordPolicyDecision(data, {
        gate: "output",
        text: providerResponse.content,
        userId: ownerUserId,
        subjectType: "adventure",
        subjectId: adventureId,
        policyMode: config.policyMode,
      });
      assertPolicyAllowed(outputDecision);
      const memoryDecision = recordPolicyDecision(data, {
        gate: "memoryWrite",
        text: providerResponse.content,
        userId: ownerUserId,
        subjectType: "adventure",
        subjectId: adventureId,
        policyMode: config.policyMode,
      });
      assertPolicyAllowed(memoryDecision);
      data.usageLogs.push({
        id: createId("usage"),
        userId: ownerUserId,
        adventureId,
        providerName: providerConfig.name,
        model: providerConfig.model,
        usage: providerResponse.usage,
        createdAt: nowIso(),
      } satisfies UsageLog);
      return providerResponse;
    },
  });
  saveBackendAdventure(data, ownerUserId, result.adventure, "turn");
  return { adventure: result.adventure, responseContent: result.responseContent };
}

export function getOwnedAdventureRecord(data: LocalDbData, ownerUserId: string, adventureId: string): BackendAdventureRecord {
  const record = data.adventures.find((entry) => entry.id === adventureId && entry.ownerUserId === ownerUserId);
  if (!record) throw new Error("Adventure not found.");
  return record;
}

function importAist(input: ImportAdventureInput): Adventure {
  return importAdventureJson(asJsonText(input), true);
}

function importGitHubSave(input: ImportAdventureInput): Adventure[] {
  const parsed = parseJsonInput(input) as Record<string, unknown>;
  if (parsed?.app === "ai-story-teller" && Array.isArray(parsed.adventures)) {
    return parsed.adventures.map((adventure) => duplicateAdventure(adventure as Adventure));
  }
  if (parsed?.app === "ai-story-teller" && parsed.adventure && typeof parsed.adventure === "object") {
    return [duplicateAdventure(parsed.adventure as Adventure)];
  }
  if (parsed?.id && parsed?.title) {
    return [importAdventureJson(JSON.stringify(parsed), true)];
  }
  throw new Error("GitHub save JSON was not recognized as an AI Story Teller bundle or save file.");
}

function importAid(input: ImportAdventureInput): Adventure {
  const storyText = asJsonText(input);
  const storyResult = parseAidStoryText(storyText);
  const cardResult = input.storyCardsText ? parseAidStoryCards(input.storyCardsText) : undefined;
  const componentResult = input.componentsText ? parseComponentsJson(input.componentsText) : undefined;
  const title = input.title?.trim() || storyResult.detectedTitle?.trim() || "Imported AI Dungeon Adventure";
  const base = createDefaultAdventure(title);
  const timestamp = nowIso();
  const setupComponents = mergeSingletonComponents<ComponentEntry>([
    ...storyResult.setupComponents.map((component) => makeComponent(component)),
    ...(componentResult?.components.map((parsed) => parsed.component) ?? []),
  ]);
  const adventure: Adventure = {
    ...base,
    openingScene: componentResult?.openingScene ?? storyResult.openingScene ?? base.openingScene,
    components: mergeSingletonComponents([...base.components, ...setupComponents]),
    storyCards: cardResult?.cards.map((card) => card.storyCard) ?? [],
    brains: cardResult?.cards.flatMap((card) => card.brainCandidate ? [card.brainCandidate] : []) ?? [],
    messages: storyResult.messages,
    metadata: {
      ...base.metadata,
      aiDungeonImport: {
        importedAt: timestamp,
        storySourceKind: storyResult.sourceKind,
        messageCount: storyResult.messages.length,
        parsedCardCount: cardResult?.cards.length ?? 0,
        warnings: [...storyResult.warnings, ...(cardResult?.warnings ?? []), ...(componentResult?.warnings ?? [])],
      },
    },
    activeState: {
      ...base.activeState,
      turn: storyResult.messages.filter((message) => message.role === "user").length,
    },
    updatedAt: timestamp,
  };
  return normalizeAdventure(sanitizeAdventureForPersistence(adventure));
}

function duplicateAdventure(adventure: Adventure): Adventure {
  return importAdventureJson(JSON.stringify(adventure), true);
}

function mergeSingletonComponents<T extends { type: ComponentEntry["type"] }>(components: T[]): T[] {
  const singletonTypes = new Set<ComponentEntry["type"]>(["narrationRules", "aiInstructions", "plotEssentials", "currentArc", "activePressure", "authorNote"]);
  const out: T[] = [];
  const seenSingleton = new Set<ComponentEntry["type"]>();
  for (const component of components) {
    if (singletonTypes.has(component.type)) {
      if (seenSingleton.has(component.type)) continue;
      seenSingleton.add(component.type);
    }
    out.push(component);
  }
  return out;
}
