import { buildContext } from "../contextBuilder/contextBuilder";
import { runContinuityCheck, scanForRiskyClaims } from "../continuityLint";
import { detectMemoryFromTurn } from "../memory/memoryDetection";
import { evaluateTriggerRules, type TriggerEvaluationEvent } from "../triggers/triggerEngine";
import type {
  Adventure,
  AdventureAction,
  ChatMessage,
  ContextBuildResult,
  InputMode,
  ProviderConfig,
  ProviderUsage,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import { adventureReducer } from "./adventureReducer";

export interface MockableProviderResponse {
  content: string;
  usage?: ProviderUsage;
}

export interface RunTurnPipelineOptions {
  adventure: Adventure;
  text: string;
  mode?: InputMode;
  sendChatCompletion: (
    messages: ChatMessage[],
    adventureSnapshot: Adventure,
    context: ContextBuildResult,
  ) => Promise<MockableProviderResponse>;
  providerConfig?: ProviderConfig;
  userMessageId?: string;
  assistantMessageId?: string;
  createdAt?: string;
}

export interface RunTurnPipelineResult {
  adventure: Adventure;
  preProviderContext: ContextBuildResult;
  postTurnContext: ContextBuildResult;
  providerPayload: ChatMessage[];
  responseContent: string;
  detectionTokenUsage?: { promptTokens: number; completionTokens: number };
  continuityCorrected?: boolean;
}

export function reduceActions(adventure: Adventure, actions: AdventureAction[]): Adventure {
  return actions.reduce((next, action) => adventureReducer(next, action), adventure);
}

export function applyRuntimeEngines(adventure: Adventure, event: TriggerEvaluationEvent): Adventure {
  const triggerResult = evaluateTriggerRules(adventure, event);
  return reduceActions(adventure, triggerResult.actions);
}

export function latestAssistantOutput(adventure: Adventure): string | undefined {
  return [...adventure.messages].reverse().find((message) => message.role === "assistant")?.content;
}

export async function runTurnPipeline({
  adventure,
  text,
  mode = "story",
  sendChatCompletion,
  providerConfig,
  userMessageId,
  assistantMessageId,
  createdAt,
}: RunTurnPipelineOptions): Promise<RunTurnPipelineResult> {
  let next = adventureReducer(adventure, {
    type: "ADD_MESSAGE",
    role: "user",
    content: text,
    inputMode: mode,
    id: userMessageId,
    createdAt,
  });
  next = applyRuntimeEngines(next, { source: "input", text });

  const preProviderContext = buildContext(next, {
    currentInput: text,
    latestModelOutput: latestAssistantOutput(next),
  });
  const providerPayload = preProviderContext.messages;
  const response = await sendChatCompletion(providerPayload, next, preProviderContext);

  // Continuity lint: scan for risky claims and, if found, run a targeted LLM check.
  // Uses only the last 8 messages as context to keep tokens low.
  let finalContent = response.content;
  let continuityCorrected = false;
  if (mode !== "comms" && providerConfig && scanForRiskyClaims(response.content)) {
    const lintAccum = { promptTokens: 0, completionTokens: 0 };
    const lintResult = await runContinuityCheck(next, providerConfig, response.content, lintAccum);
    if (lintResult.correctedText) {
      finalContent = lintResult.correctedText;
      continuityCorrected = true;
    }
    if (lintAccum.promptTokens > 0 || lintAccum.completionTokens > 0) {
      next = adventureReducer(next, { type: "ACCUMULATE_BACKGROUND_TOKENS", ...lintAccum });
    }
  }

  next = adventureReducer(next, {
    type: "ADD_MESSAGE",
    role: "assistant",
    content: finalContent,
    inputMode: undefined,
    id: assistantMessageId,
    createdAt,
    usage: response.usage,
  });
  next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });

  let detectionTokenUsage: { promptTokens: number; completionTokens: number } | undefined;
  const detectionSettings = next.memoryDetectionSettings;
  const detectionTurn = next.activeState.turn;
  const detectionOnCooldown = detectionSettings.lastDetectionTurn !== undefined &&
    (detectionTurn - detectionSettings.lastDetectionTurn) < detectionSettings.everyNTurns;
  if (mode !== "comms" && !next.activeState.challengeMode && detectionSettings.enabled && !detectionOnCooldown && providerConfig) {
    const accum = { promptTokens: 0, completionTokens: 0 };
    const proposalAction = await detectMemoryFromTurn(next, providerConfig, response.content, accum);
    if (proposalAction) next = adventureReducer(next, proposalAction);
    next = adventureReducer(next, { type: "SET_MEMORY_DETECTION_SETTINGS", settings: { ...next.memoryDetectionSettings, lastDetectionTurn: detectionTurn } });
    if (accum.promptTokens > 0 || accum.completionTokens > 0) {
      detectionTokenUsage = accum;
      next = adventureReducer(next, { type: "ACCUMULATE_BACKGROUND_TOKENS", ...accum });
    }
  }

  next = applyRuntimeEngines(next, { source: "output", text: response.content });
  next = adventureReducer(next, { type: "INCREMENT_TURN" });

  return {
    adventure: next,
    preProviderContext,
    postTurnContext: buildContext(next, { latestModelOutput: finalContent }),
    providerPayload,
    responseContent: finalContent,
    detectionTokenUsage,
    continuityCorrected,
  };
}
