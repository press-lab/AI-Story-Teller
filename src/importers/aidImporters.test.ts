import { describe, expect, it } from "vitest";
import { parseAidStoryCards } from "./aidCardParser";
import { parseAidStoryText } from "./aidStoryParser";

describe("AI Dungeon story parser", () => {
  it("parses AI Dungeon action JSON into assistant and user messages", () => {
    const result = parseAidStoryText(
      JSON.stringify({
        actions: [
          { type: "start", text: "Opening scene." },
          { type: "do", text: "\n> You raise your hand.\n" },
          { type: "continue", text: ">>> please select \"continue\" (50%) <<<" },
        ],
      }),
    );

    expect(result.sourceKind).toBe("actions-json");
    expect(result.messages).toHaveLength(2);
    expect(result.messages.map((message) => message.role)).toEqual(["assistant", "user"]);
    expect(result.messages[1].content).toBe("You raise your hand.");
    expect(result.warnings.some((warning) => warning.includes("continue marker"))).toBe(true);
  });

  it("parses marked transcript text using > lines as user messages", () => {
    const result = parseAidStoryText("The room is quiet.\n\n> You listen.\n\nA floorboard creaks.");

    expect(result.sourceKind).toBe("marked-transcript");
    expect(result.messages.map((message) => message.role)).toEqual(["assistant", "user", "assistant"]);
    expect(result.messages[0].content).toBe("The room is quiet.");
    expect(result.messages[2].content).toBe("A floorboard creaks.");
  });

  it("imports metadata as setup components and summary suggestions", () => {
    const result = parseAidStoryText(
      JSON.stringify({
        adventure: {
          title: "Ash Crown",
          memory: "The court remembers everything.",
          authorsNote: "Keep the tone political.",
        },
        state: {
          storySummary: "A tense arrival at court.",
          instructions: { custom: "Write in second person." },
        },
      }),
    );

    expect(result.sourceKind).toBe("metadata-json");
    expect(result.detectedTitle).toBe("Ash Crown");
    expect(result.rollingSummarySuggestion).toBe("A tense arrival at court.");
    expect(result.setupComponents.map((component) => component.title)).toContain("AI Dungeon Memory");
    expect(result.setupComponents.map((component) => component.title)).toContain("AI Dungeon Instructions");
  });
});

describe("AI Dungeon story card parser", () => {
  it("maps story cards and detects Inner Self brain candidates", () => {
    const result = parseAidStoryCards(
      JSON.stringify([
        {
          title: "Princess Azula",
          keys: "Azula,Princess Azula",
          value: "Blue-fire prodigy.",
          type: "character",
        },
        {
          title: "Nyx",
          keys: "{\"agent\":\"Nyx\",\"percent\":30}",
          value: "nyx.brain.setu = \"Setu surprised me.\";",
          type: "Brain",
          description: "setu: Setu surprised me.",
        },
      ]),
    );

    expect(result.error).toBeUndefined();
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].storyCard.title).toBe("Princess Azula");
    expect(result.cards[0].storyCard.keys).toEqual(["Azula", "Princess Azula"]);
    expect(result.cards[1].suggestion).toBe("brain");
    expect(result.cards[1].brainCandidate?.characterName).toBe("Nyx");
    expect(result.cards[1].brainCandidate?.source).toBe("imported");
    expect(result.cards[1].brainCandidate?.currentState).toBe("setu: Setu surprised me.");
  });
});
