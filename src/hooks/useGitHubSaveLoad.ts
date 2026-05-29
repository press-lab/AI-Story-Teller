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
  const [loadingSlotId, setLoadingSlotId] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();

  const initiateLoad = useCallback(
    async (slot: GitHubSaveSlot) => {
      setLoadingSlotId(slot.saveId);
      setLoadError(undefined);
      try {
        const loaded = await loadSave(slot);
        if (!loaded) {
          setLoadingSlotId(undefined);
          return;
        }
        const existing = await getAdventure(loaded.id);
        if (!existing) {
          await onApply(loaded);
          setLoadingSlotId(undefined);
          return;
        }
        setLoadingSlotId(undefined);
        setPendingConflict({ loaded, local: existing, slot });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Load failed.");
        setLoadingSlotId(undefined);
      }
    },
    [loadSave, onApply],
  );

  const confirmOverwrite = useCallback(async () => {
    if (!pendingConflict) return;
    setLoadingSlotId(pendingConflict.slot.saveId);
    setLoadError(undefined);
    try {
      await onApply(pendingConflict.loaded);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Apply failed.");
    }
    setLoadingSlotId(undefined);
    setPendingConflict(undefined);
  }, [pendingConflict, onApply]);

  const cancelOverwrite = useCallback(() => {
    setPendingConflict(undefined);
    setLoadError(undefined);
  }, []);

  return { pendingConflict, loadingSlotId, loadError, initiateLoad, confirmOverwrite, cancelOverwrite };
}
