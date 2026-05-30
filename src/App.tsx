import { useCallback, useEffect, useState } from "react";
import { adventureReducer } from "./state/adventureReducer";
import { saveAdventure } from "./db/adventureDb";
import { defaultCloudSyncSettings } from "./sync/githubSync";
import { defaultGitHubSaveSettings } from "./sync/githubSaves";
import { useGitHubSaves } from "./hooks/useGitHubSaves";
import { useGitHubSaveLoad } from "./hooks/useGitHubSaveLoad";
import { GitHubSaveConflictDialog } from "./components/GitHubSaveConflictDialog";
import { defaultModelConfig } from "./state/defaults";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useAdventureRuntime } from "./hooks/useAdventureRuntime";
import { useAdventureLibrary } from "./hooks/useAdventureLibrary";
import { useAdventureAutosave } from "./hooks/useAdventureAutosave";
import { useCloudSyncController } from "./hooks/useCloudSyncController";
import { getAdventureThumbnail, thumbnailMetadataPatch } from "./utils/adventureImages";
import type { Adventure, AdventureAction, CloudSyncSettings, ContextBuildResult, GitHubSaveSettings } from "./types/adventure";
import type { ProviderPreset, RuntimeProviderSettings, UiPreferences } from "./pages/pageTypes";
import { defaultUiPreferences } from "./pages/pageTypes";
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
import { CloudSavesPage } from "./pages/CloudSavesPage";

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
  | "cloudSaves"
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
  | "cloudSaves"
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
  { id: "cloudSaves", label: "Saves" },
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
  cloudSaves: "GitHub Saves",
  settings: "Settings",
  importExport: "Import / Export",
};

