import type { ComponentType, ProviderConfig, StoryCardType } from "../types/adventure";
import { isNativeDeepSeekProvider, sendOpenAICompatibleChatCompletion } from "../providers/openAICompatible";

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

const generatedComponentTypes = new Set<ComponentType>([
  "aiInstructions",
  "plotEssentials",
  "activePressure",
  "immediateMomentum",
  "authorNote",
  "custom",
]);
const storyCardTypes = new Set<StoryCardType>(["character", "location", "lore", "plot", "custom"]);

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
      "type": "aiInstructions | plotEssentials | activePressure | immediateMomentum | authorNote | custom",
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
- Always include one "plotEssentials" component containing only permanent world truths, the player's durable role or condition, and canon constraints that must shape every scene. Use tight bullet points and keep it under 120 words. Do not put temporary danger, current location, or the next action here.
- Include one "activePressure" component for the immediate external threat, obligation, deadline, or unresolved problem driving the opening. Keep it to 1-3 concise bullets.
- Include one "immediateMomentum" component for the concrete action, confrontation, discovery, or decision directly ahead when the opening scene ends. Keep it to 1-2 concise bullets.
- Add "aiInstructions" only for scenario-specific generation constraints or drift prevention that are not general narration mechanics.
- Add "authorNote" only for concise tone, mood, pacing, or prose influence.
- Add a "custom" component only for broad world context that is relevant every turn. If it matters only when a character, place, faction, object, or secret appears, use a Story Card instead.
- Do NOT include narrationRules — those are managed separately.

Story card guidelines:
- Create cards for recurring named characters, significant recurring locations, factions, and key lore items introduced by the premise or opening scene.
- Do not create cards for current scene position, temporary mission status, one-off scenery, or throwaway objects. Put immediate danger in activePressure and the next concrete beat in immediateMomentum.
- keys array: all names, nicknames, and aliases the card should trigger on — lowercase preferred.
- Aim for 4–12 cards depending on the complexity of the premise. Quality over quantity.
- Each card's content should be self-contained reference material the AI will use mid-story.
- Location, faction, and lore cards: 3–6 bullet facts. Present tense. What the AI needs to know to write it correctly.
- Character cards MUST include a VOICE CONTRACT section. This is the single most important part of the card — it tells the AI how the character sounds, not just who they are. Use this exact structure:

[brief 1–2 sentence description of who they are and their role]

VOICE CONTRACT
Rhythm: [sentence length and pacing — e.g. "Short declaratives. Never explains herself." or "Long enthusiastic tangents that land on something surprisingly accurate."]
Default move: [what they do first when speaking or entering a scene — their instinctive social action]
Emotional defense: [how they protect vulnerability — deflection, humor, aggression, pivot to task, silence]
Never sounds like: [specific behaviors the AI must not give this character — be concrete: "warm", "offering choices", "saying I feel..."]
Example lines: "[a line in their actual voice]" / "[another line]" / "[a third line]"

The example lines carry the most weight. Write them as the character would actually say them in the story.`;

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
    ...(isNativeDeepSeekProvider(config)
      ? { responseFormat: "json_object" as const, thinking: "disabled" as const }
      : {}),
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
  return (
    typeof obj.title === "string"
    && typeof obj.type === "string"
    && generatedComponentTypes.has(obj.type as ComponentType)
    && typeof obj.content === "string"
    && (obj.alwaysOn === undefined || typeof obj.alwaysOn === "boolean")
    && (obj.pinned === undefined || typeof obj.pinned === "boolean")
    && (obj.priority === undefined || typeof obj.priority === "number")
  );
}

function isValidCard(c: unknown): c is GenStoryCard {
  if (!c || typeof c !== "object") return false;
  const obj = c as Record<string, unknown>;
  return (
    typeof obj.title === "string"
    && typeof obj.type === "string"
    && storyCardTypes.has(obj.type as StoryCardType)
    && typeof obj.content === "string"
    && (obj.keys === undefined || (Array.isArray(obj.keys) && obj.keys.every((key) => typeof key === "string")))
    && (obj.pinned === undefined || typeof obj.pinned === "boolean")
    && (obj.priority === undefined || typeof obj.priority === "number")
  );
}
