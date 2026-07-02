import type { Adventure, ComponentEntry, ComponentType, Message, ProviderConfig } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";
import { lastNTurns } from "./storyCardAudit";

export type ComponentAuditAction = "edit" | "delete" | "create";
export type ComponentAuditDecision = "pending" | "approved" | "rejected";
export type ComponentAuditSource = "deterministic" | "llm";

export interface ComponentAuditRecommendation {
  id: string;
  action: ComponentAuditAction;
  source: ComponentAuditSource;
  componentId?: string;
  title: string;
  rationale: string;
  suggestedContent: string;
  suggestedType: ComponentType;
  decision: ComponentAuditDecision;
  editedContent: string;
}

const TYPE_LABELS: Record<ComponentType, string> = {
  narrationRules: "Narration Rules",
  aiInstructions: "AI Instructions",
  plotEssentials: "Plot Essentials",
  currentArc: "Current Story Arc",
  activePressure: "Active Pressure",
  immediateMomentum: "Immediate Momentum",
  authorNote: "Author's Note",
  memory: "Lore Block",
  custom: "Custom",
};

const AUDITABLE_TYPES = new Set<ComponentType>([
  "plotEssentials",
  "activePressure",
  "currentArc",
  "custom",
  "memory",
  "immediateMomentum",
]);

const VALID_TYPES = new Set<ComponentType>([
  "plotEssentials",
  "activePressure",
  "currentArc",
  "custom",
  "memory",
]);

function resolvedProviderConfig(adventure: Adventure, providerConfig: ProviderConfig): ProviderConfig {
  const bg = adventure.semanticEvaluationSettings.backgroundProviderConfig;
  if (bg?.baseUrl) {
    return {
      ...providerConfig,
      baseUrl: bg.baseUrl,
      apiKey: bg.apiKey ?? providerConfig.apiKey,
      model: bg.model || providerConfig.model,
      promptCaching: bg.baseUrl === providerConfig.baseUrl ? providerConfig.promptCaching : undefined,
    };
  }
  return { ...providerConfig, model: adventure.semanticEvaluationSettings.evaluationModel || providerConfig.model };
}

