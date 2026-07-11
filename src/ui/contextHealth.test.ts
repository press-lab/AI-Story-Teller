import { describe, expect, it } from "vitest";
import type { ContextBuildResult } from "../types/adventure";
import { classifyContextHealth } from "./contextHealth";

function result(patch: Partial<ContextBuildResult> = {}): ContextBuildResult {
  return {
    messages: [],
    sections: [],
    totalEstimatedTokens: 200,
    excludedItems: [],
    decisions: [],
    triggeredThreadIds: [],
    pendingProposals: [],
    ...patch,
  };
}

describe("classifyContextHealth", () => {
  it("reports healthy context below the threshold", () => {
    expect(classifyContextHealth(result(), 1_000).status).toBe("healthy");
  });

  it("reports a valid payload near its limit", () => {
    expect(classifyContextHealth(result({ totalEstimatedTokens: 850 }), 1_000).status).toBe("nearLimit");
  });

  it("prioritizes budget omissions over the ratio", () => {
    expect(classifyContextHealth(result({
      excludedItems: [{
        id: "card-1",
        sourceType: "storyCard",
        title: "Optional lore",
        reason: "budget_exceeded",
      }],
    }), 1_000).status).toBe("omitted");
  });

  it("reports a blocking context that exceeds its limit", () => {
    expect(classifyContextHealth(result({ totalEstimatedTokens: 1_001 }), 1_000).status).toBe("needsAttention");
  });
});
