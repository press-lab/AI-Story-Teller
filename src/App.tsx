import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildContext } from "./contextBuilder/contextBuilder";
import {
  deleteAdventure,
  getAdventure,
  listAdventures,
  saveAdventure,
  type AdventureSummary,
} from "./db/adventureDb";
import {
  defaultCloudSyncSettings,
  pullGitHubCloudSync,
  pushGitHubCloudSync,
} from "./sync/githubSync";
import { sendOpenAICompatibleChatCompletion } from "./providers/openAICompatible";
import { createDefaultAdventure, defaultModelConfig } from "./state/defaults";
import { adventureReducer } from "./state/adventureReducer";
import {
  applyRuntimeEngines,
  createMemoryProposalAction,
  latestAssistantOutput,
  reduceActions,
} from "./state/turnPipeline";
import { buildRollingSummaryPayload } from "./state/rollingSummary";
import {
  runManualAutoCardGeneration,
  runManualBrainUpdate,
  runRememberThis,
  runSemanticPostTurnEvaluation,
} from "./triggers/semanticEngine";
import type {
  Adventure,
  AdventureAction,
  ContextBuildResult,
  InputMode,
  NewAdventureSetup,
  PendingAdventureUpdate,
  CloudSyncSettings,
} from "./types/adventure";
import { importAdventureJson } from "./utils/json";
import { createId, nowIso } from "./utils/id";
import { getAdventureThumbnail, thumbnailMetadataPatch } from "./utils/adventureImages";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { createDevelopmentAdventure } from "./dev/developmentAdventure";
import type { RuntimeProviderSettings } from "./pages/pageTypes";
import { AdventuresPage } from "./pages/AdventuresPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlayPage } from "./pages/PlayPage";
import { ChroniclePage } from "./pages/ChroniclePage";
import { ContextPreviewPage } from "./pages/ContextPreviewPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { StoryCardsPage } from "./pages/StoryCardsPage";
import { BrainsPage } from "./pages/BrainsPage";
import { AutoCardsPage } from "./pages/AutoCardsPage";
import { TriggersPage } from "./pages/TriggersPage";
import { QuestsPage } from "./pages/QuestsPage";
import { SummaryPage } from "./pages/SummaryPage";
import { MemoryInboxPage } from "./pages/MemoryInboxPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { HelpPage } from "./pages/HelpPage";
import { AdventureThumbnailPicker } from "./components/AdventureThumbnail";

type TabId =
  | "adventures"
  | "dashboard"
  | "play"
  | "edit"
  | "chronicle"
  | "context"
  | "components"
  | "storyCards"
  | "brains"
  | "autoCards"
  | "triggers"
  | "quests"
  | "summary"
  | "memoryInbox"
  | "settings"
  | "importExport"
  | "help";

type EditorTabId =
  | "components"
  | "storyCards"
  | "brains"
  | "memoryInbox"
  | "summary"
  | "chronicle"
  | "autoCards"
  | "triggers"
  | "context"
  | "importExport";

const editorTabs: Array<{ id: EditorTabId; label: string; badge?: "memory" }> = [
  { id: "components", label: "Plot" },
  { id: "storyCards", label: "Story Cards" },
  { id: "brains", label: "Characters" },
  { id: "memoryInbox", label: "Memory", badge: "memory" },
  { id: "summary", label: "Summary" },
  { id: "chronicle", label: "Chronicle" },
  { id: "autoCards", label: "Auto-Cards" },
  { id: "triggers", label: "Automation" },
  { id: "context", label: "Context" },
  { id: "importExport", label: "Import / Export" },
];

const editorTabIds = new Set<TabId>(editorTabs.map((tab) => tab.id));

const modalTabs = new Set<TabId>([
  "context",
  "chronicle",
  "components",
  "storyCards",
  "brains",
  "autoCards",
  "triggers",
  "quests",
  "summary",
  "memoryInbox",
  "settings",
  "importExport",
]);

const modalTitles: Partial<Record<TabId, string>> = {
  context: "Context Preview",
  chronicle: "Adventure Chronicle",
  components: "World Blocks",
  storyCards: "Story Cards",
  brains: "Character Selves",
  autoCards: "Auto-Cards",
  triggers: "Automations",
  quests: "Quests",
  summary: "Story Summary",
  memoryInbox: "Memory Suggestions",
  settings: "Settings",
  importExport: "Import / Export",
};

