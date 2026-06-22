import { describe, expect, it } from "vitest";
import { importAdventureJson } from "../utils/json";
import { premadeAdventures } from "./premadeAdventures";

describe("premade adventure library", () => {
  it("includes the bundled playtest seeds", () => {
    expect(premadeAdventures.map((premade) => premade.id)).toEqual([
      "dragon-throne",
      "dispatch-sdn",
      "crucible-protocol",
      "rookery",
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

  it("loads The Rookery with explicit living cards and tight Plot Essentials", () => {
    const rookery = premadeAdventures.find((premade) => premade.id === "rookery")!;
    const adventure = rookery.createAdventure();
    const pe = adventure.components.find((component) => component.type === "plotEssentials")?.content ?? "";
    const livingCards = adventure.storyCards.filter((card) => card.memoryMode === "living");

    expect(adventure.title).toBe("The Rookery");
    expect(adventure.openingScene).toContain("One provisional job");
    expect(adventure.storyCards.find((card) => card.title === "Seth's Absorption")?.memoryMode).toBe("static");
    expect(livingCards.map((card) => card.title)).toEqual([
      "Seth's Rookery Standing",
      "Rookery Romance Pressure",
      "Tamsin's Investigation",
    ]);
    expect(livingCards.every((card) => card.autoUpdate)).toBe(true);
    expect(pe).toContain("The current opening is Hollis offering Seth one provisional courier-extraction contract");
    expect(pe.split("\n")).toHaveLength(6);
    expect(pe).not.toContain("electricity, light, radiation");
    expect(adventure.storyCards.find((card) => card.title === "Hollis Pike")?.keys).not.toContain("bartender");
    expect(adventure.storyCards.find((card) => card.title === "Powered Mercenary Network")?.keys).not.toContain("contract work");
  });
});
