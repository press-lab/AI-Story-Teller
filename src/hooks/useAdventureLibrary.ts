import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AdventureSummary } from "../db/adventureDb";
import { buildContext } from "../contextBuilder/contextBuilder";
import { createDevelopmentAdventure } from "../dev/developmentAdventure";
import { createDispatchAdventure } from "../dev/dispatchAdventure";
import { buildPremadeContext, getPremadeAdventure, type PremadeAdventureId } from "../dev/premadeAdventures";
import { createDefaultAdventure } from "../state/defaults";
import { latestAssistantOutput } from "../state/turnPipeline";
import type { Adventure, ContextBuildResult, NewAdventureSetup } from "../types/adventure";
import { exportAdventureJson, importAdventureJson } from "../utils/json";
import { getAdventureThumbnail, thumbnailMetadataPatch } from "../utils/adventureImages";
import type { AdventureStore, AdventureSyncConflictResolution } from "../runtime/adventureStore";
import { useActionFeedback } from "../components/ActionFeedback";

export function useAdventureLibrary(
  store: AdventureStore,
  storageLabel: string,
  setAdventure: Dispatch<SetStateAction<Adventure | undefined>>,
  setContextResult: (r: ContextBuildResult | undefined) => void,
  onNavigate: (tab: string) => void,
  onModalClose: () => void,
  onError: (e: string) => void,
  importWithBackend?: (text: string) => Promise<Adventure>,
  onSyncConflictResolved?: (adventure: Adventure) => void,
) {
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [openingAdventureId, setOpeningAdventureId] = useState<string | undefined>();
  const { confirmAction, notify } = useActionFeedback();

  const refreshAdventures = useCallback(async () => {
    setRefreshing(true);
    try {
      const summaries = await store.list();
      const next = store.hydrateMissingThumbnails === false
        ? summaries
        : await hydrateMissingThumbnails(store, summaries);
      setAdventures(next);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not refresh adventures.");
    } finally {
      setRefreshing(false);
    }
  }, [store, onError]);

  useEffect(() => {
    void refreshAdventures();
  }, [refreshAdventures]);

  async function allSavedAdventures(): Promise<Adventure[]> {
    const summaries = await store.list();
    const loaded = await Promise.all(summaries.map((s) => store.get(s.id)));
    return loaded.filter((a): a is Adventure => Boolean(a));
  }

  async function openAdventure(id: string): Promise<Adventure | undefined> {
    setOpeningAdventureId(id);
    try {
      const next = await store.get(id);
      if (!next) {
        onError("Adventure could not be opened.");
        return undefined;
      }
      setAdventure(next);
      setContextResult(undefined);
      onModalClose();
      onNavigate("dashboard");
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Adventure could not be opened.";
      onError(message);
      notify(message, { type: "error" });
      return undefined;
    } finally {
      setOpeningAdventureId(undefined);
    }
  }

  async function createAdventure(setup: NewAdventureSetup) {
    const baseline = createDefaultAdventure(setup.title);
    // Collect all singleton component types the wizard is providing so we can drop
    // the baseline defaults for those types — avoids duplicate narrationRules,
    // aiInstructions, plotEssentials, etc. when the wizard seeds its own copy.
    const setupTypes = new Set(setup.components.map((c) => c.type));
    const next = {
      ...baseline,
      openingScene: setup.openingScene,
      metadata: setup.thumbnailImage ? thumbnailMetadataPatch(setup.thumbnailImage) : baseline.metadata,
      components: [
        ...baseline.components.filter((c) => !setupTypes.has(c.type)),
        ...setup.components,
      ],
      storyCards: setup.storyCards,
    };
    await store.save(next);
    setAdventure(next);
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  async function duplicateAdventure(id: string) {
    const existing = await store.get(id);
    if (!existing) return;
    const copy = importAdventureJson(JSON.stringify(existing), true);
    await store.save(copy);
    setAdventure(copy);
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  async function resolveSyncConflict(id: string, resolution: AdventureSyncConflictResolution) {
    if (!store.resolveSyncConflict) {
      const message = "This storage backend does not support save conflict resolution.";
      onError(message);
      notify(message, { type: "error" });
      return;
    }
    const uploadLocal = resolution === "uploadLocal";
    const confirmed = await confirmAction({
      title: uploadLocal ? "Upload local save?" : "Download server save?",
      message: uploadLocal
        ? "Replace the server copy with this device's local save? Existing server backup history remains available."
        : "Replace this device's local backup with the current server save? Unsynced local changes on this device will be lost.",
      confirmLabel: uploadLocal ? "Upload Local" : "Download Server",
      danger: true,
    });
    if (!confirmed) return;

    notify(uploadLocal ? "Uploading local save..." : "Downloading server save...", { type: "info" });
    try {
      const resolved = await store.resolveSyncConflict(id, resolution);
      setAdventure(resolved);
      setContextResult(undefined);
      onSyncConflictResolved?.(resolved);
      onModalClose();
      onNavigate("dashboard");
      await refreshAdventures();
      notify(uploadLocal ? "Local save uploaded to server." : "Server save downloaded.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save conflict resolution failed.";
      onError(message);
      notify(message, { type: "error" });
    }
  }

  async function removeAdventure(id: string, currentAdventureId?: string) {
    const confirmed = await confirmAction({
      title: "Delete adventure?",
      message: `Delete this adventure from ${storageLabel}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await store.delete(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Adventure delete failed.";
      onError(message);
      notify(message, { type: "error" });
      return;
    }
    if (currentAdventureId === id) {
      setAdventure(undefined);
      onModalClose();
    }
    await refreshAdventures();
    notify("Adventure deleted.", { type: "success" });
  }

  async function importAdventure(text: string) {
    try {
      const next = importWithBackend ? await importWithBackend(text) : importAdventureJson(text);
      if (!importWithBackend) await store.save(next);
      setAdventure(next);
      setContextResult(undefined);
      onModalClose();
      onNavigate("dashboard");
      await refreshAdventures();
      notify("Adventure imported.", { type: "success" });
    } catch (importError) {
      onError(importError instanceof Error ? importError.message : "Import failed.");
      notify(importError instanceof Error ? importError.message : "Import failed.", { type: "error" });
      throw importError;
    }
  }

  async function createAdventureFromImport(next: Adventure) {
    const imported = importWithBackend ? await importWithBackend(exportAdventureJson(next)) : undefined;
    const target = imported ?? next;
    if (!importWithBackend) await store.save(target);
    setAdventure(target);
    setContextResult(undefined);
    onModalClose();
    await refreshAdventures();
  }

  async function loadDevScenario(next: Awaited<ReturnType<typeof createDevelopmentAdventure>>) {
    await store.save(next);
    setAdventure(next);
    setContextResult(buildContext(next, { latestModelOutput: latestAssistantOutput(next) }));
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  async function loadPremadeAdventure(id: PremadeAdventureId) {
    const premade = getPremadeAdventure(id);
    if (!premade) {
      onError("Premade adventure could not be loaded.");
      return;
    }
    const next = premade.createAdventure();
    await store.save(next);
    setAdventure(next);
    setContextResult(buildPremadeContext(next));
    onModalClose();
    onNavigate("dashboard");
    await refreshAdventures();
  }

  async function loadDevelopmentAdventure() {
    await loadDevScenario(createDevelopmentAdventure());
  }

  async function loadDispatchAdventure() {
    await loadDevScenario(createDispatchAdventure());
  }

  return {
    adventures,
    refreshing,
    openingAdventureId,
    refreshAdventures,
    allSavedAdventures,
    openAdventure,
    createAdventure,
    duplicateAdventure,
    resolveSyncConflict,
    removeAdventure,
    importAdventure,
    createAdventureFromImport,
    loadPremadeAdventure,
    loadDevelopmentAdventure,
    loadDispatchAdventure,
  };
}

export function adventureFromSetup(setup: NewAdventureSetup): Adventure {
  const baseline = createDefaultAdventure(setup.title);
  const setupTypes = new Set(setup.components.map((component) => component.type));
  return {
    ...baseline,
    openingScene: setup.openingScene,
    metadata: setup.thumbnailImage ? thumbnailMetadataPatch(setup.thumbnailImage) : baseline.metadata,
    components: [
      ...baseline.components.filter((component) => !setupTypes.has(component.type)),
      ...setup.components,
    ],
    storyCards: setup.storyCards,
  };
}

async function hydrateMissingThumbnails(
  store: AdventureStore,
  summaries: AdventureSummary[],
): Promise<AdventureSummary[]> {
  return Promise.all(summaries.map(async (summary) => {
    if (summary.thumbnailImage) return summary;
    try {
      const adventure = await store.get(summary.id);
      const thumbnailImage = adventure ? getAdventureThumbnail(adventure) : undefined;
      return thumbnailImage ? { ...summary, thumbnailImage } : summary;
    } catch {
      return summary;
    }
  }));
}
