import type { Adventure } from "../types/adventure";
import { buildContext } from "../contextBuilder/contextBuilder";
import { createDefaultAdventure, defaultSemanticEvaluationSettings, normalizeAdventure } from "../state/defaults";
import { latestAssistantOutput } from "../state/turnPipeline";
import { nowIso } from "../utils/id";
import {
  createDevelopmentAdventure,
  createDevelopmentAdventureJson,
  createDevelopmentStoryCardsJson,
  developmentAdventureTitle,
} from "./developmentAdventure";
import {
  createDispatchAdventure,
  createDispatchAdventureJson,
  createDispatchStoryCardsJson,
  dispatchAdventureTitle,
} from "./dispatchAdventure";
import crucibleComponents from "./premades/crucible-protocol-components.json";
import crucibleStoryCards from "./premades/crucible-protocol-story-cards.json";

export type PremadeAdventureId = "dragon-throne" | "dispatch-sdn" | "crucible-protocol";

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

const crucibleAdventureTitle = "Crucible Protocol";

function createCrucibleProtocolAdventure(): Adventure {
  const timestamp = nowIso();
  const base = createDefaultAdventure(crucibleAdventureTitle);
  const components = (crucibleComponents as { components: Adventure["components"]; openingScene: string }).components;
  const openingScene = (crucibleComponents as { openingScene: string }).openingScene;
  const storyCards = crucibleStoryCards as Adventure["storyCards"];
  const adventure: Adventure = {
    ...base,
    title: crucibleAdventureTitle,
    openingScene,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      premadeAdventure: true,
      scenario: "Dispatch - Crucible Protocol",
      note: "Seth/Crucible joins SDN after Harbor Grid; Z-Team, X-Team, Nix romance, and Shroud/Red Ring pressure.",
    },
    components,
    storyCards,
    rollingSummary: {
      content: "Seth Prest, codename Crucible, has entered SDN after the Harbor Grid disaster. The intake scanner attacked him and Absolute Conversion neutralized it in front of Z-Team and X-Team. Nix cracked open a Red Ring device displaying HELLO, CRUCIBLE, confirming Shroud is still watching and has engineered pressure around Seth, Nix's inventions, Waterboy's hidden scale, and the Knox-sisters fracture.",
      updatedAt: timestamp,
    },
    messages: [
      {
        id: "crucible-msg-opening",
        role: "assistant",
        content: openingScene,
        createdAt: timestamp,
      },
    ],
    activeState: {
      ...base.activeState,
      stateFlags: {
        premadeAdventure: true,
      },
    },
    semanticEvaluationSettings: {
      ...defaultSemanticEvaluationSettings,
      messagesIncluded: 8,
      enabled: true,
      showLog: true,
      maxParallelUpdateCalls: 2,
    },
    tokenBudgetSettings: {
      ...base.tokenBudgetSettings,
      maxContextTokens: 9000,
      maxRecentMessages: 18,
      recentMessageWindow: 8,
    },
  };
  return normalizeAdventure(adventure);
}

function createCrucibleProtocolAdventureJson(): string {
  return JSON.stringify(createCrucibleProtocolAdventure(), null, 2);
}

function createCrucibleProtocolStoryCardsJson(): string {
  const adventure = createCrucibleProtocolAdventure();
  const cards = adventure.storyCards.map((card) => ({
    title: card.title,
    keys: card.keys.join(", "),
    entry: card.content,
    type: card.type,
  }));
  return JSON.stringify(cards, null, 2);
}

export const premadeAdventures: PremadeAdventureDefinition[] = [
  {
    id: "dragon-throne",
    title: developmentAdventureTitle,
    eyebrow: "Avatar AU",
    summary: "Adult Fire Nation palace missions, Setu/Nyxa chemistry, New Ozai conspiracy, and a configured Arc Director.",
    tags: ["ATLA", "court", "romance", "slow-burn arc"],
    createAdventure: createDevelopmentAdventure,
    createAdventureJson: createDevelopmentAdventureJson,
    createStoryCardsJson: createDevelopmentStoryCardsJson,
  },
  {
    id: "dispatch-sdn",
    title: dispatchAdventureTitle,
    eyebrow: "SDN Supers",
    summary: "Original SDN superhero dispatch playtest with Seth/Titan, Z-Team chaos, romantic tangle, and Shroud pressure.",
    tags: ["Dispatch", "superheroes", "Z-Team", "dev seed"],
    createAdventure: createDispatchAdventure,
    createAdventureJson: createDispatchAdventureJson,
    createStoryCardsJson: createDispatchStoryCardsJson,
  },
  {
    id: "crucible-protocol",
    title: crucibleAdventureTitle,
    eyebrow: "Dispatch",
    summary: "Seth/Crucible enters SDN after Harbor Grid; Nix cracks Shroud's HELLO, CRUCIBLE device as Z-Team and X-Team collide.",
    tags: ["Dispatch", "Crucible", "Nix", "Red Ring"],
    createAdventure: createCrucibleProtocolAdventure,
    createAdventureJson: createCrucibleProtocolAdventureJson,
    createStoryCardsJson: createCrucibleProtocolStoryCardsJson,
  },
];

export function getPremadeAdventure(id: PremadeAdventureId): PremadeAdventureDefinition | undefined {
  return premadeAdventures.find((premade) => premade.id === id);
}

export function buildPremadeContext(adventure: Adventure) {
  return buildContext(adventure, { latestModelOutput: latestAssistantOutput(adventure) });
}
