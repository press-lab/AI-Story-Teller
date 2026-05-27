import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type NavGroup } from "./components/Sidebar";
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

type TabId =
  | "adventures"
  | "dashboard"
  | "play"
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

const navGroups: NavGroup<TabId>[] = [
  {
    label: "Adventure",
    items: [
      { id: "adventures", label: "Library" },
      { id: "dashboard", label: "Dashboard" },
      { id: "play", label: "Play", emphasis: "primary" },
      { id: "chronicle", label: "Chronicle" },
    ],
  },
  {
    label: "Memory",
    items: [
      { id: "memoryInbox", label: "Inbox" },
      { id: "storyCards", label: "Story Cards" },
      { id: "brains", label: "Characters" },
      { id: "summary", label: "Summary" },
    ],
  },
  {
    label: "World",
    items: [
      { id: "components", label: "World Blocks" },
      { id: "autoCards", label: "Auto-Cards" },
    ],
  },
  {
    label: "Inspector",
    items: [
      { id: "context", label: "Context Preview" },
      { id: "triggers", label: "Automations" },
      { id: "importExport", label: "Import / Export" },
      { id: "settings", label: "Settings" },
    ],
  },
  { label: "Reference", items: [{ id: "help", label: "Documentation" }] },
];

const modalTabs = new Set<TabId>([
  "context",
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
  components: "World Blocks",
  storyCards: "Story Cards",
  brains: "Characters",
  autoCards: "Auto-Cards",
  triggers: "Automations",
  quests: "Quests",
  summary: "Story Summary",
  memoryInbox: "Memory Inbox",
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

  function openTab(tabId: TabId) {
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
    const next = {
      ...baseline,
      openingScene: setup.openingScene,
      components: [...baseline.components, ...setup.components],
      storyCards: setup.storyCards,
    };
    await saveAdventure(next);
    setAdventure(next);
    setModalTab(undefined);
    setActiveTab("play");
    await refreshAdventures();
  }

  async function loadDevelopmentAdventure() {
    const next = createDevelopmentAdventure();
    await saveAdventure(next);
    setAdventure(next);
    setContextResult(buildContext(next, { latestModelOutput: latestAssistantOutput(next) }));
    setModalTab(undefined);
    setActiveTab("play");
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
    setActiveTab("play");
  }

  async function duplicateAdventure(id: string) {
    const existing = await getAdventure(id);
    if (!existing) return;
    const copy = importAdventureJson(JSON.stringify(existing), true);
    await saveAdventure(copy);
    setAdventure(copy);
    setModalTab(undefined);
    setActiveTab("play");
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
      setActiveTab("play");
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
    await submitTurn("Continue.", "story");
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

  /**
   * Build the LLM payload for an incremental summary update.
   * Sends the current summary + only the messages not yet captured in it.
   * Capped at 60 new messages so the prompt stays manageable even at turn 3000.
   */
  function buildSummaryPayload(adventureState: Adventure): { messages: { role: "system" | "user"; content: string }[]; lastIndex: number } {
    const allMessages = adventureState.messages;
    const fromIndex = adventureState.rollingSummary.lastSummarizedMessageIndex ?? 0;
    const newMessages = allMessages.slice(fromIndex).slice(-60); // cap at 60 unseen messages
    const lastIndex = allMessages.length;

    const currentSummary = adventureState.rollingSummary.content?.trim();
    const newEventsText = newMessages.length
      ? newMessages.map((m) => `${m.role === "assistant" ? "Story" : "Player"}: ${m.content}`).join("\n\n")
      : "No new events.";

    const userContent = currentSummary
      ? `## Current Rolling Summary\n${currentSummary}\n\n## New Story Events\n${newEventsText}\n\nUpdate the rolling summary to incorporate these new events.`
      : `## Story So Far\n${newEventsText}\n\nCreate a concise rolling summary of these events.`;

    return {
      messages: [
        {
          role: "system",
          content:
            "You are a continuity keeper for an interactive fiction adventure. " +
            "Update the rolling summary to incorporate new story events. " +
            "Preserve all important facts: character states, relationships, world details, open plot threads, completed events. " +
            "Keep it focused and under 900 words. Write in past tense, third person.",
        },
        { role: "user", content: userContent },
      ],
      lastIndex,
    };
  }

  async function generateSummary() {
    if (!adventure || loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const { messages: summaryMessages, lastIndex } = buildSummaryPayload(adventure);
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
      const { messages: summaryMessages, lastIndex } = buildSummaryPayload(adventureState);
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
          cloudSyncSettings={cloudSyncSettings}
          cloudSyncStatus={cloudSyncStatus}
          onCloudSyncSettingsChange={setCloudSyncSettings}
          onPushCloudSync={pushCloudSync}
          onPullCloudSync={pullCloudSync}
          onLoadDevelopmentAdventure={loadDevelopmentAdventure}
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
            onOpenContext={() => openTab("context")}
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
            onOpenContext={() => openTab("context")}
            onRememberThis={rememberThis}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
          />
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          <h1>AI Story Teller</h1>
          {adventure && <p className="muted">{adventure.title}</p>}
        </div>
        <div className="header-meta">
          {adventure && <span className="status-pill">{saveStatus}</span>}
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setUiPreferences({ ...uiPreferences, darkMode: !uiPreferences.darkMode })}
          >
            {uiPreferences.darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <Sidebar groups={navGroups} activeItem={modalTab ?? activeTab} onChange={openTab} />

      <main className="main-content">
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
