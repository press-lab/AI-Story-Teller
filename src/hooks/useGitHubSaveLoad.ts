import { useCallback, useState } from "react";
import { getAdventure } from "../db/adventureDb";
import type { Adventure, GitHubSaveSlot } from "../types/adventure";

export interface PendingConflict {
  loaded: Adventure;
  local: Adventure;
  slot: GitHubSaveSlot;
}

export function useGitHubSaveLoad(
  loadSave: (slot: GitHubSaveSlot) => Promise<Adventure | undefined>,
  onApply: (adventure: Adventure) => Promise<void>,
) {
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | undefined>();

  const initiateLoad = useCallback(
    async (slot: GitHubSaveSlot) => {
      const loaded = await loadSave(slot);
      if (!loaded) return;
      const existing = await getAdventure(loaded.id);
      if (!existing) {
        await onApply(loaded);
        return;
      }
      setPendingConflict({ loaded, local: existing, slot });
    },
    [loadSave, onApply],
  );

  const confirmOverwrite = useCallback(async () => {
    if (!pendingConflict) return;
    await onApply(pendingConflict.loaded);
    setPendingConflict(undefined);
  }, [pendingConflict, onApply]);

  const cancelOverwrite = useCallback(() => {
    setPendingConflict(undefined);
  }, []);

  return { pendingConflict, initiateLoad, confirmOverwrite, cancelOverwrite };
}
