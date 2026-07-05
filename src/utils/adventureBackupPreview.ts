export type AdventureBackupPreview =
  | { status: "empty" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      id: string;
      title: string;
      turn: number;
      messages: number;
      storyCards: number;
      brains: number;
      components: number;
      rawImports: number;
      updatedAt?: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export function parseAdventureBackupPreview(text: string): AdventureBackupPreview {
  const trimmed = text.trim();
  if (!trimmed) return { status: "empty" };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      return { status: "error", message: "This is JSON, but it is not an adventure backup." };
    }

    const id = typeof parsed.id === "string" ? parsed.id : "";
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    if (!id || !title) {
      return { status: "error", message: "This does not look like a full adventure backup. It needs an adventure title and id." };
    }

    const activeState = isRecord(parsed.activeState) ? parsed.activeState : {};
    return {
      status: "ready",
      id,
      title,
      turn: typeof activeState.turn === "number" ? activeState.turn : 0,
      messages: countArray(parsed.messages),
      storyCards: countArray(parsed.storyCards),
      brains: countArray(parsed.brains),
      components: countArray(parsed.components),
      rawImports: countArray(isRecord(activeState) ? activeState.rawImports : undefined),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    };
  } catch {
    return { status: "error", message: "The pasted text is not valid JSON yet." };
  }
}
