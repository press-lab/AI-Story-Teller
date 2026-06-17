import type { Adventure, MemoryProposal, ProviderConfig } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";

function resolvedProviderConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (bg?.baseUrl) {
    return { ...providerConfig, baseUrl: bg.baseUrl, apiKey: bg.apiKey ?? providerConfig.apiKey, model: bg.model || providerConfig.model };
  }
  return { ...providerConfig, model: adventure.semanticEvaluationSettings.evaluationModel || providerConfig.model };
}

export async function regenerateProposalContent(
  proposal: MemoryProposal,
  adventure: Adventure,
  providerConfig: ProviderConfig,
): Promise<string> {
  const systemPrompt = `You are a world-memory assistant for an interactive fiction game.
The user has a memory suggestion they want better content for.
Write improved content for the suggestion titled "${proposal.title}" (type: ${proposal.proposedType}).
Source text from the story: ${proposal.sourceText}
${proposal.proposedType === "storyCard" ? 'Format: bullet points using the • character, one per line, no title in the body. If this card is a character (a person the story will voice), append a VOICE CONTRACT block after the bullets, written in their actual voice:\nVOICE CONTRACT\nRhythm: <pace, sentence structure>\nDefault move: <what they reach for under pressure>\nEmotional defense: <how they deflect or armor up>\nNever sounds like: <what to avoid — generic, "I feel…", offering choices>\nExample lines: "<line>" / "<line>"' : 'Format: 1–2 bullet points capturing only the NEW constraint or development to append. Do not rewrite the full block.'}
Respond with ONLY the content — no JSON, no preamble, no labels.`;

  const response = await sendOpenAICompatibleChatCompletion({
    config: resolvedProviderConfig(adventure, providerConfig),
    messages: [{ role: "user", content: systemPrompt }],
  });

  return response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
