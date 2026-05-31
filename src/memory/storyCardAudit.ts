import type { Adventure, Message, ProviderConfig, StoryCard } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";

export type AuditAction = "edit" | "delete" | "create";
export type AuditDecision = "pending" | "approved" | "rejected";

export interface AuditRecommendation {
  id: string;
  action: AuditAction;
  cardId?: string;
  title: string;
  rationale: string;
  suggestedContent: string;
  suggestedKeys: string[];
  suggestedType: string;
  decision: AuditDecision;
  editedContent: string;
  editedKeys: string;
}

function resolvedProviderConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (bg?.baseUrl) {
    return { ...providerConfig, baseUrl: bg.baseUrl, apiKey: bg.apiKey ?? providerConfig.apiKey, model: bg.model || providerConfig.model };
  }
  return { ...providerConfig, model: adventure.semanticEvaluationSettings.evaluationModel || providerConfig.model };
}

export function lastNTurns(messages: Message[], n: number): Message[] {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") count++;
    if (count === n) return messages.slice(i);
  }
  return messages;
}

function formatMessages(messages: Message[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Player" : "Story"}: ${m.content}`)
    .join("\n\n");
}

function buildPrompt(cards: StoryCard[], rollingSummary: string, recentStory: string): string {
  const cardList = cards
    .map((c) => `[${c.id}] "${c.title}" (${c.type}) keys: ${c.keys.join(", ")}\n${c.content.slice(0, 400)}`)
    .join("\n\n---\n\n");

  return `You are auditing story cards for an interactive fiction game. Review whether the existing cards are accurate, complete, and necessary given the story so far.

EXISTING STORY CARDS:
${cardList || "(none)"}

STORY SO FAR (summary):
${rollingSummary || "(none)"}

RECENT STORY:
${recentStory || "(none)"}

Return ONLY a JSON array — no markdown, no prose. Each item must be one of:
- {"action":"edit","cardId":"...","title":"...","rationale":"...","suggestedContent":"...","suggestedKeys":["..."],"suggestedType":"character"|"location"|"lore"|"plot"|"custom"}
- {"action":"delete","cardId":"...","title":"...","rationale":"..."}
- {"action":"create","title":"...","rationale":"...","suggestedContent":"...","suggestedKeys":["..."],"suggestedType":"character"|"location"|"lore"|"plot"|"custom"}

Rules:
- Delete: card is wrong, outdated, or redundant with another card
- Edit: card is incomplete or stale based on recent events
- Create: a recurring important entity, fact, or relationship has no card at all
- Be selective — only flag changes with clear story justification
- Rationale: one specific sentence explaining exactly why
- Return [] if no changes are needed`;
}

export async function runStoryCardAudit(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  nTurns: number,
): Promise<AuditRecommendation[]> {
  const config = resolvedProviderConfig(adventure, providerConfig);
  const recentMessages = lastNTurns(adventure.messages, nTurns);
  const recentStory = formatMessages(recentMessages);
  const prompt = buildPrompt(adventure.storyCards, adventure.rollingSummary.content, recentStory);

  const response = await sendOpenAICompatibleChatCompletion({
    config,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: "Audit these story cards and return your recommendations as a JSON array." },
    ],
  });

  const raw = response.content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!raw || raw === "[]" || !raw.startsWith("[")) return [];

  let parsed: unknown[];
  try {
    parsed = JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }

  const validActions = new Set(["edit", "delete", "create"]);
  const validTypes = new Set(["character", "location", "lore", "plot", "custom"]);

  return (parsed as unknown[])
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => typeof item.action === "string" && validActions.has(item.action))
    .filter((item) => typeof item.title === "string" && (item.title as string).trim())
    .filter((item) => typeof item.rationale === "string" && (item.rationale as string).trim())
    .map((item, i) => {
      const suggestedContent = typeof item.suggestedContent === "string" ? item.suggestedContent : "";
      const suggestedKeys = Array.isArray(item.suggestedKeys)
        ? (item.suggestedKeys as unknown[]).filter((k): k is string => typeof k === "string")
        : [];
      const suggestedType = typeof item.suggestedType === "string" && validTypes.has(item.suggestedType)
        ? item.suggestedType
        : "custom";
      return {
        id: `audit-${Date.now()}-${i}`,
        action: item.action as AuditAction,
        cardId: typeof item.cardId === "string" ? item.cardId : undefined,
        title: (item.title as string).trim(),
        rationale: (item.rationale as string).trim(),
        suggestedContent,
        suggestedKeys,
        suggestedType,
        decision: "pending" as AuditDecision,
        editedContent: suggestedContent,
        editedKeys: suggestedKeys.join(", "),
      };
    });
}
