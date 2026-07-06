import type { Adventure, AdventureAction, ComponentEntry, ProviderConfig, StoryCardAIBuilderRequest } from "../../src/types/adventure";
import { buildContext } from "../../src/contextBuilder/contextBuilder";
import { parseAidStoryCards } from "../../src/importers/aidCardParser";
import { parseAidStoryText } from "../../src/importers/aidStoryParser";
import { parseComponentsJson } from "../../src/importers/componentParser";
import { createDefaultAdventure, makeComponent, normalizeAdventure, sanitizeAdventureForPersistence } from "../../src/state/defaults";
import { adventureReducer } from "../../src/state/adventureReducer";
import { runTurnPipeline } from "../../src/state/turnPipeline";
import { importAdventureJson } from "../../src/utils/json";
import { getAdventureThumbnail } from "../../src/utils/adventureImages";
import { sendOpenAICompatibleChatCompletion } from "../../src/providers/openAICompatible";
import { generateBrainFromName as generateBrainEntry } from "../../src/ai/generators";
import { runBrainAudit, type BrainAuditRecommendation } from "../../src/memory/brainAudit";
import { runStoryCardAudit, type AuditRecommendation } from "../../src/memory/storyCardAudit";
import {
  runManualBrainUpdate,
  runManualStoryCardsUpdate,
  runStoryCardAIBuilder,
} from "../../src/triggers/semanticEngine";
import type { ApiConfig } from "./config";
import type { AdventureSnapshotRecord, BackendAdventureRecord, LocalDbData, UsageLog } from "./apiTypes";
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
  providerOverride?: Partial<ProviderConfig>;
}

export interface BackendAiToolResult {
  adventure: Adventure;
}

export interface BackendStoryCardAuditResult {
  recommendations: AuditRecommendation[];
}

export interface BackendBrainAuditResult {
  recommendations: BrainAuditRecommendation[];
}

export interface AdventureSnapshotSummary {
  id: string;
  adventureId: string;
  source: AdventureSnapshotRecord["source"];
  title: string;
  createdAt: string;
  adventureUpdatedAt: string;
  turnCount: number;
  storyEntryCount: number;
}

const MAX_SNAPSHOTS_PER_ADVENTURE = 100;

const allowedPersonalProviderHosts = new Set([
  "api.deepseek.com",
  "api.groq.com",
  "api.openai.com",
  "openrouter.ai",
]);

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
    thumbnailImage: getAdventureThumbnail(adventure),
  };
}

export function saveBackendAdventure(
  data: LocalDbData,
  ownerUserId: string,
  adventure: Adventure,
  source: AdventureSnapshotRecord["source"],
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
  pruneAdventureSnapshots(data, ownerUserId, cleanAdventure.id);
  return data.adventures.find((entry) => entry.id === cleanAdventure.id && entry.ownerUserId === ownerUserId)!;
}

