import { describe, expect, it } from "vitest";
import { importAdventureJson } from "../utils/json";
import { getAdventureThumbnail } from "../utils/adventureImages";
import { premadeAdventures } from "./premadeAdventures";

describe("premade adventure library", () => {
  it("includes the bundled playtest seeds", () => {
    expect(premadeAdventures.map((premade) => premade.id)).toEqual([
      "dispatch-sdn",
      "rookery",
      "arcane-after-rocket",
    ]);
  });

  it("does not mirror the opening scene as the first transcript message", () => {
    for (const premade of premadeAdventures) {
      const adventure = premade.createAdventure();
      const firstMessage = adventure.messages[0];
      expect(firstMessage?.role === "assistant" && firstMessage.content.trim() === adventure.openingScene.trim()).toBe(false);
    }
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
    expect(adventure.storyCards.find((card) => card.title === "Avery's Absorption")?.memoryMode).toBe("static");
    expect(livingCards.map((card) => card.title)).toEqual([
      "Avery's Rookery Standing",
      "Rookery Romance Pressure",
      "Tamsin's Investigation",
    ]);
    expect(livingCards.every((card) => card.autoUpdate)).toBe(true);
    expect(pe).toContain("The current opening is Hollis offering Avery one provisional courier-extraction contract");
    expect(pe.split("\n")).toHaveLength(6);
    expect(pe).not.toContain("electricity, light, radiation");
    expect(adventure.storyCards.find((card) => card.title === "Hollis Pike")?.keys).not.toContain("bartender");
    expect(adventure.storyCards.find((card) => card.title === "Powered Mercenary Network")?.keys).not.toContain("contract work");
    const serialized = JSON.stringify(adventure);
    expect(serialized).toContain("Nix Calder");
    expect(adventure.openingScene).toContain("Nix handles locks and hardware");
    expect(serialized).not.toContain("Nyx");
    expect(serialized).not.toContain("Nyxa");
  });

  it("loads Arcane After the Rocket with tight Plot Essentials and character cards", () => {
    const arcane = premadeAdventures.find((premade) => premade.id === "arcane-after-rocket")!;
    const adventure = arcane.createAdventure();
    const pe = adventure.components.find((component) => component.type === "plotEssentials")?.content ?? "";
    const currentArc = adventure.components.find((component) => component.type === "currentArc")?.content ?? "";
    const mel = adventure.storyCards.find((card) => card.title === "Mel Medarda");
    const averyMagic = adventure.storyCards.find((card) => card.title === "Avery's Magic");
    const brainNames = adventure.brains.map((brain) => brain.characterName);
    const thumbnail = getAdventureThumbnail(adventure);

    expect(adventure.title).toBe("Arcane: After the Rocket");
    expect(thumbnail?.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(thumbnail?.name).toBe("arcane-after-rocket-cover.jpg");
    expect(thumbnail?.altText).toBe("Shattered Piltover Council chamber after Jinx's rocket");
    expect(adventure.openingScene).toContain("The Council chamber is still burning");
    expect(adventure.openingScene).toContain("Jayce is alive");
    expect(adventure.openingScene).toContain("Mel is alive");
    expect(adventure.openingScene).toContain("Viktor did not get that miracle");
    expect(adventure.openingScene).toContain("Cassandra Kiramman is dead");
    expect(adventure.openingScene).toContain("Torman Hoskel is dead");
    expect(adventure.openingScene).not.toContain("Mel is half-buried");
    expect(adventure.openingScene).not.toContain("Caitlyn Kiramman comes in");
    expect(pe.split("\n")).toHaveLength(6);
    expect(pe).toContain("seconds after Jinx's rocket strikes");
    expect(pe).toContain("Irius Bolbok");
    expect(pe).toContain("Salo crippled");
    expect(pe).not.toContain("leaderless");
    expect(currentArc).toContain("Mel opposes Hextech weaponry");
    expect(currentArc).not.toContain("surviving city leadership wants blood");
    expect(pe).not.toContain("VOICE CONTRACT");
    expect(averyMagic?.content).toContain("basic physical wards are always up");
    expect(mel?.content).toContain("No romance with Avery");
    expect(mel?.content).toContain("Jayce's patron and romantic partner");
    expect(mel?.content).toContain("opposes using Hextech weaponry");
    expect(mel?.content).toContain("VOICE CONTRACT");
    expect(adventure.storyCards.find((card) => card.title === "Loaded Season One History")?.memoryMode).toBe("historical");
    expect(brainNames).toContain("Vi");
    expect(brainNames).not.toContain("Ambessa Medarda");
  });
});
