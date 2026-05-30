import type { Adventure } from "../types/adventure";

export interface RollingSummaryPayload {
  messages: { role: "system" | "user"; content: string }[];
  lastIndex: number;
  fromIndex: number;
}

export interface SceneStatePayload {
  messages: { role: "system" | "user"; content: string }[];
}

export function clampedSummaryStartIndex(adventure: Adventure): number {
  const rawIndex = adventure.rollingSummary.lastSummarizedMessageIndex ?? 0;
  if (!Number.isFinite(rawIndex)) return 0;
  return Math.max(0, Math.min(Math.floor(rawIndex), adventure.messages.length));
}

/**
 * Build the LLM payload for an incremental durable-summary update.
 * Captures only story-level canon — arc state, permanent changes, relationships,
 * open plot threads. Does NOT recap recent actions already in Recent Messages.
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
    ? `## Current Durable Summary\n${currentSummary}\n\n## New Story Events\n${newEventsText}\n\nUpdate the durable summary to incorporate any lasting changes from these events.`
    : `## Story Events\n${newEventsText}\n\nCreate a durable summary of these events.`;

  return {
    messages: [
      {
        role: "system",
        content:
          "You are a continuity keeper for an interactive fiction adventure. " +
          "Maintain a DURABLE STORY SUMMARY: the permanent record of story-level canon. " +
          "Include: completed arc beats, established world facts, permanent character changes, important relationships, open plot threads, major consequences. " +
          "Exclude: moment-to-moment actions, scene descriptions, recent turns still visible in Recent Messages, and ephemeral details that don't affect future scenes. " +
          "If a recent event changes something permanent (a character dies, an alliance forms, a secret is revealed), record it. Otherwise omit it. " +
          "Keep it under 600 words. Write in past tense, third person.",
      },
      { role: "user", content: userContent },
    ],
    lastIndex,
    fromIndex,
  };
}

/**
 * Build the LLM payload for a scene-state snapshot.
 * Captures only the immediate present: location, characters, situation, last beat.
 */
export function buildSceneStatePayload(adventure: Adventure): SceneStatePayload {
  const recentMessages = adventure.messages.slice(-12);
  const recentText = recentMessages.length
    ? recentMessages.map((m) => `${m.role === "assistant" ? "Story" : "Player"}: ${m.content}`).join("\n\n")
    : "No recent story turns.";

  const existingSceneState = adventure.sceneState?.content?.trim();

  const userContent = existingSceneState
    ? `## Previous Scene State\n${existingSceneState}\n\n## Recent Story Turns\n${recentText}\n\nUpdate the scene state. Carry forward the Active directive and Pending fields unless the story text shows they were explicitly resolved.`
    : `## Recent Story Turns\n${recentText}\n\nCapture the current scene state.`;

  return {
    messages: [
      {
        role: "system",
        content:
          "You are a scene-state tracker for an interactive fiction adventure. " +
          "Write a CURRENT SCENE STATE using exactly these labeled fields. Keep the total under 150 words.\n\n" +
          "Location: current physical setting.\n" +
          "Present: who is here and their immediate mood or posture.\n" +
          "Last beat: the most recent significant action, revelation, or exchange.\n" +
          "Active directive: any command, order, appointment, deadline, promise, or threat currently in force. " +
          "Carry this forward from the previous state unless the story has explicitly resolved it. If none, write None.\n" +
          "Pending: any open question or decision the player faces right now. If none, write None.\n\n" +
          "Write present tense, third person. Do not recap history. " +
          "If a directive or obligation exists, state it explicitly — do not let it be implied by recent messages.",
      },
      { role: "user", content: userContent },
    ],
  };
}
