import type { Adventure } from "../types/adventure";
import { buildContext } from "../contextBuilder/contextBuilder";
import { normalizeAdventure } from "../state/defaults";
import { sanitizeStoryCardTriggers } from "../memory/resolveMemoryTarget";
import { latestAssistantOutput } from "../state/turnPipeline";
import {
  createDispatchAdventure,
  dispatchAdventureTitle,
} from "./dispatchAdventure";
import {
  createRookeryAdventure,
  rookeryAdventureTitle,
} from "./rookeryAdventure";
import {
  arcaneAfterRocketAdventureTitle,
  createArcaneAfterRocketAdventure,
} from "./arcaneAfterRocketAdventure";

export type PremadeAdventureId = "dispatch-sdn" | "rookery" | "arcane-after-rocket";

export interface PremadeAdventureDefinition {
  id: PremadeAdventureId;
  title: string;
  eyebrow: string;
  summary: string;
  tags: string[];
  createAdventure: () => Adventure;
  createAdventureJson: () => string;
  createStoryCardsJson: () => string;
}

const premadeComponentContent: Record<string, string> = {
  "disp-component-ai-instructions": `SETTING
- Use the modern SDN superhero-dispatch world established in this adventure: corporate hero management, field teams, villains, PR, legal pressure, and mission fallout.
- The recurring home base is SDN life: briefings, missions, debriefs, training, labs, downtime, and workplace chaos. Keep the default tone light, witty, and sarcastic until stakes earn seriousness.
- Do not import outside facts unless the adventure context establishes them.

PLAYER POWER
- Avery/Titan is intentionally overpowered; Absolute Adaptation means survival is not the question. Years of deliberate exposure (pain, suffocation, starvation, radiation, chemicals) have left almost nothing that can touch him.
- The one opening: a genuinely novel threat he has never met can hurt him once before he adapts and becomes permanently immune. Use it sparingly for real physical tension, never the same trick twice.
- Stakes land through teammates, civilians, optics, collateral, hard choices, and Shroud's manipulation, not through quietly nerfing Avery.
- NPCs may respect, fear, court, test, or exploit him, but they should not worship him, fear-spiral, or become simply stronger to win a scene. Let impressive actions earn practical reactions: respect, rivalry, attraction, annoyance, tactical adjustment, or a quick "damn."

STORY BEHAVIOR
- Keep Z-Team's messy social ecosystem active: mission, fallout, banter, rivalry, flirtation, training, next job.
- Generate missions only when scenes need forward motion; favor jobs tied to Nix's tech, the Red Ring, Shroud, prior experiments, tech thefts, traps, surveillance, or named Red Ring threats over random assignment-of-the-day problems.
- Keep Shroud and Red Ring pressure recurring through probes, traps, aftermath clues, and targeted pressure instead of constant monologues.

ROMANCE
- The romantic tangle is central and unresolved. Nix is Avery's primary romantic and emotional focus right now; Blazer and Visi remain real romantic pressure but are pulled into the background more often by SDN duties.
- Let romance emerge through action, banter, rivalry, competence, jealousy, and private moments. No instant worship, forced commitment, or confession spam. Do not pick one for Avery. Malevola flirts as theater, not as part of the core tangle.

CHARACTERS
- Honor each NPC's Story Card and VOICE CONTRACT.
- Use codenames/handles in group, workplace, and mission scenes (Blazer, Track Star, Visi, Flambae, Nix, Malevola, Waterboy, Sightline, Punch Up, Phenomaman, Breach); use civilian names only in private, intimate, serious, unmasked, or old-friend contexts, and never mash a civilian name and codename together.
- Let NPCs pressure, tempt, provoke, flirt, command, lie, test, and react; never resolve Avery's decisions for him.

PROSE
- Write in second person, present tense.
- Favor action, dialogue, sensory detail, and distinct voices over summary or exposition.
- End on a concrete beat Avery can answer, not a menu or "what do you do?" prompt.`,

  "disp-component-plot-essentials": `- Avery Prest, codename Titan, is an SDN Z-Team hero whose Absolute Adaptation makes him effectively unkillable and permanently resistant to repeated threats; only a genuinely novel threat can hurt him once before he adapts to that too.
- The current opening is SDN's conference room: after a failed solo fight against Shroud cost Avery his standing, Blonde Blazer offers him supervised SDN work on Z-Team while both teams size him up.
- SDN is a corporate hero-dispatch agency built around missions, oversight, PR, discipline, legal cover, and workplace chaos; Track Star dispatches both Z-Team and X-Team.
- Z-Team is Avery's messy recurring social habitat: Nix, Visi, Malevola, Flambae, and Track Star generate banter, rivalry, flirtation, training, and mission fallout.
- The romantic tangle around Avery is central and unresolved — Nix is the current emotional focus, with Blazer and Visi as real but more background pressure; keep jealousy sharp without collapsing it into one pairing.
- The active arc is Shroud and the Red Ring moving again after Avery's failed fight; Shroud killed Avery's father, the Red Ring's probes bend toward Nix's tech, and Nix's estranged older sister Breach is on the rival X-Team.`,

};

