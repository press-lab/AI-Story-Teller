import { describe, expect, it } from "vitest";
import { buildContext } from "../contextBuilder/contextBuilder";
import { parseAidStoryCards } from "../importers/aidCardParser";
import { importAdventureJson } from "../utils/json";
import {
  createDevelopmentAdventure,
  createDevelopmentAdventureJson,
  createDevelopmentStoryCardsJson,
  developmentAdventureTitle,
} from "./developmentAdventure";

describe("development adventure seed", () => {
  it("creates a complete playtest adventure without provider secrets", () => {
    const adventure = createDevelopmentAdventure();

    expect(adventure.title).toBe(developmentAdventureTitle);
    expect(adventure.modelConfig.apiKey).toBeUndefined();
    expect(adventure.components.length).toBeGreaterThanOrEqual(5);
    expect(adventure.storyCards).toHaveLength(11);
    expect(adventure.brains).toHaveLength(5);
    expect(adventure.triggerRules).toHaveLength(4);
    expect(adventure.quests).toHaveLength(1);
    expect(adventure.messages).toHaveLength(1);
    expect(adventure.components.find((component) => component.title === "Adult AU Safety and Tone")?.content).toContain(
      "21 or older",
    );
    expect(adventure.quests[0].status).toBe("active");
    expect(adventure.quests[0].currentStepId).toBe("dev-step-war-room-briefing");
  });

  it("builds inspectable context with triggered cards, brains, quest state, and summary", () => {
    const adventure = createDevelopmentAdventure();
    const result = buildContext(adventure, {
      currentInput: "Setu studies Azula and Nyx before answering the mission briefing.",
      latestModelOutput: adventure.messages[0].content,
    });

    const sectionIds = result.sections.map((section) => section.id);
    expect(sectionIds).toEqual([
      "system",
      "aiInstructions",
      "plotEssentials",
      "authorNote",
      "components",
      "storyCards",
      "brains",
      "questState",
      "rollingSummary",
      "nextTurnNote",
      "recentMessages",
    ]);

    const storyCardIds = result.sections.find((section) => section.id === "storyCards")?.items.map((item) => item.id) ?? [];
    expect(storyCardIds).toContain("dev-card-setu-renzan");
    expect(storyCardIds).toContain("dev-card-azula");
    expect(storyCardIds).toContain("dev-card-nyx");

    const brainIds = result.sections.find((section) => section.id === "brains")?.items.map((item) => item.id) ?? [];
    expect(brainIds).toContain("dev-brain-setu");
    expect(brainIds).toContain("dev-brain-azula");
    expect(brainIds).toContain("dev-brain-nyx");

    expect(result.messages[0].content).toContain("# B. AI Instructions");
    expect(result.messages[0].content).toContain("# C. Plot Essentials");
    expect(result.messages[0].content).toContain("# F. Story Cards");
    expect(result.messages[0].content).toContain("Opening Arc: Ashes Under the Crown");
  });

  it("exports re-importable full adventure JSON and Story Card JSON", () => {
    const imported = importAdventureJson(createDevelopmentAdventureJson());
    expect(imported.title).toBe(developmentAdventureTitle);
    expect(imported.storyCards).toHaveLength(11);
    expect(imported.brains).toHaveLength(5);

    const parsedCards = parseAidStoryCards(createDevelopmentStoryCardsJson());
    expect(parsedCards.error).toBeUndefined();
    expect(parsedCards.cards).toHaveLength(11);
    expect(parsedCards.cards.map((card) => card.storyCard.title)).toContain("Setu Renzan");
    expect(parsedCards.cards.map((card) => card.storyCard.title)).toContain("Political Betrothal Pressure");
  });
});
