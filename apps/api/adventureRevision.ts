import type { Adventure } from "../../src/types/adventure";

const METADATA_KEY = "serverRevision";

export function adventureServerRevision(adventure: Adventure): number | undefined {
  const value = adventure.metadata[METADATA_KEY];
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function withAdventureServerRevision(adventure: Adventure, revision: number): Adventure {
  return { ...adventure, metadata: { ...adventure.metadata, [METADATA_KEY]: revision } };
}

export class StaleAdventureRevisionError extends Error {
  readonly code = "stale_adventure_revision";

  constructor(readonly expectedRevision: number, readonly currentRevision: number) {
    super(`Adventure changed on the server. Expected revision ${expectedRevision}, current revision ${currentRevision}.`);
    this.name = "StaleAdventureRevisionError";
  }
}
