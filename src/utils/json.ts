import type { Adventure } from "../types/adventure";
import { createId, nowIso } from "./id";
import { normalizeAdventure } from "../state/defaults";

export function exportAdventureJson(adventure: Adventure): string {
  const { apiKey: _apiKey, ...modelConfig } = adventure.modelConfig;
  return JSON.stringify({ ...adventure, modelConfig }, null, 2);
}

export function importAdventureJson(text: string, duplicate = false): Adventure {
  const parsed = JSON.parse(text) as Adventure;
  if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.title) {
    throw new Error("Imported JSON is not a valid adventure.");
  }
  const timestamp = nowIso();
  const adventure = duplicate
    ? {
        ...parsed,
        id: createId("adv"),
        title: `${parsed.title} Copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    : { ...parsed, updatedAt: timestamp };
  const { apiKey: _apiKey, ...modelConfig } = adventure.modelConfig ?? {};
  return normalizeAdventure({ ...adventure, modelConfig });
}
