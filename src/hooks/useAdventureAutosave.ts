import { useEffect, useRef } from "react";
import type { Adventure } from "../types/adventure";
import { isBackendSyncQueuedError, type AdventureStore } from "../runtime/adventureStore";

export function useAdventureAutosave(
  adventure: Adventure | undefined,
  store: AdventureStore,
  onSaveStatusChange: (status: string) => void,
  onSaved: () => void,
) {
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  const onSavedRef = useRef(onSaved);
  const adventureRef = useRef(adventure);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const latestOperationRef = useRef(0);
  // Update refs without re-running the save effect
  useEffect(() => { onSaveStatusChangeRef.current = onSaveStatusChange; });
  useEffect(() => { onSavedRef.current = onSaved; });
  useEffect(() => { adventureRef.current = adventure; }, [adventure]);

  useEffect(() => {
    if (!adventure) return;
    onSaveStatusChangeRef.current("saving");
    const scheduledAdventureId = adventure.id;
    const timeout = window.setTimeout(() => {
      const current = adventureRef.current;
      if (!current || current.id !== scheduledAdventureId) return;
      const operationId = ++latestOperationRef.current;
      saveChainRef.current = saveChainRef.current.catch(() => undefined).then(async () => {
        const latest = adventureRef.current;
        if (!latest || latest.id !== scheduledAdventureId) return;
        try {
          await store.save(latest);
          if (operationId === latestOperationRef.current && adventureRef.current === latest) {
            onSaveStatusChangeRef.current("saved");
            onSavedRef.current();
          }
        } catch (saveError) {
          if (operationId === latestOperationRef.current && adventureRef.current === latest) {
            onSaveStatusChangeRef.current(saveError instanceof Error ? saveError.message : "save failed");
            if (isBackendSyncQueuedError(saveError)) onSavedRef.current();
          }
        }
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [adventure, store]);
}
