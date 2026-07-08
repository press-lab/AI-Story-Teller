import { describe, expect, it } from "vitest";
import { makeStoryCard } from "../state/defaults";
import { applyGuardedStoryCardPolicy, storyCardContextContent } from "./storyCardPolicy";

describe("storyCardContextContent", () => {
  it("does not auto-pin guarded compact reference cards", () => {
    const card = makeStoryCard({
      title: "Avery's Pact",
      content: "Avery and Jinx have a secret pact.",
      memoryMode: "living",
      pinned: false,
    });

    const guarded = applyGuardedStoryCardPolicy(card);

    expect(guarded.compactKind).toBe("pact");
    expect(guarded.pinned).toBe(false);
    expect(guarded.priority).toBeGreaterThanOrEqual(80);
  });

  it("renders condensed raw content when compact structured facts are cleared", () => {
    const card = makeStoryCard({
      title: "Avery's Pact",
      content: "Condensed pact context.",
      compactKind: "pact",
      compactStatus: "active",
      coreFacts: [],
      currentFacts: [],
      recentDevelopments: [],
    });

    expect(storyCardContextContent(card)).toBe("Condensed pact context.");
  });
});
