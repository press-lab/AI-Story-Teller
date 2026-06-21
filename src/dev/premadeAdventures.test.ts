import { describe, expect, it } from "vitest";
import { importAdventureJson } from "../utils/json";
import { premadeAdventures } from "./premadeAdventures";

describe("premade adventure library", () => {
  it("includes the bundled playtest seeds", () => {
    expect(premadeAdventures.map((premade) => premade.id)).toEqual([
      "dragon-throne",
      "dispatch-sdn",
      "crucible-protocol",
    ]);
  });

  it("loads Crucible Protocol with a current-state Plot Essentials block", () => {
    const crucible = premadeAdventures.find((premade) => premade.id === "crucible-protocol")!;
    const adventure = crucible.createAdventure();
    const pe = adventure.components.find((component) => component.type === "plotEssentials")?.content ?? "";

    expect(adventure.title).toBe("Crucible Protocol");
    expect(adventure.openingScene).toContain("HELLO, CRUCIBLE");
    expect(adventure.storyCards).toHaveLength(18);
    expect(pe).toContain("has just entered the Superhero Dispatch Network");
    expect(pe).toContain("Nix is Seth's primary romance");
    expect(pe).not.toContain("Original to this story");
    expect(adventure.storyCards.find((card) => card.title === "Blonde Blazer (Mandy)")?.content).toContain(
      "real, complicating romantic pressure",
    );
  });

  it("exports each premade as re-importable adventure JSON", () => {
    for (const premade of premadeAdventures) {
      const imported = importAdventureJson(premade.createAdventureJson());
      expect(imported.title).toBe(premade.createAdventure().title);
      expect(imported.storyCards.length).toBeGreaterThan(0);
      expect(imported.components.length).toBeGreaterThan(0);
    }
  });
});
