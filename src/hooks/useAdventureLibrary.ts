import { useCallback, useEffect, useState } from "react";
import {
  deleteAdventure as dbDeleteAdventure,
  getAdventure,
  listAdventures,
  saveAdventure,
  type AdventureSummary,
} from "../db/adventureDb";
import { buildContext } from "../contextBuilder/contextBuilder";
import { createDevelopmentAdventure } from "../dev/developmentAdventure";
import { createDefaultAdventure } from "../state/defaults";
import { latestAssistantOutput } from "../state/turnPipeline";
import type { Adventure, ContextBuildResult, NewAdventureSetup } from "../types/adventure";
import { importAdventureJson } from "../utils/json";
import { thumbnailMetadataPatch } from "../utils/adventureImages";

export function useAdventureLibrary(
  setAdventure: (a: Adventure | undefined) => void,
  setContextResult: (r: ContextBuildResult | undefined) => void,
  onNavigate: (tab: string) => void,
  onModalClose: () => void,
  onError: (e: string) => void,
) {
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);

  const refreshAdventures = useCallback(async () => {
    setAdventures(await listAdventures());
  }, []);

  useEffect(() => {
    void refreshAdventures();
  }, [refreshAdventures]);

  async function allSavedAdventures(): Promise<Adventure[]> {
    const summaries = await listAdventures();
    const loaded = await Promise.all(summaries.map((s) => getAdventure(s.id)));
    return loaded.filter((a): a is Adventure => Boolean(a));
  }

  async function openAdventure(id: string) {
    const next = await getAdventure(id);
    if (!next) { onError("Adventure could not be opened."); return; }
    setAdventure(next);
    setContextResult(undefined);
    onModalClose();
    onNavigate("dashboard");
  }

  async function createAdventure(setup: NewAdventureSetup) {
    const baseline = createDefaultAdventure(setup.title);
    const hasAiInstructions = setup.components.some((c) => c.type === "aiInstructions");
    const next = {
      ...baseline,
      openingScene: setup.openingScene,
      metadata: setup.thumbnailImage ? thumbnailMetadataPatch(setup.thumbnailImage) : baseline.metadata,
      components: [
        ...baseline.components.filter((c) => !(hasAiInstructions && c.type === "aiInstructions")),
        ...setup.components,
      ],
      storyCards: setup.storyCards,
    };
    await saveAdventure(next);
    setAdventure(next);
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  async function duplicateAdventure(id: string) {
    const existing = await getAdventure(id);
    if (!existing) return;
    const copy = importAdventureJson(JSON.stringify(existing), true);
    await saveAdventure(copy);
    setAdventure(copy);
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  async function removeAdventure(id: string, currentAdventureId?: string) {
    if (!window.confirm("Delete this adventure from IndexedDB?")) return;
    await dbDeleteAdventure(id);
    if (currentAdventureId === id) {
      setAdventure(undefined);
      onModalClose();
    }
    await refreshAdventures();
  }

  async function importAdventure(text: string) {
    try {
      const next = importAdventureJson(text);
      await saveAdventure(next);
      setAdventure(next);
      onModalClose();
      onNavigate("dashboard");
      await refreshAdventures();
    } catch (importError) {
      onError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  async function createAdventureFromImport(next: Adventure) {
    await saveAdventure(next);
    setAdventure(next);
    setContextResult(undefined);
    onModalClose();
    await refreshAdventures();
  }

  async function loadDevelopmentAdventure() {
    const next = createDevelopmentAdventure();
    await saveAdventure(next);
    setAdventure(next);
    setContextResult(buildContext(next, { latestModelOutput: latestAssistantOutput(next) }));
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  return {
    adventures,
    refreshAdventures,
    allSavedAdventures,
    openAdventure,
    createAdventure,
    duplicateAdventure,
    removeAdventure,
    importAdventure,
    createAdventureFromImport,
    loadDevelopmentAdventure,
  };
}
