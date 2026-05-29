import { useCallback, useRef, useState } from "react";
import type { Adventure, CloudSyncSettings, GitHubSaveSettings, GitHubSaveSlot } from "../types/adventure";
import { listGitHubSaves, loadGitHubSave, saveToGitHub, shouldAutoSave } from "../sync/githubSaves";

export function useGitHubSaves(cloudSettings: CloudSyncSettings, saveSettings: GitHubSaveSettings) {
  const [saveSlots, setSaveSlots] = useState<GitHubSaveSlot[]>([]);
  const [savesStatus, setSavesStatus] = useState("");
  const lastAutoSavedTurnRef = useRef<Record<string, number>>({});

  const listSaves = useCallback(async () => {
    setSavesStatus("Loading saves…");
    try {
      const slots = await listGitHubSaves(cloudSettings, saveSettings);
      setSaveSlots(slots);
      setSavesStatus(slots.length > 0 ? `${slots.length} saves` : "No saves found");
    } catch (error) {
      setSavesStatus(error instanceof Error ? error.message : "Failed to load saves.");
    }
  }, [cloudSettings, saveSettings]);

  const saveNow = useCallback(
    async (adventure: Adventure): Promise<GitHubSaveSlot | undefined> => {
      setSavesStatus("Saving…");
      try {
        const slot = await saveToGitHub(cloudSettings, saveSettings, adventure, "manual");
        setSaveSlots((current) => [slot, ...current.filter((s) => s.saveId !== slot.saveId)]);
        setSavesStatus("Saved to GitHub");
        return slot;
      } catch (error) {
        setSavesStatus(error instanceof Error ? error.message : "Save failed.");
        return undefined;
      }
    },
    [cloudSettings, saveSettings],
  );

  const loadSave = useCallback(
    async (slot: GitHubSaveSlot): Promise<Adventure | undefined> => {
      setSavesStatus("Loading save…");
      try {
        const adventure = await loadGitHubSave(cloudSettings, saveSettings, slot);
        setSavesStatus("Save loaded");
        return adventure;
      } catch (error) {
        setSavesStatus(error instanceof Error ? error.message : "Load failed.");
        return undefined;
      }
    },
    [cloudSettings, saveSettings],
  );

  const autoSaveIfDue = useCallback(
    async (adventure: Adventure): Promise<void> => {
      const lastTurn = lastAutoSavedTurnRef.current[adventure.id] ?? -1;
      if (!shouldAutoSave(adventure, saveSettings, lastTurn)) return;
      try {
        const slot = await saveToGitHub(cloudSettings, saveSettings, adventure, "auto");
        lastAutoSavedTurnRef.current = { ...lastAutoSavedTurnRef.current, [adventure.id]: adventure.activeState.turn };
        setSaveSlots((current) => [slot, ...current.filter((s) => s.saveId !== slot.saveId)]);
      } catch {
        // auto-save failures are silent — don't surface transient GitHub errors to the user mid-session
      }
    },
    [cloudSettings, saveSettings],
  );

  return { saveSlots, savesStatus, listSaves, saveNow, loadSave, autoSaveIfDue };
}