function formatMessages(messages: Message[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role === "user" ? "Player" : "Story"}: ${m.content}`)
    .join("\n\n");
}

function lineCount(text: string): number {
  return text.split("\n").filter((line) => line.trim()).length;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function makeRec(
  id: string,
  action: ComponentAuditAction,
  component: ComponentEntry,
  rationale: string,
  overrides: Partial<ComponentAuditRecommendation> = {},
): ComponentAuditRecommendation {
  return {
    id,
    action,
    source: "deterministic",
    componentId: component.id,
    title: component.title || TYPE_LABELS[component.type],
    rationale,
    suggestedContent: component.content,
    suggestedType: VALID_TYPES.has(component.type) ? component.type : "custom",
    decision: "pending",
    editedContent: component.content,
    ...overrides,
  };
}

function deterministicRecommendations(components: ComponentEntry[]): ComponentAuditRecommendation[] {
  const results: ComponentAuditRecommendation[] = [];
  for (const component of components) {
    if (component.type === "immediateMomentum") {
      results.push(makeRec(
        `det-legacy-${component.id}`,
        "delete",
        component,
        "Immediate Momentum is a disabled legacy block; current next-beat steering belongs in recent context or Next Output Bias.",
        { suggestedContent: "", editedContent: "" },
      ));
      continue;
    }

    if (component.active && wordCount(component.content) < 8) {
      results.push(makeRec(
        `det-stub-${component.id}`,
        "edit",
        component,
        "This active component is nearly empty and likely needs cleanup or removal.",
      ));
    }

    if (component.type === "plotEssentials" && lineCount(component.content) > 10) {
      results.push(makeRec(
        `det-pe-long-${component.id}`,
        "edit",
        component,
        "Plot Essentials is long for always-on current truth; consolidate it and move resolved history to Story Cards.",
      ));
    }

    if (component.type === "activePressure" && (lineCount(component.content) > 1 || wordCount(component.content) > 35)) {
      results.push(makeRec(
        `det-pressure-long-${component.id}`,
        "edit",
        component,
        "Active Pressure should be one compact sentence naming the current external threat, obligation, or force.",
      ));
    }
  }
  return results;
}

function buildPrompt(components: ComponentEntry[], rollingSummary: string, recentStory: string): string {
  const componentList = components
    .map((component) => `[${component.id}] "${component.title}" (${component.type})\n${component.content.slice(0, 2400)}`)
    .join("\n\n---\n\n");

  return `You are cleaning up plot components for an interactive fiction game. Components are always-on or explicitly configured context blocks, so they must be lean and current.

COMPONENTS UNDER REVIEW:
${componentList || "(none)"}

STORY SO FAR (summary):
${rollingSummary || "(none)"}

RECENT STORY:
${recentStory || "(none)"}

Return ONLY a JSON array - no markdown, no prose. Each item must be one of:
- {"action":"edit","componentId":"...","title":"...","rationale":"...","suggestedContent":"...","suggestedType":"plotEssentials"|"activePressure"|"currentArc"|"custom"|"memory"}
- {"action":"delete","componentId":"...","title":"...","rationale":"..."}
- {"action":"create","title":"...","rationale":"...","suggestedContent":"...","suggestedType":"plotEssentials"|"activePressure"|"currentArc"|"custom"|"memory"}

Rules:
- Plot Essentials is compact current operating truth: active stakes, constraints, obligations, and open tensions. Prefer 4-7 tight lines.
- Plot Essentials should not hoard completed history. If replacing it removes durable history, the app will preserve outgoing facts as historical Story Card suggestions.
- Active Pressure is exactly one sentence naming the current external threat, obligation, deadline, pursuit, debt, or force pressing on the player character.
- Current Story Arc is a past-tense running log of arc developments. Do not duplicate Plot Essentials or write live scene directions there.
- Custom/memory blocks should hold stable always-on rules or lore only when they truly need to load every turn; otherwise recommend a Story Card in the rationale instead of bloating a component.
- Do not propose edits to AI Instructions, Narration Rules, or Author's Note; those are not included in this review.
- Delete only disabled legacy blocks, empty blocks, or duplicate blocks that are clearly useless.
- Be selective - only changes with clear story justification.
- Rationale: one specific sentence.
- Return [] if no changes are needed.`;
}

function parseLLMResponse(raw: string): ComponentAuditRecommendation[] {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!cleaned || cleaned === "[]") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return [];
  }

  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).recommendations)
      ? (parsed as Record<string, unknown>).recommendations as unknown[]
      : [];

  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => typeof item.action === "string" && ["edit", "delete", "create"].includes(item.action as string))
    .filter((item) => typeof item.title === "string" && (item.title as string).trim())
    .filter((item) => typeof item.rationale === "string" && (item.rationale as string).trim())
    .filter((item) => item.action === "create" || typeof item.componentId === "string")
    .map((item, i) => {
      const suggestedContent =
        typeof item.suggestedContent === "string" ? item.suggestedContent :
        typeof item.content === "string" ? item.content :
        "";
      const typeRaw = typeof item.suggestedType === "string" ? item.suggestedType : typeof item.type === "string" ? item.type : "";
      const suggestedType = VALID_TYPES.has(typeRaw as ComponentType) ? typeRaw as ComponentType : "custom";
      return {
        id: `llm-component-${Date.now()}-${i}`,
        action: item.action as ComponentAuditAction,
        source: "llm" as ComponentAuditSource,
        componentId: typeof item.componentId === "string" ? item.componentId : undefined,
        title: (item.title as string).trim(),
        rationale: (item.rationale as string).trim(),
        suggestedContent,
        suggestedType,
        decision: "pending" as ComponentAuditDecision,
        editedContent: suggestedContent,
      };
    });
}

export async function runComponentAudit(
  adventure: Adventure,
  providerConfig: ProviderConfig,
  nTurns: number,
): Promise<ComponentAuditRecommendation[]> {
  const recentMessages = lastNTurns(adventure.messages, nTurns);
  const summary = adventure.rollingSummary.content;
  const auditable = adventure.components.filter((component) => AUDITABLE_TYPES.has(component.type));

  const deterministic = deterministicRecommendations(auditable);
  const flaggedDeleteIds = new Set(deterministic.filter((rec) => rec.action === "delete").map((rec) => rec.componentId).filter(Boolean) as string[]);

  const currentTurn = adventure.activeState.turn;
  const llmComponents = auditable.filter((component) => {
    if (flaggedDeleteIds.has(component.id)) return false;
    if (component.lastAutoUpdateTurn !== undefined && currentTurn - component.lastAutoUpdateTurn <= nTurns) return false;
    return true;
  });

  let llmRecs: ComponentAuditRecommendation[] = [];
  if (llmComponents.length > 0) {
    const config = resolvedProviderConfig(adventure, providerConfig);
    const prompt = buildPrompt(llmComponents, summary, formatMessages(recentMessages));
    try {
      const response = await sendOpenAICompatibleChatCompletion({
        config,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Clean up these plot components and return your recommendations as a JSON array." },
        ],
      });
      llmRecs = parseLLMResponse(response.content);
    } catch {
      // LLM failure - return deterministic results only.
    }
    llmRecs = llmRecs.filter((rec) => !rec.componentId || !flaggedDeleteIds.has(rec.componentId));
  }

  return [...deterministic, ...llmRecs];
}
