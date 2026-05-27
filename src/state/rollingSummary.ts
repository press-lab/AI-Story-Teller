import type { Adventure } from "../types/adventure";

export interface RollingSummaryPayload {
  messages: { role: "system" | "user"; content: string }[];
  lastIndex: number;
  fromIndex: number;
}

export function clampedSummaryStartIndex(adventure: Adventure): number {
  const rawIndex = adventure.rollingSummary.lastSummarizedMessageIndex ?? 0;
  if (!Number.isFinite(rawIndex)) return 0;
  return Math.max(0, Math.min(Math.floor(rawIndex), adventure.messages.length));
}

/**
 * Build the LLM payload for an incremental summary update.
 * Sends the current summary plus only messages not yet captured in it.
 * The start index is clamped so story erases/undo never skip unseen transcript.
 */
export function buildRollingSummaryPayload(adventure: Adventure): RollingSummaryPayload {
  const allMessages = adventure.messages;
  const fromIndex = clampedSummaryStartIndex(adventure);
  const newMessages = allMessages.slice(fromIndex).slice(-60);
  const lastIndex = allMessages.length;

  const currentSummary = adventure.rollingSummary.content?.trim();
  const newEventsText = newMessages.length
    ? newMessages.map((message) => `${message.role === "assistant" ? "Story" : "Player"}: ${message.content}`).join("\n\n")
    : "No new events.";

  const userContent = currentSummary
    ? `## Current Rolling Summary\n${currentSummary}\n\n## New Story Events\n${newEventsText}\n\nUpdate the rolling summary to incorporate these new events.`
    : `## Story So Far\n${newEventsText}\n\nCreate a concise rolling summary of these events.`;

  return {
    messages: [
      {
        role: "system",
        content:
          "You are a continuity keeper for an interactive fiction adventure. " +
          "Update the rolling summary to incorporate new story events. " +
          "Preserve all important facts: character states, relationships, world details, open plot threads, completed events. " +
          "Keep it focused and under 900 words. Write in past tense, third person.",
      },
      { role: "user", content: userContent },
    ],
    lastIndex,
    fromIndex,
  };
}