const providerInitial: RuntimeProviderSettings = {
  ...defaultModelConfig,
  apiKey: "",
};

function providerConfig(adventure: Adventure, settings: RuntimeProviderSettings): RuntimeProviderSettings {
  return {
    ...adventure.modelConfig,
    ...settings,
    apiKey: settings.apiKey,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("adventures");
  const [editorTab, setEditorTab] = useState<EditorTabId>("components");
  const [modalTab, setModalTab] = useState<TabId | undefined>();
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [adventure, setAdventure] = useState<Adventure | undefined>();
  const [contextResult, setContextResult] = useState<ContextBuildResult | undefined>();
  const [saveStatus, setSaveStatus] = useState("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [providerSettings, setProviderSettings] = useLocalStorage<RuntimeProviderSettings>(
    "ai-story-teller-provider-settings",
    providerInitial,
  );
  const [uiPreferences, setUiPreferences] = useLocalStorage("ai-story-teller-ui-preferences", {
    darkMode: false,
  });
  const [cloudSyncSettings, setCloudSyncSettings] = useLocalStorage<CloudSyncSettings>(
    "ai-story-teller-cloud-sync-settings",
    defaultCloudSyncSettings,
  );
  const [cloudSyncStatus, setCloudSyncStatus] = useState("");
  const adventureRef = useRef<Adventure | undefined>(adventure);
  const providerSettingsRef = useRef(providerSettings);
  const isSubmittingRef = useRef(false);
  const queuedUpdatesRef = useRef<PendingAdventureUpdate[]>([]);

  const activeProviderConfig = useMemo(
    () => (adventure ? providerConfig(adventure, providerSettings) : providerSettings),
    [adventure, providerSettings],
  );

  const refreshAdventures = useCallback(async () => {
    setAdventures(await listAdventures());
  }, []);

  useEffect(() => {
    void refreshAdventures();
  }, [refreshAdventures]);

  useEffect(() => {
    adventureRef.current = adventure;
  }, [adventure]);

  useEffect(() => {
    providerSettingsRef.current = providerSettings;
  }, [providerSettings]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", uiPreferences.darkMode);
  }, [uiPreferences.darkMode]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModalTab(undefined);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!adventure) return;
    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      saveAdventure(adventure)
        .then(() => {
          setSaveStatus("saved");
          void refreshAdventures();
        })
        .catch((saveError: unknown) => setSaveStatus(saveError instanceof Error ? saveError.message : "save failed"));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [adventure, refreshAdventures]);

  const dispatch = useCallback((action: AdventureAction) => {
    setAdventure((current) => (current ? adventureReducer(current, action) : current));
  }, []);

  function openEditor(tabId: EditorTabId = "components") {
    setModalTab(undefined);
    setEditorTab(tabId);
    setActiveTab("edit");
  }

  function openTab(tabId: TabId) {
    if (adventure && editorTabIds.has(tabId)) {
      openEditor(tabId as EditorTabId);
      return;
    }
    if (["adventures", "dashboard", "play", "edit", "settings", "help"].includes(tabId)) {
      setModalTab(undefined);
      setActiveTab(tabId);
      return;
    }
    if (adventure && modalTabs.has(tabId)) {
      setModalTab(tabId);
      return;
    }
    setModalTab(undefined);
    setActiveTab(tabId);
  }

  function applyActionsAndPersist(actions: AdventureAction[]) {
    setAdventure((current) => {
      if (!current) return current;
      const next = reduceActions(current, actions);
      adventureRef.current = next;
      void saveAdventure(next).then(() => {
        setSaveStatus("saved");
        void refreshAdventures();
      });
      return next;
    });
  }

  function queuePendingUpdate(actions: AdventureAction[], source: PendingAdventureUpdate["source"]) {
    const update: PendingAdventureUpdate = {
      id: createId("pending"),
      createdAt: nowIso(),
      source,
      actions,
    };
    queuedUpdatesRef.current = [...queuedUpdatesRef.current, update];
    dispatch({ type: "QUEUE_PENDING_UPDATE", update });
  }

  function mergeQueuedUpdates(adventureState: Adventure): Adventure {
    if (queuedUpdatesRef.current.length === 0) return adventureState;
    let next = adventureState;
    for (const update of queuedUpdatesRef.current) {
      next = adventureReducer(next, { type: "QUEUE_PENDING_UPDATE", update });
    }
    queuedUpdatesRef.current = [];
    return next;
  }

  function flushPendingBeforeContext(adventureState: Adventure): Adventure {
    return adventureReducer(mergeQueuedUpdates(adventureState), { type: "FLUSH_PENDING_UPDATES" });
  }

  function applyMemoryProposalFromOutput(snapshot: Adventure, text: string): Adventure {
    const action = createMemoryProposalAction(snapshot, text);
    return action ? adventureReducer(snapshot, action) : snapshot;
  }

  async function startSemanticEvaluation(snapshot: Adventure) {
    if (!snapshot.semanticEvaluationSettings.enabled) return;
    const result = await runSemanticPostTurnEvaluation(snapshot, providerConfig(snapshot, providerSettingsRef.current));
    if (isSubmittingRef.current) {
      queuePendingUpdate(result.actions, "semanticEvaluation");
      return;
    }
    applyActionsAndPersist(result.actions);
  }

  const buildPreview = useCallback(() => {
    if (!adventure) return;
    setContextResult(buildContext(adventure, { latestModelOutput: latestAssistantOutput(adventure) }));
  }, [adventure]);

  async function createAdventure(setup: NewAdventureSetup) {
    const baseline = createDefaultAdventure(setup.title);
    const setupHasAiInstructions = setup.components.some((c) => c.type === "aiInstructions");
    const next = {
      ...baseline,
      openingScene: setup.openingScene,
      metadata: setup.thumbnailImage ? thumbnailMetadataPatch(setup.thumbnailImage) : baseline.metadata,
      components: [
        ...baseline.components.filter((c) => !(setupHasAiInstructions && c.type === "aiInstructions")),
        ...setup.components,
      ],
      storyCards: setup.storyCards,
    };
    await saveAdventure(next);
    setAdventure(next);
    setModalTab(undefined);
    setActiveTab("dashboard");
    await refreshAdventures();
  }

  async function loadDevelopmentAdventure() {
    const next = createDevelopmentAdventure();
    await saveAdventure(next);
    setAdventure(next);
    setContextResult(buildContext(next, { latestModelOutput: latestAssistantOutput(next) }));
    setModalTab(undefined);
    setActiveTab("dashboard");
    await refreshAdventures();
  }

  async function allSavedAdventures(): Promise<Adventure[]> {
    const summaries = await listAdventures();
    const loaded = await Promise.all(summaries.map((summary) => getAdventure(summary.id)));
    return loaded.filter((entry): entry is Adventure => Boolean(entry));
  }

  async function saveSyncedAdventures(syncedAdventures: Adventure[]) {
    for (const syncedAdventure of syncedAdventures) {
      await saveAdventure(syncedAdventure);
    }
    if (adventure) {
      const syncedCurrent = syncedAdventures.find((entry) => entry.id === adventure.id);
      if (syncedCurrent && syncedCurrent.updatedAt.localeCompare(adventure.updatedAt) >= 0) {
        setAdventure(syncedCurrent);
      }
    }
    await refreshAdventures();
  }

  async function pushCloudSync() {
    setCloudSyncStatus("Pushing to GitHub...");
    try {
      const localAdventures = await allSavedAdventures();
      const result = await pushGitHubCloudSync(cloudSyncSettings, localAdventures);
      await saveSyncedAdventures(result.adventures);
      setCloudSyncStatus(
        `Pushed ${result.adventures.length} adventure(s) to ${result.owner}/${result.repo}:${result.path}.`,
      );
    } catch (syncError) {
      setCloudSyncStatus(syncError instanceof Error ? syncError.message : "Cloud push failed.");
    }
  }

  async function pullCloudSync() {
    setCloudSyncStatus("Pulling from GitHub...");
    try {
      const localAdventures = await allSavedAdventures();
      const result = await pullGitHubCloudSync(cloudSyncSettings, localAdventures);
      await saveSyncedAdventures(result.adventures);
      setCloudSyncStatus(
        `Pulled ${result.remoteAdventureCount} remote adventure(s); local library now has ${result.adventures.length}.`,
      );
    } catch (syncError) {
      setCloudSyncStatus(syncError instanceof Error ? syncError.message : "Cloud pull failed.");
    }
  }

  async function openAdventure(id: string) {
    const next = await getAdventure(id);
    if (!next) {
      setError("Adventure could not be opened.");
      return;
    }
    setAdventure(next);
    setContextResult(undefined);
    setModalTab(undefined);
    setActiveTab("dashboard");
  }

  async function duplicateAdventure(id: string) {
    const existing = await getAdventure(id);
    if (!existing) return;
    const copy = importAdventureJson(JSON.stringify(existing), true);
    await saveAdventure(copy);
    setAdventure(copy);
    setModalTab(undefined);
    setActiveTab("dashboard");
    await refreshAdventures();
  }

  async function removeAdventure(id: string) {
    if (!window.confirm("Delete this adventure from IndexedDB?")) return;
    await deleteAdventure(id);
    if (adventure?.id === id) {
      setAdventure(undefined);
      setModalTab(undefined);
    }
    await refreshAdventures();
  }

  async function importAdventure(text: string) {
    try {
      const next = importAdventureJson(text);
      await saveAdventure(next);
      setAdventure(next);
      setModalTab(undefined);
      setActiveTab("dashboard");
      await refreshAdventures();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    }
  }

  async function createAdventureFromImport(next: Adventure) {
    await saveAdventure(next);
    setAdventure(next);
    setContextResult(undefined);
    setModalTab(undefined);
    await refreshAdventures();
  }

  async function submitTurn(text: string, mode: InputMode = "story") {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);

    let next = flushPendingBeforeContext(adventure);
    next = adventureReducer(next, { type: "ADD_MESSAGE", role: "user", content: text, inputMode: mode });
    next = applyRuntimeEngines(next, { source: "input", text });
    const context = buildContext(next, { currentInput: text, latestModelOutput: latestAssistantOutput(next) });
    setContextResult(context);
    setAdventure(next);

    try {
      const response = await sendOpenAICompatibleChatCompletion({
        messages: context.messages,
        config: providerConfig(next, providerSettings),
      });
      const assistantMode = mode === "comms" ? "comms" : undefined;
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content, inputMode: assistantMode });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      if (mode !== "comms") next = applyMemoryProposalFromOutput(next, response.content);
      setAdventure(next);
      next = applyRuntimeEngines(next, { source: "output", text: response.content });
      next = adventureReducer(next, { type: "INCREMENT_TURN" });
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(buildContext(next, { latestModelOutput: response.content }));
      await saveAdventure(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      if (mode !== "comms") void startSemanticEvaluation(next);
      if (mode !== "comms") {
        const budgetSettings = next.tokenBudgetSettings;
        if (budgetSettings.autoSummarize && next.activeState.turn > 0 && next.activeState.turn % budgetSettings.autoSummarizeEveryNTurns === 0) {
          void startAutoSummary(next);
        }
      }
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Provider request failed.");
      setAdventure(next);
      await saveAdventure(next);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      void refreshAdventures();
    }
  }

  async function continueTurn() {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);

    let next = flushPendingBeforeContext(adventure);
    const context = buildContext(next, { latestModelOutput: latestAssistantOutput(next) });
    setContextResult(context);
    setAdventure(next);

    try {
      const response = await sendOpenAICompatibleChatCompletion({
        messages: context.messages,
        config: providerConfig(next, providerSettings),
      });
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      next = applyMemoryProposalFromOutput(next, response.content);
      setAdventure(next);
      next = applyRuntimeEngines(next, { source: "output", text: response.content });
      next = adventureReducer(next, { type: "INCREMENT_TURN" });
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(buildContext(next, { latestModelOutput: response.content }));
      await saveAdventure(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      void startSemanticEvaluation(next);
      const budgetSettings = next.tokenBudgetSettings;
      if (budgetSettings.autoSummarize && next.activeState.turn > 0 && next.activeState.turn % budgetSettings.autoSummarizeEveryNTurns === 0) {
        void startAutoSummary(next);
      }
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Continue failed.");
      setAdventure(next);
      await saveAdventure(next);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
      void refreshAdventures();
    }
  }

  async function regenerateLastResponse() {
    if (!adventure || loading) return;
    isSubmittingRef.current = true;
    setLoading(true);
    setError(undefined);
    let next = flushPendingBeforeContext(adventure);
    next = adventureReducer(next, { type: "REMOVE_LAST_ASSISTANT_MESSAGE" });
    const lastUser = [...next.messages].reverse().find((message) => message.role === "user")?.content ?? "Continue.";
    const context = buildContext(next, { currentInput: lastUser, latestModelOutput: latestAssistantOutput(next) });
    setContextResult(context);

    try {
      const response = await sendOpenAICompatibleChatCompletion({
        messages: context.messages,
        config: providerConfig(next, providerSettings),
      });
      next = adventureReducer(next, { type: "ADD_MESSAGE", role: "assistant", content: response.content });
      next = adventureReducer(next, { type: "CONSUME_NEXT_TURN_NOTE" });
      next = applyMemoryProposalFromOutput(next, response.content);
      setAdventure(next);
      next = applyRuntimeEngines(next, { source: "output", text: response.content });
      next = mergeQueuedUpdates(next);
      setAdventure(next);
      setContextResult(buildContext(next, { latestModelOutput: response.content }));
      await saveAdventure(next);
      setSaveStatus("saved");
      isSubmittingRef.current = false;
      void startSemanticEvaluation(next);
    } catch (providerError) {
      setError(providerError instanceof Error ? providerError.message : "Regeneration failed.");
      setAdventure(next);
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }

  async function rememberThis(fact: string) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runRememberThis(adventure, activeProviderConfig, fact);
      applyActionsAndPersist(result.actions);
      openTab("memoryInbox");
    } catch (rememberError) {
      setError(rememberError instanceof Error ? rememberError.message : "Remember This failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBrainNow(brainId: string) {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualBrainUpdate(adventure, activeProviderConfig, brainId);
      applyActionsAndPersist(result.actions);
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "Manual brain update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateAutoCardNow() {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await runManualAutoCardGeneration(adventure, activeProviderConfig);
      applyActionsAndPersist(result.actions);
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "Manual Auto-Card generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function generateSummary() {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const { messages: summaryMessages, lastIndex } = buildRollingSummaryPayload(adventure);
      const response = await sendOpenAICompatibleChatCompletion({
        config: activeProviderConfig,
        messages: summaryMessages,
      });
      dispatch({ type: "UPDATE_ROLLING_SUMMARY", content: response.content, lastSummarizedMessageIndex: lastIndex });
    } catch (summaryError) {
      setError(summaryError instanceof Error ? summaryError.message : "Summary generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function startAutoSummary(adventureState: Adventure) {
    // Runs silently in the background — no loading spinner, no error banner
    try {
      const { messages: summaryMessages, lastIndex } = buildRollingSummaryPayload(adventureState);
      const response = await sendOpenAICompatibleChatCompletion({
        config: providerConfig(adventureState, providerSettingsRef.current),
        messages: summaryMessages,
      });
      if (isSubmittingRef.current) {
        queuePendingUpdate(
          [{ type: "UPDATE_ROLLING_SUMMARY", content: response.content, lastSummarizedMessageIndex: lastIndex }],
          "autoSummary",
        );
        return;
      }
      applyActionsAndPersist([
        { type: "UPDATE_ROLLING_SUMMARY", content: response.content, lastSummarizedMessageIndex: lastIndex },
      ]);
    } catch {
      // silent — auto-summary is best-effort; user can always regenerate manually
    }
  }

  function renderAdventureTool(tabId: TabId) {
    if (!adventure) return null;
    const common = { adventure, dispatch };
    switch (tabId) {
      case "chronicle":
        return <ChroniclePage {...common} />;
      case "context":
        return <ContextPreviewPage {...common} contextResult={contextResult} onBuildContext={buildPreview} />;
      case "components":
        return <ComponentsPage {...common} />;
      case "storyCards":
        return <StoryCardsPage {...common} />;
      case "brains":
        return <BrainsPage {...common} loading={loading} onUpdateBrainNow={updateBrainNow} />;
      case "autoCards":
        return <AutoCardsPage {...common} loading={loading} onGenerateAutoCardNow={generateAutoCardNow} />;
      case "triggers":
        return <TriggersPage {...common} />;
      case "quests":
        return <QuestsPage {...common} />;
      case "summary":
        return <SummaryPage {...common} loading={loading} onGenerateSummary={generateSummary} />;
      case "memoryInbox":
        return <MemoryInboxPage {...common} />;
      case "settings":
        return (
          <SettingsPage
            adventure={adventure}
            dispatch={dispatch}
            providerSettings={activeProviderConfig}
            onProviderSettingsChange={setProviderSettings}
            darkMode={uiPreferences.darkMode}
            onDarkModeChange={(darkMode) => setUiPreferences({ ...uiPreferences, darkMode })}
            cloudSyncSettings={cloudSyncSettings}
            cloudSyncStatus={cloudSyncStatus}
            onCloudSyncSettingsChange={setCloudSyncSettings}
            onPushCloudSync={pushCloudSync}
            onPullCloudSync={pullCloudSync}
            onLoadDevelopmentAdventure={loadDevelopmentAdventure}
          />
        );
      case "importExport":
        return (
          <ImportExportPage
            {...common}
            onImportAdventure={importAdventure}
            onCreateAdventureFromImport={createAdventureFromImport}
            onOpenImportedAdventure={() => {
              setModalTab(undefined);
              setActiveTab("play");
            }}
          />
        );
      default:
        return null;
    }
  }

  const pendingProposalCount = adventure?.activeState.memoryProposals.filter((p) => p.status === "pending").length ?? 0;
  const currentThumbnail = adventure ? getAdventureThumbnail(adventure) : undefined;

  const page = (() => {
    if (activeTab === "adventures") {
      return (
        <AdventuresPage
          adventures={adventures}
          currentAdventure={adventure}
          onCreate={createAdventure}
          onOpen={openAdventure}
          onDuplicate={duplicateAdventure}
          onDelete={removeAdventure}
        />
      );
    }

    if (activeTab === "help") {
      return <HelpPage />;
    }

    if (activeTab === "settings") {
      return (
        <SettingsPage
          adventure={adventure}
          dispatch={dispatch}
          providerSettings={activeProviderConfig}
          onProviderSettingsChange={setProviderSettings}
          darkMode={uiPreferences.darkMode}
          onDarkModeChange={(darkMode) => setUiPreferences({ ...uiPreferences, darkMode })}
          cloudSyncSettings={cloudSyncSettings}
          cloudSyncStatus={cloudSyncStatus}
          onCloudSyncSettingsChange={setCloudSyncSettings}
          onPushCloudSync={pushCloudSync}
          onPullCloudSync={pullCloudSync}
          onLoadDevelopmentAdventure={loadDevelopmentAdventure}
        />
      );
    }

    if (!adventure) {
      return (
        <section className="page">
          <p className="muted">Open an adventure from the Adventures page to get started.</p>
        </section>
      );
    }

    const common = { adventure, dispatch };
    switch (activeTab) {
      case "play":
        return (
          <PlayPage
            {...common}
            contextResult={contextResult}
            loading={loading}
            error={error}
            saveStatus={saveStatus}
            onSubmitTurn={submitTurn}
            onContinue={continueTurn}
            onRegenerate={regenerateLastResponse}
            onBuildContext={buildPreview}
            onOpenContext={() => openEditor("context")}
            onRememberThis={rememberThis}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
          />
        );
      case "dashboard":
        return (
          <DashboardPage
            {...common}
            contextResult={contextResult}
            loading={loading}
            error={error}
            saveStatus={saveStatus}
            onSubmitTurn={submitTurn}
            onContinue={continueTurn}
            onRegenerate={regenerateLastResponse}
            onBuildContext={buildPreview}
            onOpenContext={() => openEditor("context")}
            onRememberThis={rememberThis}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
          />
        );
      case "edit":
        return (
          <section className="page editor-workspace">
            <header className="editor-header panel">
              <div>
                <p className="eyebrow">Edit Adventure</p>
                <h2>{adventure.title}</h2>
                <p className="muted">{saveStatus}</p>
              </div>
              <div className="editor-header-actions">
                <AdventureThumbnailPicker
                  thumbnail={currentThumbnail}
                  title={adventure.title}
                  compact
                  onChange={(thumbnail) =>
                    dispatch({ type: "UPDATE_METADATA", metadata: thumbnailMetadataPatch(thumbnail ?? null) })
                  }
                />
                <button type="button" onClick={() => setActiveTab("play")}>
                  Play
                </button>
                <button type="button" className="primary-action" onClick={() => setActiveTab("dashboard")}>
                  Finish
                </button>
              </div>
            </header>
            <nav className="editor-tabs" aria-label="Adventure editor">
              {editorTabs.map((tab) => {
                const badge = tab.badge === "memory" ? pendingProposalCount : 0;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={editorTab === tab.id ? "active" : ""}
                    onClick={() => setEditorTab(tab.id)}
                  >
                    {tab.label}
                    {badge > 0 && <span className="nav-badge">{badge > 99 ? "99+" : badge}</span>}
                  </button>
                );
              })}
            </nav>
            <div className="editor-body">{renderAdventureTool(editorTab)}</div>
          </section>
        );
      case "chronicle":
        return <ChroniclePage {...common} />;
      case "context":
      case "components":
      case "storyCards":
      case "brains":
      case "autoCards":
      case "triggers":
      case "quests":
      case "summary":
      case "memoryInbox":
      case "importExport":
        return renderAdventureTool(activeTab);
      default:
        return null;
    }
  })();

  const activeTopTab = editorTabIds.has(activeTab) ? "edit" : activeTab;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <button type="button" className="app-title-button" onClick={() => openTab("adventures")}>
            <span className="app-brand">AI Story Teller</span>
            {adventure && <span className="muted">{adventure.title}</span>}
          </button>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <button
            type="button"
            className={activeTopTab === "adventures" ? "active" : ""}
            onClick={() => openTab("adventures")}
          >
            Library
          </button>
          <button
            type="button"
            className={activeTopTab === "dashboard" ? "active" : ""}
            disabled={!adventure}
            onClick={() => openTab("dashboard")}
          >
            Adventure
          </button>
          <button
            type="button"
            className={activeTopTab === "play" ? "active primary" : "primary"}
            disabled={!adventure}
            onClick={() => openTab("play")}
          >
            Play
          </button>
          <button
            type="button"
            className={activeTopTab === "edit" ? "active" : ""}
            disabled={!adventure}
            onClick={() => openEditor(editorTab)}
          >
            Edit
            {pendingProposalCount > 0 && <span className="nav-badge">{pendingProposalCount > 99 ? "99+" : pendingProposalCount}</span>}
          </button>
        </nav>
        <div className="header-meta">
          {adventure && <span className="status-pill">{saveStatus}</span>}
          <button
            type="button"
            className={activeTopTab === "settings" ? "theme-toggle active" : "theme-toggle"}
            onClick={() => openTab("settings")}
          >
            Settings
          </button>
          <button
            type="button"
            className={activeTopTab === "help" ? "theme-toggle active" : "theme-toggle"}
            onClick={() => openTab("help")}
          >
            Docs
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setUiPreferences({ ...uiPreferences, darkMode: !uiPreferences.darkMode })}
          >
            {uiPreferences.darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <main className={`main-content${activeTab === "play" ? " play-content" : ""}${activeTab === "edit" ? " edit-content" : ""}`}>
        {error && activeTab !== "play" && <div className="error-box">{error}</div>}
        {page}
      </main>

      {modalTab && adventure && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalTab(undefined)}>
          <section
            className="tool-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modalTitles[modalTab] ?? "Adventure tool"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="tool-modal-header">
              <div>
                <p className="eyebrow">Adventure Tool</p>
                <h2>{modalTitles[modalTab] ?? "Tool"}</h2>
              </div>
              <button type="button" onClick={() => setModalTab(undefined)}>
                Close
              </button>
            </header>
            <div className="tool-modal-body">{renderAdventureTool(modalTab)}</div>
          </section>
        </div>
      )}
    </div>
  );
}