export function listAdventureSnapshots(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
): AdventureSnapshotSummary[] {
  getOwnedAdventureRecord(data, ownerUserId, adventureId);
  return data.adventureSnapshots
    .filter((snapshot) => snapshot.userId === ownerUserId && snapshot.adventureId === adventureId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(summarizeAdventureSnapshot);
}

export function restoreAdventureSnapshot(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  snapshotId: string,
): Adventure {
  getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const snapshot = data.adventureSnapshots.find(
    (entry) => entry.id === snapshotId && entry.userId === ownerUserId && entry.adventureId === adventureId,
  );
  if (!snapshot) throw new Error("Adventure backup not found.");
  const restored = normalizeAdventure({
    ...snapshot.adventure,
    updatedAt: nowIso(),
  });
  return saveBackendAdventure(data, ownerUserId, restored, "restore").adventure;
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

function backendProviderConfig(
  data: LocalDbData,
  config: ApiConfig,
  override?: Partial<ProviderConfig>,
): ProviderConfig {
  const platformProviderConfig = effectiveProviderConfig(data, config);
  const providerConfig = override
    ? { ...platformProviderConfig, ...sanitizePersonalProviderOverride(override) }
    : platformProviderConfig;
  if (!providerConfig.apiKey?.trim()) {
    throw new Error("Backend provider API key is not configured. Ask the platform owner to configure the server model key.");
  }
  return providerConfig;
}

function assertBackendAiInputAllowed(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  text: string,
  config: ApiConfig,
): void {
  const decision = recordPolicyDecision(data, {
    gate: "input",
    text,
    userId: ownerUserId,
    subjectType: "adventure",
    subjectId: adventureId,
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(decision);
}

function applyActionsToAdventure(adventure: Adventure, actions: AdventureAction[]): Adventure {
  let next = adventure;
  for (const action of actions) {
    next = adventureReducer(next, action);
  }
  return normalizeAdventure(sanitizeAdventureForPersistence(next));
}

function assertAiToolProducedWork(actionCount: number, errors: string[], fallback: string): void {
  if (actionCount > 0) return;
  if (errors.length > 0) throw new Error(errors[0]);
  throw new Error(fallback);
}

export async function runBackendStoryCardBuilder(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  request: StoryCardAIBuilderRequest,
  config: ApiConfig,
  providerOverride?: Partial<ProviderConfig>,
): Promise<BackendAiToolResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  assertBackendAiInputAllowed(data, ownerUserId, adventureId, request.description ?? "", config);
  const result = await runStoryCardAIBuilder(record.adventure, backendProviderConfig(data, config, providerOverride), request);
  const proposalCount = result.actions.filter((action) => action.type === "ADD_MEMORY_PROPOSAL").length;
  assertAiToolProducedWork(proposalCount, result.logEntry.errors, "The AI did not produce a Story Card suggestion.");
  const next = applyActionsToAdventure(record.adventure, result.actions);
  return { adventure: saveBackendAdventure(data, ownerUserId, next, "manualSave").adventure };
}

export async function runBackendStoryCardUpdates(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  config: ApiConfig,
  providerOverride?: Partial<ProviderConfig>,
): Promise<BackendAiToolResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const result = await runManualStoryCardsUpdate(record.adventure, backendProviderConfig(data, config, providerOverride));
  const proposalCount = result.actions.filter((action) => action.type === "ADD_MEMORY_PROPOSAL").length;
  assertAiToolProducedWork(proposalCount, result.logEntry.errors, "The AI did not produce Story Card update suggestions.");
  const next = applyActionsToAdventure(record.adventure, result.actions);
  return { adventure: saveBackendAdventure(data, ownerUserId, next, "manualSave").adventure };
}

export async function runBackendBrainGeneration(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  name: string,
  config: ApiConfig,
  providerOverride?: Partial<ProviderConfig>,
): Promise<BackendAiToolResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  assertBackendAiInputAllowed(data, ownerUserId, adventureId, name, config);
  const brain = await generateBrainEntry(record.adventure, backendProviderConfig(data, config, providerOverride), name);
  const next = adventureReducer(record.adventure, { type: "UPSERT_BRAIN", brain });
  return { adventure: saveBackendAdventure(data, ownerUserId, next, "manualSave").adventure };
}

export async function runBackendBrainUpdate(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  brainId: string,
  config: ApiConfig,
  providerOverride?: Partial<ProviderConfig>,
): Promise<BackendAiToolResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const result = await runManualBrainUpdate(record.adventure, backendProviderConfig(data, config, providerOverride), brainId);
  const actionCount = result.actions.filter((action) => action.type !== "LOG_EVALUATION_RESULT").length;
  assertAiToolProducedWork(actionCount, result.logEntry.errors, "The AI did not produce a character update.");
  const next = applyActionsToAdventure(record.adventure, result.actions);
  return { adventure: saveBackendAdventure(data, ownerUserId, next, "manualSave").adventure };
}

export async function runBackendStoryCardAudit(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  nTurns: number,
  includeAI: boolean,
  config: ApiConfig,
  providerOverride?: Partial<ProviderConfig>,
): Promise<BackendStoryCardAuditResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const providerConfig = includeAI ? backendProviderConfig(data, config, providerOverride) : effectiveProviderConfig(data, config);
  return {
    recommendations: await runStoryCardAudit(record.adventure, providerConfig, nTurns, { includeAI }),
  };
}

