import { buildContext, extractInlineThoughts } from "../contextBuilder/contextBuilder";
import type { MemoryProposal } from "../types/adventure";
import { runContinuityCheck, scanForRiskyClaims } from "../continuityLint";
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

  // Extract inline thought tags and memory tags from the response before the player sees it
  const { cleanContent: thoughtCleanContent, thoughts: inlineThoughts, memoryTags } = extractInlineThoughts(response.content);
  const rawContentForLint = thoughtCleanContent;

  // Continuity lint: scan for risky claims and, if found, run a targeted LLM check.
  // Uses only the last 8 messages as context to keep tokens low.
  let finalContent = thoughtCleanContent;
  let continuityCorrected = false;
  if (mode !== "comms" && providerConfig && scanForRiskyClaims(rawContentForLint)) {
    const lintAccum = { promptTokens: 0, completionTokens: 0 };
    const lintResult = await runContinuityCheck(next, providerConfig, rawContentForLint, lintAccum);
    if (lintResult.correctedText) {
      finalContent = lintResult.correctedText;
      continuityCorrected = true;
    }
    if (lintAccum.promptTokens > 0 || lintAccum.completionTokens > 0) {
      next = adventureReducer(next, { type: "ACCUMULATE_BACKGROUND_TOKENS", ...lintAccum });
    }
  }

  // Apply inline thought captures to brains (zero extra API calls)
  if (inlineThoughts.length > 0) {
    const turn = next.activeState.turn;
    for (const thought of inlineThoughts) {
      const brain = next.brains.find(
        (b) => b.characterName.toLowerCase() === thought.name.toLowerCase(),
      );
      if (brain && thought.key && thought.value) {
        next = adventureReducer(next, {
          type: "UPDATE_BRAIN",
          brainId: brain.id,
          patch: {
            thoughts: { [`${turn}_${thought.key}`]: `${turn} → ${thought.value}` },
            lastUpdatedTurn: turn,
          },
        });
      }
    }
  }

  // Convert inline memory tags to story card proposals (zero extra API calls)
  if (memoryTags.length > 0) {
    const turn = next.activeState.turn;
    const existingTitles = new Set(next.storyCards.map((c) => c.title.toLowerCase()));
    for (const tag of memoryTags) {
      // Deduplicate: skip if a card with this title already exists
      if (existingTitles.has(tag.title.toLowerCase())) continue;
      const now = nowIso();
      const proposal: MemoryProposal = {
        id: createId("proposal"),
        sourceTurnId: String(turn),
        sourceText: "",
        proposedType: "storyCard",
        title: tag.title,
        content: tag.content,
        suggestedTriggers: tag.triggers,
        confidence: 0.75,
        rationale: `Inline memory tag: ${tag.category}`,
        status: "pending",
        appendContent: false,
        createdAt: now,
        updatedAt: now,
      };
      next = adventureReducer(next, { type: "ADD_MEMORY_PROPOSAL", proposal });
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

  next = applyRuntimeEngines(next, { source: "output", text: response.content });
  next = adventureReducer(next, { type: "INCREMENT_TURN" });

  return {
    adventure: next,
    preProviderContext,
    postTurnContext: buildContext(next, { latestModelOutput: finalContent }),
    providerPayload,
    responseContent: finalContent,
    continuityCorrected,
  };
}
