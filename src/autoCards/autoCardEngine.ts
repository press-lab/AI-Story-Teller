import type { Adventure, AdventureAction, AutoCard } from "../types/adventure";
import { matchPatterns } from "../triggers/matching";

function canUpdate(card: AutoCard, turn: number): boolean {
  if (card.updateMode === "manual") return false;
  if (card.lastUpdatedTurn === undefined) return true;
  return turn - card.lastUpdatedTurn >= card.cooldownTurns;
}

export function buildAutoCardUpdateActions(
  adventure: Adventure,
  source: "input" | "output",
  text: string,
): AdventureAction[] {
  const actions: AdventureAction[] = [];

  for (const card of adventure.autoCards) {
    if (!card.active || !canUpdate(card, adventure.activeState.turn)) continue;
    const match = matchPatterns(text, card.triggers.length ? card.triggers : [card.detectedEntity, card.title], "phrase");
    if (!match.matched) continue;

    const marker = `[Turn ${adventure.activeState.turn} ${source}]`;
    const newContent = card.updateMode === "replace" ? `${marker}\n${text}` : [card.content, `${marker}\n${text}`].filter(Boolean).join("\n\n");
    actions.push({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { content: newContent } });
    actions.push({ type: "MARK_AUTO_CARD_UPDATED", autoCardId: card.id, turn: adventure.activeState.turn });
  }

  return actions;
}
