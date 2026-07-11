import type { ContextBuildResult } from "../types/adventure";

export type ContextHealthStatus = "healthy" | "nearLimit" | "omitted" | "needsAttention";

export interface ContextHealth {
  status: ContextHealthStatus;
  label: string;
  detail: string;
  usedTokens: number;
  maxTokens: number;
  ratio: number;
}

export const contextNearLimitRatio = 0.85;

export function classifyContextHealth(
  result: ContextBuildResult,
  maxContextTokens: number,
): ContextHealth {
  const maxTokens = Math.max(0, maxContextTokens);
  const usedTokens = Math.max(0, result.totalEstimatedTokens);
  const ratio = maxTokens > 0 ? usedTokens / maxTokens : 1;
  const omittedForBudget = result.excludedItems.some((item) => item.reason === "budget_exceeded")
    || result.decisions.some((decision) =>
      decision.action === "truncated"
      || (decision.action === "dropped" && decision.reason === "budget_exceeded"),
    );
  const blockingDecision = result.decisions.some((decision) =>
    /protected.+(?:cannot|could not|exceed)|cannot.+fit|invalid payload/i.test(`${decision.reason} ${decision.detail}`),
  );

  if (maxTokens <= 0 || usedTokens > maxTokens || blockingDecision) {
    return {
      status: "needsAttention",
      label: "Context needs attention",
      detail: "The story context cannot fit safely within the current limit.",
      usedTokens,
      maxTokens,
      ratio,
    };
  }

  if (omittedForBudget) {
    return {
      status: "omitted",
      label: "Some optional context was left out",
      detail: "The story can continue, but optional material was omitted to stay within the context limit.",
      usedTokens,
      maxTokens,
      ratio,
    };
  }

  if (ratio >= contextNearLimitRatio) {
    return {
      status: "nearLimit",
      label: "Context is near its limit",
      detail: "The current story context fits, with little room remaining.",
      usedTokens,
      maxTokens,
      ratio,
    };
  }

  return {
    status: "healthy",
    label: "Context is healthy",
    detail: "The current story context fits without budget-related omissions.",
    usedTokens,
    maxTokens,
    ratio,
  };
}