export async function runBackendBrainAudit(
  data: LocalDbData,
  ownerUserId: string,
  adventureId: string,
  nTurns: number,
  includeAI: boolean,
  config: ApiConfig,
  providerOverride?: Partial<ProviderConfig>,
): Promise<BackendBrainAuditResult> {
  assertCanGenerate(data, ownerUserId);
  const record = getOwnedAdventureRecord(data, ownerUserId, adventureId);
  const providerConfig = includeAI ? backendProviderConfig(data, config, providerOverride) : effectiveProviderConfig(data, config);
  return {
    recommendations: await runBrainAudit(record.adventure, providerConfig, nTurns, { includeAI }),
  };
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

  const providerConfig = backendProviderConfig(data, config, options.providerOverride);

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

function summarizeAdventureSnapshot(snapshot: AdventureSnapshotRecord): AdventureSnapshotSummary {
  const adventure = normalizeAdventure(snapshot.adventure);
  return {
    id: snapshot.id,
    adventureId: snapshot.adventureId,
    source: snapshot.source,
    title: adventure.title,
    createdAt: snapshot.createdAt,
    adventureUpdatedAt: adventure.updatedAt,
    turnCount: adventure.activeState.turn,
    storyEntryCount: adventure.messages.filter((message) => message.role === "user" || message.role === "assistant").length,
  };
}

function pruneAdventureSnapshots(data: LocalDbData, ownerUserId: string, adventureId: string): void {
  const matching = data.adventureSnapshots
    .filter((snapshot) => snapshot.userId === ownerUserId && snapshot.adventureId === adventureId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const keepIds = new Set(matching.slice(0, MAX_SNAPSHOTS_PER_ADVENTURE).map((snapshot) => snapshot.id));
  data.adventureSnapshots = data.adventureSnapshots.filter(
    (snapshot) => snapshot.userId !== ownerUserId || snapshot.adventureId !== adventureId || keepIds.has(snapshot.id),
  );
}

function importAist(input: ImportAdventureInput): Adventure {
  return importAdventureJson(asJsonText(input));
}

export function sanitizePersonalProviderOverride(
  override: Partial<ProviderConfig> | undefined,
): Partial<ProviderConfig> | undefined {
  if (!override) return undefined;
  if (!override.baseUrl || !override.model || !override.apiKey) {
    throw new Error("Personal model mode requires a provider URL, model, and API key.");
  }
  const url = new URL(override.baseUrl);
  if (url.protocol !== "https:" || !allowedPersonalProviderHosts.has(url.hostname.toLowerCase())) {
    throw new Error("Personal model provider must use an approved HTTPS provider.");
  }
  const sanitized: Partial<ProviderConfig> = {
    name: typeof override.name === "string" && override.name.trim() ? override.name.trim() : "personal",
    baseUrl: url.toString().replace(/\/+$/, ""),
    model: override.model.trim(),
    apiKey: override.apiKey.trim(),
    promptCaching: Boolean(override.promptCaching),
  };
  if (Number.isFinite(override.temperature)) sanitized.temperature = Math.max(0, Math.min(2, override.temperature!));
  if (Number.isFinite(override.maxOutputTokens)) sanitized.maxOutputTokens = Math.max(1, Math.min(200_000, Math.round(override.maxOutputTokens!)));
  if (override.topP !== undefined) sanitized.topP = Math.max(0, Math.min(1, override.topP));
  if (override.presencePenalty !== undefined) sanitized.presencePenalty = Math.max(0, Math.min(2, override.presencePenalty));
  if (override.frequencyPenalty !== undefined) sanitized.frequencyPenalty = Math.max(0, Math.min(2, override.frequencyPenalty));
  if (override.openRouterProviderSort === "price" || override.openRouterProviderSort === "throughput" || override.openRouterProviderSort === "latency") {
    sanitized.openRouterProviderSort = override.openRouterProviderSort;
  }
  if (override.openRouterDataCollection === "allow" || override.openRouterDataCollection === "deny") {
    sanitized.openRouterDataCollection = override.openRouterDataCollection;
  }
  return sanitized;
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
