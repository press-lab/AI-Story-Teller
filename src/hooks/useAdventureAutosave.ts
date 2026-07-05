import { useEffect, useRef } from "react";
import type { Adventure } from "../types/adventure";
import type { AdventureStore } from "../runtime/adventureStore";

export function useAdventureAutosave(
  adventure: Adventure | undefined,
  store: AdventureStore,
  onSaveStatusChange: (status: string) => void,
  onSaved: () => void,
) {
  const onSaveStatusChangeRef = useRef(onSaveStatusChange);
  const onSavedRef = useRef(onSaved);
  // Update refs without re-running the save effect
  useEffect(() => { onSaveStatusChangeRef.current = onSaveStatusChange; });
  useEffect(() => { onSavedRef.current = onSaved; });

  useEffect(() => {
    if (!adventure) return;
    onSaveStatusChangeRef.current("saving");
    const timeout = window.setTimeout(() => {
      store.save(adventure)
        .then(() => {
          onSaveStatusChangeRef.current("saved");
          onSavedRef.current();
        })
        .catch((saveError: unknown) =>
          onSaveStatusChangeRef.current(
            saveError instanceof Error ? saveError.message : "save failed",
          ),
        );
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [adventure, store]);
}
