import type { ComponentType, ProviderConfig, StoryCardType } from "../types/adventure";
import { sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";

export interface GenComponent {
  title: string;
  type: ComponentType;
  content: string;
  alwaysOn: boolean;
  pinned: boolean;
  priority: number;
}

export interface GenStoryCard {
  title: string;
  type: StoryCardType;
  keys: string[];
  content: string;
  pinned: boolean;
  priority: number;
}

export interface AdventureGenResult {
  title: string;
  openingScene: string;
  components: GenComponent[];
  storyCards: GenStoryCard[];
}

function parseJsonFenced<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  return JSON.parse(fenced ?? trimmed) as T;
}

const SYSTEM_PROMPT = `You are an expert interactive fiction game master and world builder. Given a premise, generate a complete starter setup for an AI-powered text adventure.

Output ONLY valid JSON matching this schema exactly:
{
  "title": "string — evocative adventure name",
  "openingScene": "string — 2-4 paragraphs setting the scene and immediately immersing the player",
  "components": [
    {
      "title": "string",
      "type": "plotEssentials | custom",
      "content": "string",
      "alwaysOn": true,
      "pinned": true,
      "priority": 80
    }
  ],
  "storyCards": [
    {
      "title": "string",
      "type": "character | location | lore | plot | custom",
      "keys": ["trigger1", "trigger2"],
      "content": "string — rich lore, facts, personality, or description; 2-6 sentences",
      "pinned": false,
      "priority": 0
    }
  ]
}

Component guidelines:
- Always include one "plotEssentials" component summarising the core premise, stakes, and player role. Keep it under 200 words.
- Add a "custom" component for world-specific rules, tone, or genre conventions if the premise warrants it.
- Do NOT include narrationRules or aiInstructions — those are managed separately.

Story card guidelines:
- Create cards for every named character, significant location, faction, and key lore item that the opening scene or premise introduces.
- keys array: all names, nicknames, and aliases the card should trigger on — lowercase preferred.
- Aim for 4–12 cards depending on the complexity of the premise. Quality over quantity.
- Each card's content should be self-contained reference material the AI will use mid-story.`;

export async function runAdventureGen(
  premise: string,
  config: ProviderConfig,
): Promise<AdventureGenResult> {
  const response = await sendOpenAICompatibleChatCompletion({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Premise:\n${premise.trim()}` },
    ],
    config,
  });

  const raw = parseJsonFenced<Partial<AdventureGenResult>>(response.content);

  return {
    title: typeof raw.title === "string" ? raw.title : "New Adventure",
    openingScene: typeof raw.openingScene === "string" ? raw.openingScene : "",
    components: Array.isArray(raw.components) ? raw.components.filter(isValidComponent) : [],
    storyCards: Array.isArray(raw.storyCards) ? raw.storyCards.filter(isValidCard) : [],
  };
}

function isValidComponent(c: unknown): c is GenComponent {
  if (!c || typeof c !== "object") return false;
  const obj = c as Record<string, unknown>;
  return typeof obj.title === "string" && typeof obj.type === "string" && typeof obj.content === "string";
}

function isValidCard(c: unknown): c is GenStoryCard {
  if (!c || typeof c !== "object") return false;
  const obj = c as Record<string, unknown>;
  return typeof obj.title === "string" && typeof obj.type === "string" && typeof obj.content === "string";
}
