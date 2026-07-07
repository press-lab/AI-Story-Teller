import type { ChatMessage } from "../types/adventure";

const PLAYER_ACTION_VERBS = [
  "accept",
  "agree",
  "answer",
  "arrive",
  "ask",
  "board",
  "decide",
  "depart",
  "disembark",
  "dock",
  "draw",
  "enter",
  "exit",
  "feel",
  "fly",
  "follow",
  "go",
  "glance",
  "grab",
  "head",
  "let",
  "leave",
  "look",
  "make",
  "move",
  "nod",
  "pivot",
  "press",
  "promise",
  "pull",
  "push",
  "reach",
  "return",
  "ride",
  "run",
  "sail",
  "refuse",
  "say",
  "shake",
  "step",
  "take",
  "tell",
  "think",
  "travel",
  "turn",
  "walk",
];

const PLAYER_ACTION_RE_GLOBAL = new RegExp(`\\byou\\s+(?:${PLAYER_ACTION_VERBS.join("|")})\\b`, "gi");
const PLAYER_AUTHORED_ACTION_RE_GLOBAL = new RegExp(`\\b(?:i|we)\\s+(?:${PLAYER_ACTION_VERBS.join("|")})\\b`, "gi");
const PLAYER_TRANSITION_ACTION_PHRASES = new Set([
  "you arrive",
  "you board",
  "you depart",
  "you disembark",
  "you dock",
  "you enter",
  "you exit",
  "you fly",
  "you go",
  "you head",
  "you leave",
  "you reach",
  "you return",
  "you ride",
  "you run",
  "you sail",
  "you travel",
  "you walk",
]);

const EXPLICIT_TRANSITION_RE_LIST = [
  /\b(?:i|we)\s+(?:go|head|travel|leave|depart|sail|ride|fly|walk|run|return|continue)\s+(?:to|for|toward|towards|into|onto|back to)\b/i,
  /\b(?:i|we)\s+(?:board|enter|exit|leave|depart|arrive)\b/i,
  /\b(?:i|we)\s+follow\b[^.?!\n]*(?:\bto\b|\binto\b|\bonto\b|\bthrough\b|\bacross\b|\baboard\b)/i,
  /\b(?:take|bring)\s+(?:me|us)\s+to\b/i,
  /\blet'?s\s+(?:go|head|leave|move|travel|sail|ride|fly)\b/i,
];

const SCENE_JUMP_RE_LIST = [
  /\b(?:an?\s+)?(?:hour|hours|day|days|week|weeks)\s+later\b/i,
  /\b(?:the\s+next\s+morning|that\s+evening|at\s+dawn|at\s+dusk|by\s+nightfall)\b/i,
  /\bby\s+the\s+time\s+you\b/i,
  /\bafter\s+(?:a|the)\s+(?:journey|voyage|ride|flight|march|trip|crossing)\b/i,
  /\bthe\s+(?:ship|boat|carriage|train|convoy|unit|team)\s+(?:arrives|reaches|lands|docks)\b/i,
  /\byou\s+(?:arrive|reach|board|disembark|land|dock|leave|depart|enter|exit)\b/i,
  /\bthe\s+scene\s+(?:cuts|shifts|moves)\b/i,
];

export interface StoryResponseGuardResult {
  visibleWordCount: number;
  visibleWordLimit: number;
  overWordLimit: boolean;
  playerAgencyViolation: boolean;
  sceneJumpViolation: boolean;
  needsCorrection: boolean;
  reasons: string[];
}

export function storyResponseWordLimit(hint: number): number {
  return Number.isFinite(hint) ? Math.max(50, Math.min(500, Math.round(hint))) : 250;
}

function stripHiddenTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought[^>]*>[\s\S]*?<\/thought>/gi, "")
    .replace(/<memory\b[^>]*>/gi, "")
    .replace(/<thought[\s\S]*$/gi, "")
    .replace(/<memory\b[\s\S]*$/gi, "");
}

function stripQuotedText(text: string): string {
  return text
    .replace(/"[^"]*"/g, "")
    .replace(/'[^']*'/g, "");
}

export function visibleWordCount(text: string): number {
  const visible = stripHiddenTags(text);
  return visible.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g)?.length ?? 0;
}