const providerInitial: RuntimeProviderSettings = {
  ...defaultModelConfig,
  apiKey: "",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("adventures");
  const [editorTab, setEditorTab] = useState<EditorTabId>("components");
  const [modalTab, setModalTab] = useState<TabId | undefined>();
  const [playPanelTab, setPlayPanelTab] = useState<EditorTabId | undefined>();
  const [navForceVisible, setNavForceVisible] = useState(false);
  const [adventure, setAdventure] = useState<Adventure | undefined>();
  const [contextResult, setContextResult] = useState<ContextBuildResult | undefined>();
  const [saveStatus, setSaveStatus] = useState("idle");
  const [providerPresets, setProviderPresets] = useLocalStorage<ProviderPreset[]>(
    "ai-story-teller-provider-presets",
    [],
  );
  const [activePresetId, setActivePresetId] = useLocalStorage<string>(
    "ai-story-teller-active-preset-id",
    "",
  );
  const [uiPreferences, setUiPreferences] = useLocalStorage<UiPreferences>(
    "ai-story-teller-ui-preferences",
    defaultUiPreferences,
  );
  const [cloudSyncSettings, setCloudSyncSettings] = useLocalStorage<CloudSyncSettings>(
    "ai-story-teller-cloud-sync-settings",
    defaultCloudSyncSettings,
  );
  const [gitHubSaveSettings, setGitHubSaveSettings] = useLocalStorage<GitHubSaveSettings>(
    "ai-story-teller-github-save-settings",
    defaultGitHubSaveSettings,
  );

  // Migrate old default font size (15) to new default (20) for existing users
  useEffect(() => {
    if (uiPreferences.storyFontSize <= 15) {
      setUiPreferences({ ...uiPreferences, storyFontSize: 20 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Migrate single provider settings key to presets array on first load
  useEffect(() => {
    if (providerPresets.length === 0) {
      const stored = localStorage.getItem("ai-story-teller-provider-settings");
      let base: RuntimeProviderSettings = providerInitial;
      if (stored) {
        try { base = { ...providerInitial, ...(JSON.parse(stored) as RuntimeProviderSettings) }; } catch { /* ignore */ }
      }
      const migrated: ProviderPreset = { ...base, id: "preset-default", label: "Default" };
      setProviderPresets([migrated]);
      setActivePresetId("preset-default");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", uiPreferences.darkMode);
    root.setAttribute("data-density", uiPreferences.density);
    root.style.setProperty("--story-font-size", `${uiPreferences.storyFontSize}px`);
    root.style.setProperty("--content-max-width", `${uiPreferences.maxContentWidth}px`);
    root.classList.toggle("hide-token-estimates", !uiPreferences.showTokenEstimates);
  }, [uiPreferences]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (playPanelTab) { setPlayPanelTab(undefined); return; }
        setModalTab(undefined);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [playPanelTab]);

  // Reset nav visibility each time the user enters the play tab
  useEffect(() => {
    if (activeTab !== "play") setNavForceVisible(false);
  }, [activeTab]);

  // Browser back/forward support
  useEffect(() => {
    history.replaceState({ tab: "adventures" }, "");
    function onPopState(event: PopStateEvent) {
      const tab = event.state?.tab as TabId | undefined;
      if (tab) {
        setActiveTab(tab);
        setModalTab(undefined);
        setPlayPanelTab(undefined);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigateTo(tabId: TabId) {
    setActiveTab(tabId);
    try { history.pushState({ tab: tabId }, ""); } catch { /* iOS Safari SecurityError if push limit hit */ }
  }

  const dispatch = useCallback((action: AdventureAction) => {
    setAdventure((current) => (current ? adventureReducer(current, action) : current));
  }, []);

  function openEditor(tabId: EditorTabId = "components") {
    setModalTab(undefined);
    setPlayPanelTab(undefined);
    setEditorTab(tabId);
    navigateTo("edit");
  }

  function openTab(tabId: TabId) {
    if (tabId !== "play") setPlayPanelTab(undefined);
    if (adventure && editorTabIds.has(tabId)) {
      openEditor(tabId as EditorTabId);
      return;
    }
    if (["adventures", "dashboard", "play", "edit", "settings", "help"].includes(tabId)) {
      setModalTab(undefined);
      navigateTo(tabId);
      return;
    }
    if (adventure && modalTabs.has(tabId)) {
      setModalTab(tabId);
      return;
    }
    setModalTab(undefined);
    navigateTo(tabId);
  }

  const activePreset: RuntimeProviderSettings =
    providerPresets.find((p) => p.id === activePresetId) ??
    providerPresets[0] ??
    providerInitial;

  const library = useAdventureLibrary(
    setAdventure,
    setContextResult,
    (tab) => navigateTo(tab as TabId),
    () => setModalTab(undefined),
    (msg) => console.error(msg),
  );

  useAdventureAutosave(adventure, setSaveStatus, () => void library.refreshAdventures());

  const runtime = useAdventureRuntime(
    adventure,
    setAdventure,
    activePreset,
    setSaveStatus,
    setContextResult,
    openTab,
    library.refreshAdventures,
  );

  async function saveSyncedAdventures(syncedAdventures: Adventure[]) {
    for (const synced of syncedAdventures) {
      await saveAdventure(synced);
    }
    setAdventure((current) => {
      if (!current) return current;
      const syncedCurrent = syncedAdventures.find((s) => s.id === current.id);
      return syncedCurrent && syncedCurrent.updatedAt.localeCompare(current.updatedAt) >= 0 ? syncedCurrent : current;
    });
    await library.refreshAdventures();
  }

  const { cloudSyncStatus, pushCloudSync, pullCloudSync } = useCloudSyncController(
    cloudSyncSettings,
    library.allSavedAdventures,
    saveSyncedAdventures,
  );

  const gitHubSaves = useGitHubSaves(cloudSyncSettings, gitHubSaveSettings);

  useEffect(() => {
    if (!adventure || !gitHubSaveSettings.autoSaveEnabled) return;
    void gitHubSaves.autoSaveIfDue(adventure);
    // intentional: fire only when the turn counter increments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventure?.activeState.turn]);

  const applyGitHubSave = useCallback(async (loaded: Adventure) => {
    await saveAdventure(loaded);
    setAdventure(loaded);
    await library.refreshAdventures();
    setModalTab(undefined);
    navigateTo("dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.refreshAdventures]); // setters and navigateTo are stable

  const gitHubSaveLoad = useGitHubSaveLoad(gitHubSaves.loadSave, applyGitHubSave);

  useEffect(() => {
    gitHubSaveLoad.clearLoadError();
  // clear error whenever the user navigates away from any GitHub saves screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modalTab]);

  function renderAdventureTool(tabId: TabId) {
    if (!adventure) return null;
    const common = { adventure, dispatch };
    switch (tabId) {
      case "chronicle":
        return <ChroniclePage {...common} />;
      case "context":
        return <ContextPreviewPage {...common} contextResult={contextResult} onBuildContext={runtime.buildPreview} providerConfig={runtime.activeProviderConfig} />;
      case "components":
        return <ComponentsPage {...common} loading={runtime.loading} onSuggestPlotUpdates={runtime.suggestPlotUpdates} />;
      case "storyCards":
        return <StoryCardsPage {...common} loading={runtime.loading} onSuggestCardUpdates={runtime.suggestCardUpdates} />;
      case "brains":
        return <BrainsPage {...common} loading={runtime.loading} onUpdateBrainNow={runtime.updateBrainNow} />;
      case "autoCards":
        return <AutoCardsPage {...common} loading={runtime.loading} onGenerateAutoCardNow={runtime.generateAutoCardNow} />;
      case "triggers":
        return <TriggersPage {...common} />;
      case "quests":
        return <QuestsPage {...common} />;
      case "summary":
        return <SummaryPage {...common} onGenerateDurableSummary={runtime.generateDurableSummary} onGenerateSceneState={runtime.generateSceneState} />;
      case "memoryInbox":
        return <MemoryInboxPage {...common} />;
      case "cloudSaves":
        return (
          <CloudSavesPage
            adventure={adventure}
            gitHubSaveSettings={gitHubSaveSettings}
            onGitHubSaveSettingsChange={setGitHubSaveSettings}
            saveSlots={gitHubSaves.saveSlots}
            savesStatus={gitHubSaves.savesStatus}
            loadingSlotId={gitHubSaveLoad.loadingSlotId}
            loadError={gitHubSaveLoad.loadError}
            onDismissError={gitHubSaveLoad.clearLoadError}
            onListSaves={() => void gitHubSaves.listSaves()}
            onSaveNow={() => void gitHubSaves.saveNow(adventure)}
            onLoadSave={(slot) => void gitHubSaveLoad.initiateLoad(slot)}
            onDeleteSave={(slot) => void gitHubSaves.deleteSave(slot)}
          />
        );
      case "settings":
        return (
          <SettingsPage
            adventure={adventure}
            dispatch={dispatch}
            providerPresets={providerPresets}
            activePresetId={activePresetId}
            onProviderPresetsChange={setProviderPresets}
            onSelectPreset={setActivePresetId}
            uiPreferences={uiPreferences}
            onUiPreferencesChange={setUiPreferences}
            cloudSyncSettings={cloudSyncSettings}
            cloudSyncStatus={cloudSyncStatus}
            onCloudSyncSettingsChange={setCloudSyncSettings}
            onPushCloudSync={pushCloudSync}
            onPullCloudSync={pullCloudSync}
            onLoadDevelopmentAdventure={library.loadDevelopmentAdventure}
          />
        );
      case "importExport":
        return (
          <ImportExportPage
            {...common}
            onImportAdventure={library.importAdventure}
            onCreateAdventureFromImport={library.createAdventureFromImport}
            onOpenImportedAdventure={() => {
              setModalTab(undefined);
              navigateTo("play");
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
          adventures={library.adventures}
          currentAdventure={adventure}
          onCreate={library.createAdventure}
          onOpen={library.openAdventure}
          onOpenEdit={async (id) => { await library.openAdventure(id); openEditor(); }}
          onCreateAdventureFromImport={library.createAdventureFromImport}
          onDuplicate={library.duplicateAdventure}
          onDelete={(id) => library.removeAdventure(id, adventure?.id)}
          saveSlots={gitHubSaves.saveSlots}
          savesStatus={gitHubSaves.savesStatus}
          loadingSlotId={gitHubSaveLoad.loadingSlotId}
          loadError={gitHubSaveLoad.loadError}
          onDismissError={gitHubSaveLoad.clearLoadError}
          onListSaves={() => void gitHubSaves.listSaves()}
          onLoadSave={(slot) => void gitHubSaveLoad.initiateLoad(slot)}
          onDeleteSave={(slot) => void gitHubSaves.deleteSave(slot)}
          providerConfig={runtime.activeProviderConfig}
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
          providerSettings={runtime.activeProviderConfig}
          onProviderSettingsChange={setProviderSettings}
          uiPreferences={uiPreferences}
          onUiPreferencesChange={setUiPreferences}
          cloudSyncSettings={cloudSyncSettings}
          cloudSyncStatus={cloudSyncStatus}
          onCloudSyncSettingsChange={setCloudSyncSettings}
          onPushCloudSync={pushCloudSync}
          onPullCloudSync={pullCloudSync}
          onLoadDevelopmentAdventure={library.loadDevelopmentAdventure}
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
            loading={runtime.loading}
            error={runtime.error}
            onDismissError={runtime.clearError}
            saveStatus={saveStatus}
            onSubmitTurn={runtime.submitTurn}
            onContinue={runtime.continueTurn}
            onRegenerate={runtime.regenerateLastResponse}
            onBuildContext={runtime.buildPreview}
            onOpenContext={() => openEditor("context")}
            onRememberThis={runtime.rememberThis}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
            onOpenPlayTool={(tabId) => setPlayPanelTab(tabId as EditorTabId)}
            playPanelContent={playPanelTab ? renderAdventureTool(playPanelTab) : undefined}
            playPanelTitle={playPanelTab ? (modalTitles[playPanelTab as TabId] ?? "Tool") : undefined}
            onClosePlayPanel={() => setPlayPanelTab(undefined)}
            providerPresets={providerPresets}
            activePresetId={activePresetId}
            onSelectPreset={setActivePresetId}
          />
        );
      case "dashboard":
        return (
          <DashboardPage
            {...common}
            contextResult={contextResult}
            loading={runtime.loading}
            error={runtime.error}
            saveStatus={saveStatus}
            onSubmitTurn={runtime.submitTurn}
            onContinue={runtime.continueTurn}
            onRegenerate={runtime.regenerateLastResponse}
            onBuildContext={runtime.buildPreview}
            onOpenContext={() => openEditor("context")}
            onRememberThis={runtime.rememberThis}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
          />
        );
      case "edit":
        return (
          <section className="page editor-workspace">
            <header className="editor-header panel">
              <div>
                <p className="eyebrow">Edit Adventure</p>
                <input
                  className="editor-title-input"
                  value={adventure.title}
                  onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
                  placeholder="Adventure title"
                />
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
  const navHidden = activeTab === "play" && !navForceVisible;

  return (
    <div className={`app-shell${navHidden ? " nav-hidden" : ""}`}>
      {navHidden && (
        <button type="button" className="nav-show-btn" onClick={() => setNavForceVisible(true)} title="Show navigation">
          ≡ nav
        </button>
      )}
      <header className="app-header">
        <div className="app-title">
          <button type="button" className="app-title-button" onClick={() => openTab("adventures")}>
            <span className="app-brand">AI Story Teller</span>
            {adventure && activeTab === "play" && <span className="muted">{adventure.title}</span>}
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
          {activeTab === "play" && (
            <button type="button" className="theme-toggle" onClick={() => setNavForceVisible(false)} title="Hide navigation bar">
              ↑ Hide
            </button>
          )}
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
            title="Toggle dark mode"
            onClick={() => setUiPreferences({ ...uiPreferences, darkMode: !uiPreferences.darkMode })}
          >
            {uiPreferences.darkMode ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <main className={`main-content${activeTab === "play" ? " play-content" : ""}${activeTab === "edit" ? " edit-content" : ""}`}>
        {runtime.error && activeTab !== "play" && (
          <div className="error-box error-dismissible">
            <span>{runtime.error}</span>
            <button type="button" className="error-dismiss" aria-label="Dismiss error" onClick={runtime.clearError}>×</button>
          </div>
        )}
        {page}
      </main>

      {gitHubSaveLoad.pendingConflict && (
        <GitHubSaveConflictDialog
          {...gitHubSaveLoad.pendingConflict}
          onConfirm={() => void gitHubSaveLoad.confirmOverwrite()}
          onCancel={gitHubSaveLoad.cancelOverwrite}
        />
      )}

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
