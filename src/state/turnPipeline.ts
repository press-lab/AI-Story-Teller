import { buildContext } from "../contextBuilder/contextBuilder";
import { classifyMemory } from "../memory/classificationPolicy";
import { evaluateTriggerRules, type TriggerEvaluationEvent } from "../triggers/triggerEngine";
import type {
  Adventure,
  AdventureAction,
  ChatMessage,
  ContextBuildResult,
  InputMode,
  MemoryProposal,
} from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import { adventureReducer } from "./adventureReducer";

export interface MockableProviderResponse {
  content: string;
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

export function createMemoryProposalAction(
  snapshot: Adventure,
  text: string,
): Extract<AdventureAction, { type: "ADD_MEMORY_PROPOSAL" }> | undefined {
  const classification = classifyMemory(text, {
    existingBrainNames: snapshot.brains.map((brain) => brain.characterName),
    existingStoryCards: snapshot.storyCards.map((card) => ({ id: card.id, title: card.title, keys: card.keys })),
  });
  if (classification.proposedType === "ignore") return undefined;

  const proposal: MemoryProposal = {
    id: createId("proposal"),
    sourceTurnId: String(snapshot.activeState.turn),
    sourceText: text.slice(0, 500),
    proposedType: classification.proposedType,
    title: classification.title,
    content: classification.content,
    suggestedTriggers: classification.suggestedTriggers,
    confidence: classification.confidence,
    rationale: classification.rationale,
    status: "pending",
    targetId: classification.targetId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return { type: "ADD_MEMORY_PROPOSAL", proposal };
}

export async function runTurnPipeline({
  adventure,
  text,
  mode = "story",
  sendChatCompletion,
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
  });

  if (mode !== "comms") {
    const proposalAction = createMemoryProposalAction(next, response.content);
    if (proposalAction) next = adventureReducer(next, proposalAction);
  }

  next = applyRuntimeEngines(next, { source: "output", text: response.content });
  next = adventureReducer(next, { type: "INCREMENT_TURN" });

  return {
    adventure: next,
    preProviderContext,
    postTurnContext: buildContext(next, { latestModelOutput: response.content }),
    providerPayload,
    responseContent: response.content,
  };
}
