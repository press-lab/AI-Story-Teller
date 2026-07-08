import { describe, expect, it } from "vitest";
import { parseComponentsJson } from "./componentParser";
import { parseStoryCardsJson } from "./storyCardParser";

describe("Reference Card JSON parser", () => {
  it("parses generic Reference Card JSON into Reference Card records", () => {
    const result = parseStoryCardsJson(
      JSON.stringify({
        storyCards: [
          {
            title: "Margo",
            keys: "Margo, hedge prince",
            entry: "Margo calls Avery hedge prince as a private joke.",
            type: "character",
          },
        ],
      }),
    );

    expect(result.error).toBeUndefined();
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].storyCard).toMatchObject({
      title: "Margo",
      keys: ["Margo", "hedge prince"],
      content: "Margo calls Avery hedge prince as a private joke.",
      type: "character",
    });
    expect(result.cards[0].storyCard.state).toContain("storyCardJson");
  });
});

describe("World Block JSON parser", () => {
  it("parses exported World Blocks and opening scene", () => {
    const result = parseComponentsJson(
      JSON.stringify({
        openingScene: "Rain hits the warded glass.",
        components: [
          {
            title: "Mission Loop",
            type: "custom",
            content: "Jobs create fallout; fallout creates the next job.",
            pinned: true,
          },
        ],
      }),
    );

    expect(result.error).toBeUndefined();
    expect(result.openingScene).toBe("Rain hits the warded glass.");
    expect(result.components).toHaveLength(1);
    expect(result.components[0].component).toMatchObject({
      title: "Mission Loop",
      type: "custom",
      content: "Jobs create fallout; fallout creates the next job.",
      pinned: true,
    });
  });
});