function playerActionPhrases(text: string): string[] {
  const stripped = stripQuotedText(stripHiddenTags(text));
  return [...stripped.matchAll(PLAYER_ACTION_RE_GLOBAL)].map((match) => match[0].toLowerCase());
}

function playerAuthoredActionPhrases(text: string): string[] {
  const stripped = stripQuotedText(stripHiddenTags(text));
  const secondPerson = playerActionPhrases(stripped);
  const firstPerson = [...stripped.matchAll(PLAYER_AUTHORED_ACTION_RE_GLOBAL)].map((match) => {
    const words = match[0].toLowerCase().split(/\s+/);
    return `you ${words[1]}`;
  });
  return [...secondPerson, ...firstPerson];
}

export function hasPlayerAgencyViolation(text: string, playerInput = ""): boolean {
  const playerAuthoredActions = new Set(playerAuthoredActionPhrases(playerInput));
  const transitionAuthorized = playerAuthorizedSceneTransition(playerInput);
  return playerActionPhrases(text).some((phrase) => {
    if (playerAuthoredActions.has(phrase)) return false;
    return !(transitionAuthorized && PLAYER_TRANSITION_ACTION_PHRASES.has(phrase));
  });
}

function playerAuthorizedSceneTransition(playerInput: string): boolean {
  const stripped = stripQuotedText(stripHiddenTags(playerInput));
  return EXPLICIT_TRANSITION_RE_LIST.some((pattern) => pattern.test(stripped));
}

export function hasSceneJumpViolation(text: string, playerInput = ""): boolean {
  if (playerAuthorizedSceneTransition(playerInput)) return false;
  const stripped = stripQuotedText(stripHiddenTags(text));
  return SCENE_JUMP_RE_LIST.some((pattern) => pattern.test(stripped));
}

export function evaluateStoryResponseGuard(text: string, hint: number, playerInput = ""): StoryResponseGuardResult {
  const visibleWordLimit = storyResponseWordLimit(hint);
  const visibleWords = visibleWordCount(text);
  const overWordLimit = visibleWords > visibleWordLimit;
  const playerAgencyViolation = hasPlayerAgencyViolation(text, playerInput);
  const sceneJumpViolation = hasSceneJumpViolation(text, playerInput);
  const reasons = [
    overWordLimit ? `visible response is ${visibleWords} words over the ${visibleWordLimit}-word limit` : undefined,
    playerAgencyViolation ? "response appears to narrate unspoken player action" : undefined,
    sceneJumpViolation ? "response appears to skip travel, time, or scene boundaries the player did not authorize" : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    visibleWordCount: visibleWords,
    visibleWordLimit,
    overWordLimit,
    playerAgencyViolation,
    sceneJumpViolation,
    needsCorrection: reasons.length > 0,
    reasons,
  };
}

export function buildStoryResponseCorrectionMessages({
  playerInput,
  draft,
  wordLimit,
  reasons,
}: {
  playerInput: string;
  draft: string;
  wordLimit: number;
  reasons: string[];
}): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        `You are a strict rewrite pass for AI Story Teller. Return only the corrected visible story response.\n` +
        `Hard limit: ${wordLimit} words maximum.\n` +
        `Fix these violations: ${reasons.join("; ") || "turn scope"}.\n` +
        `Do not add new events, new plans, new locations, or extra consequences. Preserve only the earliest playable beat from the draft.\n` +
        `Do not narrate the player's unspoken actions, reactions, dialogue, consent, movement, decisions, acceptance, or internal conclusions.\n` +
        `Do not skip through travel, time, scene transitions, mission departure, arrival, or completion unless the player explicitly requested that transition.\n` +
        `If the player only said they follow someone, keep the movement local and immediate; do not turn it into a trip, arrival, or completed mission.\n` +
        `NPCs and the world may react. Stop as soon as the player can reasonably answer, interrupt, refuse, choose, or redirect.\n` +
        `Do not include OOC commentary, explanations, word counts, option menus, <thought> tags, or <memory> tags.`,
    },
    {
      role: "user",
      content: `Player input for this turn:\n${playerInput || "(none; continue request)"}\n\nDraft to correct:\n${draft}`,
    },
  ];
}