function premadeMemoryMode(card: Adventure["storyCards"][number]): Adventure["storyCards"][number]["memoryMode"] {
  if (card.type === "plot") return card.memoryMode === "living" ? "living" : "historical";
  if (card.memoryMode) return card.memoryMode;
  return "static";
}

function applyPremadeBestPractices(adventure: Adventure): Adventure {
  const normalized = normalizeAdventure(adventure);
  const componentOverrides = premadeComponentContent;
  const components = normalized.components.map((component) => {
    const override = componentOverrides[component.id];
    if (component.type === "plotEssentials") {
      return {
        ...component,
        content: override ?? component.content,
        autoUpdate: true,
        autoUpdateCooldownTurns: 0,
      };
    }
    if (override) return { ...component, content: override };
    return component;
  });
  const componentTuned = { ...normalized, components };
  const storyCards = normalized.storyCards.map((card) => ({
    ...card,
    memoryMode: premadeMemoryMode(card),
    matchType: card.matchType ?? "phrase",
    autoUpdate: premadeMemoryMode(card) === "living" ? true : card.autoUpdate,
    autoUpdateCooldownTurns: premadeMemoryMode(card) === "living"
      ? Math.min(card.autoUpdateCooldownTurns ?? 1, 1)
      : card.autoUpdateCooldownTurns,
    keys: sanitizeStoryCardTriggers(componentTuned, card.title, card.keys, card.id, premadeMemoryMode(card)),
  }));
  return normalizeAdventure({ ...componentTuned, storyCards });
}

function premadeAdventureJson(createAdventure: () => Adventure): string {
  return JSON.stringify(createAdventure(), null, 2);
}

function premadeStoryCardsJson(createAdventure: () => Adventure): string {
  const adventure = createAdventure();
  const cards = adventure.storyCards.map((card) => ({
    title: card.title,
    keys: card.keys.join(", "),
    entry: card.content,
    type: card.type,
    memoryMode: card.memoryMode,
  }));
  return JSON.stringify(cards, null, 2);
}

function createDispatchSdnPremadeAdventure(): Adventure {
  return applyPremadeBestPractices(createDispatchAdventure());
}

function createDispatchSdnPremadeAdventureJson(): string {
  return premadeAdventureJson(createDispatchSdnPremadeAdventure);
}

function createDispatchSdnPremadeStoryCardsJson(): string {
  return premadeStoryCardsJson(createDispatchSdnPremadeAdventure);
}

function createRookeryPremadeAdventure(): Adventure {
  return applyPremadeBestPractices(createRookeryAdventure());
}

function createRookeryPremadeAdventureJson(): string {
  return premadeAdventureJson(createRookeryPremadeAdventure);
}

function createRookeryPremadeStoryCardsJson(): string {
  return premadeStoryCardsJson(createRookeryPremadeAdventure);
}

function createArcaneAfterRocketPremadeAdventure(): Adventure {
  return applyPremadeBestPractices(createArcaneAfterRocketAdventure());
}

function createArcaneAfterRocketPremadeAdventureJson(): string {
  return premadeAdventureJson(createArcaneAfterRocketPremadeAdventure);
}

function createArcaneAfterRocketPremadeStoryCardsJson(): string {
  return premadeStoryCardsJson(createArcaneAfterRocketPremadeAdventure);
}

export const premadeAdventures: PremadeAdventureDefinition[] = [
  {
    id: "dispatch-sdn",
    title: dispatchAdventureTitle,
    eyebrow: "SDN Supers",
    summary: "Original SDN superhero dispatch playtest with Avery/Titan, Z-Team chaos, romantic tangle, and Shroud pressure.",
    tags: ["Dispatch", "superheroes", "Z-Team", "starter scenario"],
    createAdventure: createDispatchSdnPremadeAdventure,
    createAdventureJson: createDispatchSdnPremadeAdventureJson,
    createStoryCardsJson: createDispatchSdnPremadeStoryCardsJson,
  },
  {
    id: "rookery",
    title: rookeryAdventureTitle,
    eyebrow: "Powered Mercenary Drama",
    summary: "A grimy mercenary bar, rotating contract crews, Avery's provisional first job, and living trust/romance pressure.",
    tags: ["original", "mercenaries", "bar hub", "romance"],
    createAdventure: createRookeryPremadeAdventure,
    createAdventureJson: createRookeryPremadeAdventureJson,
    createStoryCardsJson: createRookeryPremadeStoryCardsJson,
  },
  {
    id: "arcane-after-rocket",
    title: arcaneAfterRocketAdventureTitle,
    eyebrow: "Arcane AU",
    summary: "Season 2 aftermath with Avery as a proven Council mage, Hextech amplifier, and survivor of Jinx's rocket.",
    tags: ["Arcane", "Piltover", "Zaun", "Hextech"],
    createAdventure: createArcaneAfterRocketPremadeAdventure,
    createAdventureJson: createArcaneAfterRocketPremadeAdventureJson,
    createStoryCardsJson: createArcaneAfterRocketPremadeStoryCardsJson,
  },
];

export function getPremadeAdventure(id: PremadeAdventureId): PremadeAdventureDefinition | undefined {
  return premadeAdventures.find((premade) => premade.id === id);
}

export function buildPremadeContext(adventure: Adventure) {
  return buildContext(adventure, { latestModelOutput: latestAssistantOutput(adventure) });
}
