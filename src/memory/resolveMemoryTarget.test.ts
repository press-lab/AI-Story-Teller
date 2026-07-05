import { describe, expect, it } from "vitest";
import { createDefaultAdventure, makeStoryCard } from "../state/defaults";
import { resolveMemoryTarget, sanitizeStoryCardTriggers } from "./resolveMemoryTarget";

describe("resolveMemoryTarget", () => {
  it("creates a living child card instead of appending current state to a static profile", () => {
    const adventure = {
      ...createDefaultAdventure("Routing"),
      storyCards: [
        makeStoryCard({
          id: "card-Avery",
          title: "Avery Valis",
          type: "character",
          memoryMode: "static",
          content: "- Player character and Council mage.",
          keys: ["Avery"],
        }),
      ],
    };

    const routed = resolveMemoryTarget(adventure, {
      proposedType: "storyCard",
      targetId: "card-Avery",
      title: "Avery Valis",
      content: "• Avery is currently responsible for managing Viktor's notification protocol.",
      suggestedTriggers: ["Avery", "The", "Viktor protocol", "current status"],
      appendContent: true,
      memoryMode: "living",
      rationale: "Current arrangement update.",
    });

    expect(routed).toMatchObject({
      title: "Avery Valis: Current Status",
      targetId: undefined,
      appendContent: undefined,
      memoryMode: "living",
    });
    expect(routed.suggestedTriggers).toEqual(["Viktor protocol"]);
    expect(routed.rationale).toContain("separate living Story Card");
  });

  it("creates a historical child card instead of appending completed events to a static profile", () => {
    const adventure = {
      ...createDefaultAdventure("Routing"),
      storyCards: [
        makeStoryCard({
          id: "card-viktor",
          title: "Viktor",
          type: "character",
          memoryMode: "static",
          content: "- Brilliant Hextech scientist.",
          keys: ["Viktor"],
        }),
      ],
    };

    const routed = resolveMemoryTarget(adventure, {
      proposedType: "storyCard",
      targetId: "card-viktor",
      title: "Viktor",
      content: "• Viktor agreed to notify Avery before engaging points of magical distress in Zaun.",
      suggestedTriggers: ["Viktor", "notification protocol"],
      appendContent: true,
      memoryMode: "historical",
    });

    expect(routed).toMatchObject({
      title: "Viktor: History",
      targetId: undefined,
      appendContent: undefined,
      memoryMode: "historical",
    });
    expect(routed.suggestedTriggers).toEqual(["notification protocol"]);
  });

  it("keeps historical updates on matching historical cards", () => {
    const adventure = {
      ...createDefaultAdventure("Routing"),
      storyCards: [
        makeStoryCard({
          id: "card-protocol",
          title: "Viktor Protocol",
          type: "plot",
          memoryMode: "historical",
          content: "• Avery established a notification channel with Viktor.",
          keys: ["Viktor protocol"],
        }),
      ],
    };

    const routed = resolveMemoryTarget(adventure, {
      proposedType: "storyCard",
      title: "Viktor Protocol",
      content: "• Viktor later honored the protocol by signaling before acting.",
      suggestedTriggers: ["Viktor protocol", "Viktor"],
      memoryMode: "historical",
    });

    expect(routed.targetId).toBe("card-protocol");
    expect(routed.appendContent).toBe(true);
    expect(routed.memoryMode).toBe("historical");
  });

  it("routes guarded exact-title updates to the existing compact card despite memory-mode drift", () => {
    const adventure = {
      ...createDefaultAdventure("Routing"),
      storyCards: [
        makeStoryCard({
          id: "card-jinx-pact",
          title: "Avery's Pact with Jinx",
          type: "plot",
          memoryMode: "living",
          content: "- Avery and Jinx have a secret pact.",
          keys: ["Jinx pact"],
        }),
      ],
    };

    const routed = resolveMemoryTarget(adventure, {
      proposedType: "storyCard",
      title: "Avery's Pact with Jinx",
      content: "- Mel's official cover story keeps Avery on the Council as a political shield.",
      suggestedTriggers: ["official cover", "Council shield"],
      memoryMode: "historical",
    });

    expect(routed).toMatchObject({
      title: "Avery's Pact with Jinx",
      targetId: "card-jinx-pact",
      appendContent: true,
      memoryMode: "living",
    });
  });
});

describe("sanitizeStoryCardTriggers", () => {
  it("drops stopwords, pronouns, duplicate title keys, and character-name bleed for living cards", () => {
    const adventure = {
      ...createDefaultAdventure("Triggers"),
      storyCards: [
        makeStoryCard({
          id: "card-jinx",
          title: "Jinx",
          type: "character",
          content: "- Volatile inventor.",
          keys: ["Jinx", "Powder"],
        }),
      ],
    };

    expect(
      sanitizeStoryCardTriggers(
        adventure,
        "The Council Bombing",
        ["The", "This", "She", "Any", "The Council Bombing", "Jinx", "Council bombing", "closed session"],
        undefined,
        "living",
      ),
    ).toEqual(["Council bombing", "closed session"]);
  });
});
