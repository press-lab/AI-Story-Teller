import type { AutoCard } from "../types/adventure";

export interface EntityDetectionInput {
  text: string;
  existingCards: AutoCard[];
}

export interface EntityDetectionCandidate {
  title: string;
  detectedEntity: string;
  triggers: string[];
  content: string;
}

export function detectAutoCardEntities(_input: EntityDetectionInput): EntityDetectionCandidate[] {
  // Legacy adapter: Auto-Card detection now runs through semantic LLM evaluation in src/triggers/semanticEngine.ts.
  return [];
}
