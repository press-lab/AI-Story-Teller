import { describe, expect, it } from "vitest";
import { createDefaultAdventure, makeStoryCard, normalizeAdventure } from "./defaults";

describe("normalizeAdventure", () => {
  it("rehydrates guarded archived story-card facts once when loading old saves", () => {
    const adventure = {
      ...createDefaultAdventure("Guarded Save"),
      activeState: {
        ...createDefaultAdventure("Guarded Save").activeState,
        stateFlags: {},
      },
      storyCards: [
        makeStoryCard({
          id: "card-jinx-pact",
          title: "Avery's Pact with Jinx",
          memoryMode: "living",
          content: "- Jinx is repairing the Sump air filter with Avery's arcane help.",
          archivedFacts: "- Avery and Jinx have a secret pact: Jinx stops killing except in self-protection.\n- Mel's official cover story keeps Avery on the Council as a political shield.",
          keys: ["Jinx pact"],
        }),
      ],
    };

    const normalized = normalizeAdventure(adventure);
    const card = normalized.storyCards.find((entry) => entry.id === "card-jinx-pact");

    expect(normalized.activeState.stateFlags.compactStoryCardsMigrated).toBe(true);
    expect(card?.compactKind).toBe("coverStory");
    expect(card?.coreFacts?.join("\n")).toContain("secret pact");
    expect(card?.coreFacts?.join("\n")).toContain("official cover story");
    expect([...(card?.currentFacts ?? []), ...(card?.recentDevelopments ?? [])].join("\n")).toContain("Sump air filter");
    expect(card?.pinned).toBe(true);
    expect(card?.protected).toBe(false);
  });
});
