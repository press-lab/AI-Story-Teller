import { buildContext } from "../contextBuilder/contextBuilder";
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

  next = adventureReducer(next, {
    type: "ADD_MESSAGE",
    role: "assistant",
    content: response.content,
    inputMode: mode === "comms" ? "comms" : undefined,
    id: assistantMessageId,
    createdAt,
    usage: response.usage,
  });
  next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });

  let detectionTokenUsage: { promptTokens: number; completionTokens: number } | undefined;
  if (mode !== "comms" && next.memoryDetectionSettings.enabled && providerConfig) {
    const accum = { promptTokens: 0, completionTokens: 0 };
    const proposalAction = await detectMemoryFromTurn(next, providerConfig, response.content, accum);
    if (proposalAction) next = adventureReducer(next, proposalAction);
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
    postTurnContext: buildContext(next, { latestModelOutput: response.content }),
    providerPayload,
    responseContent: response.content,
    detectionTokenUsage,
  };
}
