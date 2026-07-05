import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { Adventure, AdventureAction, CloudSyncSettings, ContextBuildResult, GitHubSaveSettings } from "./types/adventure";
import type { GlobalAdventureSettings, ProviderPreset, RuntimeProviderSettings, UiPreferences } from "./pages/pageTypes";
import { defaultGlobalAdventureSettings, defaultUiPreferences } from "./pages/pageTypes";
import { AdventuresPage } from "./pages/AdventuresPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PlayPage } from "./pages/PlayPage";
import { ChroniclePage } from "./pages/ChroniclePage";
import { ContextPreviewPage } from "./pages/ContextPreviewPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { StoryCardsPage } from "./pages/StoryCardsPage";
import { BrainsPage } from "./pages/BrainsPage";

import { TriggersPage } from "./pages/TriggersPage";
import { MemoryInboxPage } from "./pages/MemoryInboxPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { HelpPage } from "./pages/HelpPage";
import { CloudSavesPage } from "./pages/CloudSavesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ExplorePage } from "./pages/ExplorePage";
import { AdminConsolePage } from "./pages/AdminConsolePage";
import { WelcomePage } from "./pages/WelcomePage";
import { useActionFeedback } from "./components/ActionFeedback";
import { premadeAdventures, type PremadeAdventureId } from "./dev/premadeAdventures";
import { AdventureThumbnailPicker } from "./components/AdventureThumbnail";
import { getAdventureThumbnail, thumbnailMetadataPatch } from "./utils/adventureImages";
import { applyConfiguredBackendDefault, defaultRuntimeConfig, normalizeRuntimeConfig, type RuntimeConfig } from "./runtime/runtimeConfig";
import {
  createCachedBackendAdventureStore,
  createBackendContextPreviewSource,
  createBackendTurnRunner,
  createLocalAdventureStore,
  createUnavailableAdventureStore,
} from "./runtime/adventureStore";
import {
  createBackendInvite,
  createBackendScenario,
  createBackendScenarioRevision,
  createBackendAdminRestriction,
  disableBackendInvite,
  forkBackendScenarioRevision,
  importAndOpenBackendAdventure,
  listBackendAdventureSnapshots,
  loadBackendAdminConsole,
  loadBackendExploreScenarios,
  loadBackendProfile,
  loadBackendPublicProfile,
  loadBackendSession,
  loginBackendPassword,
  publishBackendScenarioRevision,
  restoreBackendAdventureSnapshot,
  saveBackendPlatformSettings,
  signupBackendPassword,
  startBackendGoogleOAuth,
  updateBackendAdminSafetyEventStatus,
  updateBackendAdminUserStatus,
  verifyBackendEmail,
  type BackendAdminConsoleData,
  type BackendExploreScenarioSummary,
  type BackendImportRequest,
  type BackendProfileSummary,
  type BackendPublicProfileSummary,
  type BackendSessionState,
} from "./runtime/backendApi";

type TabId =
  | "adventures"
  | "explore"
  | "profile"
  | "admin"
  | "dashboard"
  | "play"
  | "edit"
  | "chronicle"
  | "context"
  | "components"
  | "storyCards"
  | "brains"
  | "triggers"
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
  | "chronicle"
  | "triggers"
  | "context"
  | "cloudSaves"
  | "importExport";

type BackendModelMode = "platform" | "personal";

const editorTabs: Array<{ id: EditorTabId; label: string; badge?: "memory" }> = [
  { id: "components", label: "Plot" },
  { id: "storyCards", label: "Story Cards" },
  { id: "brains", label: "Characters" },
  { id: "memoryInbox", label: "Memory", badge: "memory" },
  { id: "chronicle", label: "Chronicle" },
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
  "triggers",
  "memoryInbox",
  "settings",
  "importExport",
]);

const modalTitles: Partial<Record<TabId, string>> = {
  context: "Context",
  chronicle: "Adventure Chronicle",
  components: "Plot",
  storyCards: "Story Cards",
  brains: "Characters",
  triggers: "Automations",
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
  const { confirmAction, notify } = useActionFeedback();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [editorTab, setEditorTab] = useState<EditorTabId>("components");
  const [modalTab, setModalTab] = useState<TabId | undefined>();
  const [playPanelTab, setPlayPanelTab] = useState<EditorTabId | undefined>();
  const [navForceVisible, setNavForceVisible] = useState(false);
  const [openAdventureNavCollapsed, setOpenAdventureNavCollapsed] = useState(false);
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
  const [globalAdventureSettings, setGlobalAdventureSettings] = useLocalStorage<GlobalAdventureSettings>(
    "ai-story-teller-adventure-settings",
    defaultGlobalAdventureSettings,
  );
  const [runtimeConfig, setRuntimeConfig] = useLocalStorage<RuntimeConfig>(
    "ai-story-teller-runtime-config",
    defaultRuntimeConfig,
  );
  const [backendSession, setBackendSession] = useLocalStorage<BackendSessionState | null>(
    "ai-story-teller-backend-session",
    null,
  );
  const [backendModelMode, setBackendModelMode] = useLocalStorage<BackendModelMode>(
    "ai-story-teller-backend-model-mode",
    "platform",
  );
  const [backendProfile, setBackendProfile] = useState<BackendProfileSummary | undefined>();
  const [backendPublicProfile, setBackendPublicProfile] = useState<BackendPublicProfileSummary | undefined>();
  const [backendPublicProfileUserId, setBackendPublicProfileUserId] = useState<string | null>(null);
  const [backendProfileStatus, setBackendProfileStatus] = useState("");
  const [backendExploreScenarios, setBackendExploreScenarios] = useState<BackendExploreScenarioSummary[]>([]);
  const [backendExploreStatus, setBackendExploreStatus] = useState("");
  const [backendAdminConsole, setBackendAdminConsole] = useState<BackendAdminConsoleData | undefined>();
  const [backendAdminStatus, setBackendAdminStatus] = useState("");
  const normalizedRuntimeConfig = useMemo(() => applyConfiguredBackendDefault(runtimeConfig), [runtimeConfig]);
  const backendMode = normalizedRuntimeConfig.mode !== "local";
  const accountReady = Boolean(backendSession?.sessionToken);
  const backendReady = backendMode && accountReady;
  const isBackendAdmin = backendMode && backendSession?.user.role === "admin";
  const hideBackendUserDeveloperControls = backendMode && !isBackendAdmin;
  const activePreset: RuntimeProviderSettings =
    providerPresets.find((p) => p.id === activePresetId) ??
    providerPresets[0] ??
    providerInitial;
  const localAdventureStore = useMemo(() => createLocalAdventureStore(), []);
  const unavailableBackendStore = useMemo(
    () => createUnavailableAdventureStore("Sign in to the local backend before using backend adventures."),
    [],
  );
  const backendAdventureStore = useMemo(
    () => backendReady && backendSession
      ? createCachedBackendAdventureStore(normalizedRuntimeConfig, backendSession.sessionToken, backendSession.user.id)
      : undefined,
    [backendReady, backendSession, normalizedRuntimeConfig],
  );
  const adventureStore = !accountReady
    ? unavailableBackendStore
    : backendMode
      ? (backendAdventureStore ?? unavailableBackendStore)
      : localAdventureStore;
  const storageLabel = !accountReady ? "your signed-in account" : backendMode ? "the local backend" : "IndexedDB";
  const backendTurnRunner = useMemo(
    () => backendReady && backendSession
      ? createBackendTurnRunner(
        normalizedRuntimeConfig,
        backendSession.sessionToken,
        backendModelMode === "personal" ? activePreset : undefined,
      )
      : undefined,
    [activePreset, backendModelMode, backendReady, backendSession, normalizedRuntimeConfig],
  );
  const backendContextPreview = useMemo(
    () => backendReady && backendSession
      ? createBackendContextPreviewSource(normalizedRuntimeConfig, backendSession.sessionToken)
      : undefined,
    [backendReady, backendSession, normalizedRuntimeConfig],
  );
  const reportLibraryError = useCallback((msg: string) => console.error(msg), []);

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
    if (!window.location.hash.includes("backendSession=")) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const rawSession = params.get("backendSession");
    if (!rawSession) return;
    try {
      setBackendPublicProfileUserId(null);
      setBackendPublicProfile(undefined);
      setBackendSession(JSON.parse(rawSession) as BackendSessionState);
      history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
    } catch {
      // Ignore malformed OAuth callback fragments.
    }
  }, [setBackendSession]);

  useEffect(() => {
    if (backendSession || normalizedRuntimeConfig.mode !== "local") return;
    setRuntimeConfig({ ...normalizedRuntimeConfig, mode: "backendLocal" });
  }, [backendSession, normalizedRuntimeConfig, setRuntimeConfig]);

  useEffect(() => {
    if (normalizedRuntimeConfig.mode === "local" || !backendSession?.sessionToken) return;
    let cancelled = false;
    void loadBackendSession(normalizedRuntimeConfig, backendSession)
      .then((session) => {
        if (!cancelled) setBackendSession(session);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "";
        if (!cancelled && /unauthorized|account is not active/i.test(message)) setBackendSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [backendSession?.sessionToken, normalizedRuntimeConfig, setBackendSession]);

  useEffect(() => {
    const migrated = applyConfiguredBackendDefault(runtimeConfig);
    if (
      migrated.mode !== normalizeRuntimeConfig(runtimeConfig).mode
      || migrated.apiBaseUrl !== normalizeRuntimeConfig(runtimeConfig).apiBaseUrl
    ) {
      setRuntimeConfig(migrated);
    }
  }, [runtimeConfig, setRuntimeConfig]);

  useEffect(() => {
    if (providerPresets.length === 0) return;
    let changed = false;
    const hydrated = providerPresets.map((preset) => {
      if (preset.promptCaching !== undefined) return preset;
      changed = true;
      return { ...preset, promptCaching: defaultModelConfig.promptCaching };
    });
    if (changed) setProviderPresets(hydrated);
  }, [providerPresets, setProviderPresets]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", uiPreferences.darkMode);
    root.setAttribute("data-density", uiPreferences.density);
    root.style.setProperty("--dark-text-color", uiPreferences.darkModeTextColor || defaultUiPreferences.darkModeTextColor);
    root.style.setProperty("--story-font-size", `${uiPreferences.storyFontSize}px`);
    root.style.setProperty("--story-content-width", `${uiPreferences.storyContentWidth}px`);
    root.style.setProperty("--story-content-margin", uiPreferences.storyContentAlign === "left" ? "0 auto 0 0" : uiPreferences.storyContentAlign === "right" ? "0 0 0 auto" : "0 auto");
    root.style.setProperty("--story-pane-margin", uiPreferences.storyContentAlign === "left" ? "0 auto 0 24px" : uiPreferences.storyContentAlign === "right" ? "0 24px 0 auto" : "0 auto");
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

  useEffect(() => {
    setOpenAdventureNavCollapsed(false);
  }, [adventure?.id]);

  // Browser back/forward support
  useEffect(() => {
    history.replaceState({ tab: "profile" }, "");
    function onPopState(event: PopStateEvent) {
      const tab = event.state?.tab as TabId | undefined;
      if (tab) {
        setActiveTab(tab === "adventures" ? "profile" : tab);
        setModalTab(undefined);
        setPlayPanelTab(undefined);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function navigateTo(tabId: TabId) {
    const destination = tabId === "adventures" ? "profile" : tabId;
    setActiveTab(destination);
    try { history.pushState({ tab: destination }, ""); } catch { /* iOS Safari SecurityError if push limit hit */ }
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
    if (["adventures", "explore", "profile", "admin", "dashboard", "play", "edit", "settings", "help"].includes(tabId)) {
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

  const library = useAdventureLibrary(
    adventureStore,
    storageLabel,
    setAdventure,
    setContextResult,
    (tab) => navigateTo(tab as TabId),
    () => setModalTab(undefined),
    reportLibraryError,
    backendReady && backendSession
      ? (text) => importAndOpenBackendAdventure(normalizedRuntimeConfig, backendSession, { sourceType: "aist", text })
      : undefined,
  );

  const activeStoreHasAdventure = !adventure || library.adventures.some((entry) => entry.id === adventure.id);
  useAdventureAutosave(activeStoreHasAdventure ? adventure : undefined, adventureStore, setSaveStatus, () => void library.refreshAdventures());

  const runtime = useAdventureRuntime(
    adventure,
    setAdventure,
    activePreset,
    adventureStore,
    setSaveStatus,
    setContextResult,
    openTab,
    library.refreshAdventures,
    globalAdventureSettings.memoryDetectionSettings,
    backendTurnRunner,
    backendContextPreview,
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

  async function allLocalSavedAdventures(): Promise<Adventure[]> {
    const summaries = await localAdventureStore.list();
    const loaded = await Promise.all(summaries.map((summary) => localAdventureStore.get(summary.id)));
    return loaded.filter((entry): entry is Adventure => Boolean(entry));
  }

  const { cloudSyncStatus, pushCloudSync, pullCloudSync } = useCloudSyncController(
    cloudSyncSettings,
    allLocalSavedAdventures,
    saveSyncedAdventures,
  );

  const gitHubSaves = useGitHubSaves(cloudSyncSettings, gitHubSaveSettings);

  useEffect(() => {
    if (backendMode) return;
    if (!adventure || !adventure.autoSaveEnabled) return;
    void gitHubSaves.autoSaveIfDue(adventure);
    // intentional: fire only when the turn counter increments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventure?.activeState.turn]);

  useEffect(() => {
    const id = setInterval(() => {
      if (backendMode) return;
      const current = adventure;
      if (current) void gitHubSaves.timedAutoSave(current);
    }, 60 * 1000); // check every minute; timedAutoSave gates on the adventure's configured interval
    return () => clearInterval(id);
    // intentional: stable interval; timedAutoSave checks the time gate internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyGitHubSave = useCallback(async (loaded: Adventure) => {
    if (backendMode) return;
    await saveAdventure(loaded);
    setAdventure(loaded);
    await library.refreshAdventures();
    setModalTab(undefined);
    navigateTo("dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendMode, library.refreshAdventures]); // setters and navigateTo are stable

  const gitHubSaveLoad = useGitHubSaveLoad(gitHubSaves.loadSave, applyGitHubSave);

  const handlePullLatest = useCallback(async () => {
    if (!adventure) return;
    const loaded = await gitHubSaves.pullLatestForAdventure(adventure.id);
    if (loaded) await applyGitHubSave(loaded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventure?.id, gitHubSaves.pullLatestForAdventure, applyGitHubSave]);

  useEffect(() => {
    gitHubSaveLoad.clearLoadError();
  // clear error whenever the user navigates away from any GitHub saves screen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, modalTab]);

  const refreshBackendProfile = useCallback(async () => {
    if (!backendReady || !backendSession) {
      setBackendProfile(undefined);
      setBackendProfileStatus("");
      return;
    }
    setBackendProfileStatus("Loading profile...");
    try {
      const profile = await loadBackendProfile(normalizedRuntimeConfig, backendSession);
      setBackendProfile(profile);
      setBackendProfileStatus("");
    } catch (error) {
      setBackendProfileStatus(error instanceof Error ? error.message : "Profile refresh failed.");
    }
  }, [backendReady, backendSession, normalizedRuntimeConfig]);

  const refreshBackendPublicProfile = useCallback(async (userId: string) => {
    if (!backendReady || !backendSession) {
      setBackendPublicProfile(undefined);
      setBackendProfileStatus("");
      return;
    }
    if (userId === backendSession.user.id) {
      setBackendPublicProfileUserId(null);
      setBackendPublicProfile(undefined);
      await refreshBackendProfile();
      return;
    }
    setBackendProfileStatus("Loading profile...");
    try {
      const profile = await loadBackendPublicProfile(normalizedRuntimeConfig, backendSession, userId);
      setBackendPublicProfile(profile);
      setBackendProfileStatus("");
    } catch (error) {
      setBackendPublicProfile(undefined);
      setBackendProfileStatus(error instanceof Error ? error.message : "Profile refresh failed.");
    }
  }, [backendReady, backendSession, normalizedRuntimeConfig, refreshBackendProfile]);

  const openBackendPublicProfile = useCallback(async (userId: string) => {
    if (!backendReady || !backendSession) return;
    if (userId === backendSession.user.id) {
      setBackendPublicProfileUserId(null);
      setBackendPublicProfile(undefined);
    } else {
      setBackendPublicProfileUserId(userId);
      setBackendPublicProfile(undefined);
    }
    navigateTo("profile");
  }, [backendReady, backendSession]);

  const refreshBackendExploreScenarios = useCallback(async () => {
    if (!backendReady || !backendSession) {
      setBackendExploreScenarios([]);
      setBackendExploreStatus("");
      return;
    }
    setBackendExploreStatus("Loading scenarios...");
    try {
      const result = await loadBackendExploreScenarios(normalizedRuntimeConfig, backendSession);
      setBackendExploreScenarios(result.scenarios);
      setBackendExploreStatus("");
    } catch (error) {
      setBackendExploreStatus(error instanceof Error ? error.message : "Explore refresh failed.");
    }
  }, [backendReady, backendSession, normalizedRuntimeConfig]);

  const refreshBackendAdminConsole = useCallback(async () => {
    if (!backendReady || !backendSession || backendSession.user.role !== "admin") {
      setBackendAdminConsole(undefined);
      setBackendAdminStatus("");
      return;
    }
    setBackendAdminStatus("Loading admin console...");
    try {
      const result = await loadBackendAdminConsole(normalizedRuntimeConfig, backendSession);
      setBackendAdminConsole(result);
      setBackendAdminStatus("");
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "Admin console refresh failed.");
    }
  }, [backendReady, backendSession, normalizedRuntimeConfig]);

  const setBackendAdminUserStatus = useCallback(async (userId: string, status: "pending_verification" | "active" | "disabled") => {
    if (!backendSession || backendSession.user.role !== "admin") throw new Error("Admin access is required.");
    setBackendAdminStatus("Saving user status...");
    try {
      const result = await updateBackendAdminUserStatus(normalizedRuntimeConfig, backendSession, userId, status);
      setBackendAdminConsole(result);
      setBackendAdminStatus("User status updated.");
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "User status update failed.");
      throw error;
    }
  }, [backendSession, normalizedRuntimeConfig]);

  const createBackendAdminUserRestriction = useCallback(async (
    userId: string,
    input: {
      level: "none" | "watched" | "restricted" | "generation_hold" | "banned";
      reason: string;
      sharingDisabled?: boolean;
      generationDisabled?: boolean;
      contextTokenCap?: number;
    },
  ) => {
    if (!backendSession || backendSession.user.role !== "admin") throw new Error("Admin access is required.");
    setBackendAdminStatus("Applying restriction...");
    try {
      const result = await createBackendAdminRestriction(normalizedRuntimeConfig, backendSession, userId, input);
      setBackendAdminConsole(result);
      setBackendAdminStatus("Restriction applied.");
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "Restriction update failed.");
      throw error;
    }
  }, [backendSession, normalizedRuntimeConfig]);

  const setBackendAdminSafetyEventStatus = useCallback(async (
    eventId: string,
    status: "open" | "reviewed" | "dismissed",
  ) => {
    if (!backendSession || backendSession.user.role !== "admin") throw new Error("Admin access is required.");
    setBackendAdminStatus("Saving safety event...");
    try {
      const result = await updateBackendAdminSafetyEventStatus(normalizedRuntimeConfig, backendSession, eventId, status);
      setBackendAdminConsole(result);
      setBackendAdminStatus("Safety event updated.");
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "Safety event update failed.");
      throw error;
    }
  }, [backendSession, normalizedRuntimeConfig]);

  const createBackendAdminInviteLink = useCallback(async (input: { note?: string; maxUses?: number; expiresInDays?: number }) => {
    if (!backendSession || backendSession.user.role !== "admin") throw new Error("Admin access is required.");
    setBackendAdminStatus("Creating invite...");
    try {
      const result = await createBackendInvite(normalizedRuntimeConfig, backendSession, input);
      const consoleData = await loadBackendAdminConsole(normalizedRuntimeConfig, backendSession);
      setBackendAdminConsole(consoleData);
      setBackendAdminStatus("Invite created.");
      return { token: result.token };
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "Invite creation failed.");
      throw error;
    }
  }, [backendSession, normalizedRuntimeConfig]);

  const disableBackendAdminInviteLink = useCallback(async (inviteId: string) => {
    if (!backendSession || backendSession.user.role !== "admin") throw new Error("Admin access is required.");
    setBackendAdminStatus("Disabling invite...");
    try {
      const result = await disableBackendInvite(normalizedRuntimeConfig, backendSession, inviteId);
      setBackendAdminConsole(result);
      setBackendAdminStatus("Invite disabled.");
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "Invite disable failed.");
      throw error;
    }
  }, [backendSession, normalizedRuntimeConfig]);

  const saveBackendAdminPlatformSettings = useCallback(async (settings: Parameters<typeof saveBackendPlatformSettings>[2]) => {
    if (!backendSession || backendSession.user.role !== "admin") throw new Error("Admin access is required.");
    setBackendAdminStatus("Saving platform settings...");
    try {
      const result = await saveBackendPlatformSettings(normalizedRuntimeConfig, backendSession, settings);
      setBackendAdminConsole((current) => current ? { ...current, platformSettings: result } : current);
      setBackendAdminStatus("Platform settings saved.");
      return result;
    } catch (error) {
      setBackendAdminStatus(error instanceof Error ? error.message : "Platform settings save failed.");
      throw error;
    }
  }, [backendSession, normalizedRuntimeConfig]);

  useEffect(() => {
    if (!backendReady || !backendSession) {
      setBackendProfile(undefined);
      setBackendPublicProfile(undefined);
      setBackendPublicProfileUserId(null);
      setBackendExploreScenarios([]);
      setBackendAdminConsole(undefined);
      return;
    }
    if (activeTab === "profile") {
      if (backendPublicProfileUserId && backendPublicProfileUserId !== backendSession.user.id) {
        void refreshBackendPublicProfile(backendPublicProfileUserId);
      } else {
        void refreshBackendProfile();
      }
    }
    if (activeTab === "explore") void refreshBackendExploreScenarios();
    if (activeTab === "admin") void refreshBackendAdminConsole();
  }, [
    activeTab,
    backendPublicProfileUserId,
    backendReady,
    backendSession,
    refreshBackendAdminConsole,
    refreshBackendExploreScenarios,
    refreshBackendProfile,
    refreshBackendPublicProfile,
  ]);

  async function importToBackend(input: BackendImportRequest) {
    if (!backendSession) throw new Error("Sign in to the local backend before importing.");
    notify("Importing adventure to backend...", { type: "info" });
    const next = await importAndOpenBackendAdventure(normalizedRuntimeConfig, backendSession, input);
    setAdventure(next);
    setContextResult(undefined);
    setModalTab(undefined);
    navigateTo("dashboard");
    await library.refreshAdventures();
    await refreshBackendProfile();
    notify("Backend adventure imported.", { type: "success" });
    return next;
  }

  async function publishAdventureScenario(adventureId: string) {
    if (!backendSession) throw new Error("Sign in to the local backend before publishing.");
    try {
      const source = adventure?.id === adventureId ? adventure : await adventureStore.get(adventureId);
      if (!source) throw new Error("Adventure could not be loaded for publishing.");
      const confirmed = await confirmAction({
        title: "Publish scenario?",
        message: `Publish "${source.title}" to Explore? This shares the reusable setup, not the private transcript or runtime state.`,
        confirmLabel: "Publish",
      });
      if (!confirmed) return undefined;
      setBackendProfileStatus("Publishing scenario...");
      notify("Publishing scenario...", { type: "info" });
      const scenario = await createBackendScenario(normalizedRuntimeConfig, backendSession, {
        title: source.title,
        description: "Scenario draft created from a backend adventure.",
        sourceAdventureId: source.id,
      });
      const revision = await createBackendScenarioRevision(normalizedRuntimeConfig, backendSession, scenario.id, {
        title: source.title,
        description: "Reusable scenario setup created from an adventure. Transcript and private runtime state are excluded.",
        content: {
          schemaVersion: 1,
          title: source.title,
          openingScene: source.openingScene,
          components: source.components,
          storyCards: source.storyCards,
          brains: source.brains,
          triggerRules: source.triggerRules,
          thumbnailImage: getAdventureThumbnail(source),
        },
      });
      const published = await publishBackendScenarioRevision(normalizedRuntimeConfig, backendSession, revision.id);
      await refreshBackendProfile();
      await refreshBackendExploreScenarios();
      setBackendProfileStatus(`Published "${source.title}" to Explore.`);
      notify(`Published "${source.title}" to Explore.`, { type: "success" });
      return published;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scenario publish failed.";
      setBackendProfileStatus(message);
      notify(message, { type: "error" });
      throw error;
    }
  }

  async function publishScenarioRevisionFromProfile(revisionId: string) {
    if (!backendSession) throw new Error("Sign in to the local backend before publishing.");
    const confirmed = await confirmAction({
      title: "Publish scenario revision?",
      message: "Publish this latest scenario revision to Explore?",
      confirmLabel: "Publish",
    });
    if (!confirmed) return undefined;
    setBackendProfileStatus("Publishing scenario...");
    notify("Publishing scenario revision...", { type: "info" });
    try {
      const published = await publishBackendScenarioRevision(normalizedRuntimeConfig, backendSession, revisionId);
      await refreshBackendProfile();
      await refreshBackendExploreScenarios();
      setBackendProfileStatus("Published scenario to Explore.");
      notify("Published scenario to Explore.", { type: "success" });
      return published;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scenario publish failed.";
      setBackendProfileStatus(message);
      notify(message, { type: "error" });
      throw error;
    }
  }

  async function startBackendExploreScenario(revisionId: string) {
    if (!backendSession) throw new Error("Sign in to the local backend before starting a shared scenario.");
    setBackendExploreStatus("Starting scenario...");
    notify("Starting shared scenario...", { type: "info" });
    try {
      const next = await forkBackendScenarioRevision(normalizedRuntimeConfig, backendSession, revisionId);
      setAdventure(next);
      setContextResult(undefined);
      setModalTab(undefined);
      navigateTo("dashboard");
      await library.refreshAdventures();
      await refreshBackendProfile();
      setBackendExploreStatus("");
      setBackendProfileStatus("");
      notify("Scenario started.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start scenario.";
      setBackendExploreStatus(message);
      setBackendProfileStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function startPremadeExploreScenario(id: PremadeAdventureId) {
    setBackendExploreStatus("Starting built-in scenario...");
    notify("Starting built-in scenario...", { type: "info" });
    try {
      await library.loadPremadeAdventure(id);
      if (backendReady) await refreshBackendProfile();
      setBackendExploreStatus("");
      notify("Built-in scenario started.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start built-in scenario.";
      setBackendExploreStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function listBackendBackups(adventureId: string) {
    if (!backendSession) throw new Error("Sign in to the local backend before loading backups.");
    const result = await listBackendAdventureSnapshots(normalizedRuntimeConfig, backendSession, adventureId);
    return result.snapshots;
  }

  async function restoreBackendBackup(adventureId: string, snapshotId: string) {
    if (!backendSession) throw new Error("Sign in to the local backend before restoring backups.");
    const restored = await restoreBackendAdventureSnapshot(normalizedRuntimeConfig, backendSession, adventureId, snapshotId);
    setAdventure((current) => current?.id === restored.id ? restored : current);
    if (adventure?.id === restored.id) setContextResult(undefined);
    await refreshBackendProfile();
    await library.refreshAdventures();
  }

  function renderAdventureTool(tabId: TabId) {
    if (!adventure) return null;
    const common = { adventure, dispatch };
    switch (tabId) {
      case "chronicle":
        return <ChroniclePage {...common} />;
      case "context":
        return <ContextPreviewPage {...common} contextResult={contextResult} onBuildContext={runtime.buildPreview} providerConfig={hideBackendUserDeveloperControls ? undefined : runtime.activeProviderConfig} />;
      case "components":
        return <ComponentsPage {...common} loading={runtime.loading} onSuggestPlotUpdates={runtime.suggestPlotUpdates} onBuildPlotMemory={runtime.buildPlotMemory} onAuditComponents={runtime.auditComponents} onRegeneratePlotEssentials={runtime.regeneratePlotEssentials} onUpdatePEComponentNow={runtime.updatePEComponentNow} onGenerateComponent={runtime.generateComponent} onGenerateArc={runtime.generateArc} onProposeArcFromHistory={runtime.proposeArcFromHistory} />;
      case "storyCards":
        return <StoryCardsPage {...common} loading={runtime.loading} onBuildStoryCardMemory={runtime.buildStoryCardMemory} onSuggestCardUpdates={runtime.suggestCardUpdates} onAuditStoryCards={runtime.auditStoryCards} />;
      case "brains":
        return <BrainsPage {...common} loading={runtime.loading} onUpdateBrainNow={runtime.updateBrainNow} onAuditBrains={runtime.auditBrains} onGenerateBrain={runtime.generateBrainFromName} />;
      case "triggers":
        return <TriggersPage {...common} />;
      case "memoryInbox":
        return (
          <MemoryInboxPage
            {...common}
            loading={runtime.loading}
            onRegenerateProposal={runtime.regenerateMemoryProposal}
            onReconcileMemory={runtime.reconcileMemory}
          />
        );
      case "cloudSaves":
        if (backendMode) {
          return (
            <section className="page editor-surface">
              <div className="editor-page-summary">
                <p className="muted">GitHub save slots are available in Browser Local mode only.</p>
              </div>
            </section>
          );
        }
        return (
          <CloudSavesPage
            adventure={adventure}
            dispatch={dispatch}
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
            globalAdventureSettings={globalAdventureSettings}
            onGlobalAdventureSettingsChange={setGlobalAdventureSettings}
            runtimeConfig={normalizedRuntimeConfig}
            onRuntimeConfigChange={setRuntimeConfig}
            backendSession={backendSession}
            backendModelMode={backendModelMode}
            onBackendModelModeChange={setBackendModelMode}
            onSignupBackendPassword={(input) => signupBackendPassword(normalizedRuntimeConfig, input)}
            onVerifyBackendEmail={async (token) => {
              const session = await verifyBackendEmail(normalizedRuntimeConfig, token);
              setBackendSession(session);
              return session;
            }}
            onLoginBackendPassword={async (input) => {
              const session = await loginBackendPassword(normalizedRuntimeConfig, input);
              setBackendSession(session);
              return session;
            }}
            onStartBackendGoogleOAuth={(input) => startBackendGoogleOAuth(normalizedRuntimeConfig, input)}
            onLogoutBackend={() => setBackendSession(null)}
            onBackendImport={importToBackend}
            cloudSyncSettings={cloudSyncSettings}
            cloudSyncStatus={cloudSyncStatus}
            onCloudSyncSettingsChange={setCloudSyncSettings}
            onPushCloudSync={backendMode ? undefined : pushCloudSync}
            onPullCloudSync={backendMode ? undefined : pullCloudSync}
            hideDeveloperControls={hideBackendUserDeveloperControls}
            onLoadDevelopmentAdventure={hideBackendUserDeveloperControls ? undefined : library.loadDevelopmentAdventure}
            onLoadDispatchAdventure={hideBackendUserDeveloperControls ? undefined : library.loadDispatchAdventure}
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
  const visibleEditorTabs = hideBackendUserDeveloperControls
    ? editorTabs.filter((tab) => tab.id !== "cloudSaves")
    : editorTabs;

  function renderAdventureLibrary(embedded = false) {
    return (
      <AdventuresPage
        adventures={library.adventures}
        currentAdventure={adventure}
        onCreate={library.createAdventure}
        onOpen={library.openAdventure}
        onOpenEdit={async (id) => { await library.openAdventure(id); openEditor(); }}
        onCreateAdventureFromImport={library.createAdventureFromImport}
        onImportAdventure={library.importAdventure}
        onDuplicate={library.duplicateAdventure}
        onDelete={(id) => library.removeAdventure(id, adventure?.id)}
        onPublish={backendReady ? async (id) => { await publishAdventureScenario(id); } : undefined}
        onListBackups={backendReady ? listBackendBackups : undefined}
        onRestoreBackup={backendReady ? restoreBackendBackup : undefined}
        onResolveSyncConflict={backendReady ? library.resolveSyncConflict : undefined}
        saveSlots={backendMode ? undefined : gitHubSaves.saveSlots}
        savesStatus={backendMode ? undefined : gitHubSaves.savesStatus}
        loadingSlotId={backendMode ? undefined : gitHubSaveLoad.loadingSlotId}
        loadError={backendMode ? undefined : gitHubSaveLoad.loadError}
        onDismissError={backendMode ? undefined : gitHubSaveLoad.clearLoadError}
        onListSaves={backendMode ? undefined : () => void gitHubSaves.listSaves()}
        onLoadSave={backendMode ? undefined : (slot) => void gitHubSaveLoad.initiateLoad(slot)}
        onDeleteSave={backendMode ? undefined : (slot) => void gitHubSaves.deleteSave(slot)}
        providerConfig={hideBackendUserDeveloperControls ? undefined : runtime.activeProviderConfig}
        embedded={embedded}
        headingEyebrow="Library"
        headingTitle={embedded ? "Adventure Library" : "Choose an adventure"}
        headingDescription="Continue a saved story, duplicate a setup, import a save, or start a new world."
      />
    );
  }

  const page = (() => {
    if (activeTab === "adventures") {
      return renderAdventureLibrary();
    }

    if (activeTab === "explore") {
      return (
        <ExplorePage
          backendMode={backendMode}
          backendSession={backendSession}
          scenarios={backendExploreScenarios}
          premadeAdventures={premadeAdventures}
          status={backendExploreStatus}
          onStartScenario={backendReady ? startBackendExploreScenario : undefined}
          onStartPremade={(!backendMode || backendReady) ? startPremadeExploreScenario : undefined}
          onOpenProfile={backendReady ? openBackendPublicProfile : undefined}
        />
      );
    }

    if (activeTab === "profile") {
      const showingPublicProfile = Boolean(
        backendPublicProfileUserId && backendPublicProfileUserId !== backendSession?.user.id,
      );
      return (
        <ProfilePage
          backendMode={backendMode}
          backendSession={backendSession}
          profile={backendProfile}
          publicProfile={showingPublicProfile ? backendPublicProfile : undefined}
          viewMode={showingPublicProfile ? "public" : "own"}
          status={backendProfileStatus}
          liveAdventure={showingPublicProfile ? undefined : adventure}
          onOpenAdventure={async (id) => {
            await library.openAdventure(id);
            navigateTo("dashboard");
          }}
          onEditAdventure={async (id) => {
            await library.openAdventure(id);
            openEditor();
          }}
          onDeleteAdventure={async (id) => {
            await library.removeAdventure(id, adventure?.id);
            await refreshBackendProfile();
          }}
          onPublishAdventure={async (id) => {
            await publishAdventureScenario(id);
          }}
          onPublishScenarioRevision={async (revisionId) => {
            await publishScenarioRevisionFromProfile(revisionId);
          }}
          onStartScenario={backendReady ? startBackendExploreScenario : undefined}
          onViewOwnProfile={() => {
            setBackendPublicProfileUserId(null);
            setBackendPublicProfile(undefined);
            openTab("profile");
          }}
          onOpenAdmin={isBackendAdmin ? () => openTab("admin") : undefined}
          onOpenHelp={() => openTab("help")}
          onLogout={() => {
            setBackendPublicProfileUserId(null);
            setBackendPublicProfile(undefined);
            setBackendProfile(undefined);
            setBackendSession(null);
          }}
          adventureLibrary={showingPublicProfile ? undefined : renderAdventureLibrary(true)}
        />
      );
    }

    if (activeTab === "admin") {
      return (
        <AdminConsolePage
          backendMode={backendMode}
          backendSession={backendSession}
          data={backendAdminConsole}
          status={backendAdminStatus}
          onSetUserStatus={setBackendAdminUserStatus}
          onCreateRestriction={createBackendAdminUserRestriction}
          onUpdateSafetyEvent={setBackendAdminSafetyEventStatus}
          onCreateInvite={createBackendAdminInviteLink}
          onDisableInvite={disableBackendAdminInviteLink}
          onSavePlatformSettings={saveBackendAdminPlatformSettings}
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
          providerPresets={providerPresets}
          activePresetId={activePresetId}
          onProviderPresetsChange={setProviderPresets}
          onSelectPreset={setActivePresetId}
          uiPreferences={uiPreferences}
          onUiPreferencesChange={setUiPreferences}
          globalAdventureSettings={globalAdventureSettings}
          onGlobalAdventureSettingsChange={setGlobalAdventureSettings}
          runtimeConfig={normalizedRuntimeConfig}
          onRuntimeConfigChange={setRuntimeConfig}
          backendSession={backendSession}
          backendModelMode={backendModelMode}
          onBackendModelModeChange={setBackendModelMode}
          onSignupBackendPassword={(input) => signupBackendPassword(normalizedRuntimeConfig, input)}
          onVerifyBackendEmail={async (token) => {
            const session = await verifyBackendEmail(normalizedRuntimeConfig, token);
            setBackendSession(session);
            return session;
          }}
          onLoginBackendPassword={async (input) => {
            const session = await loginBackendPassword(normalizedRuntimeConfig, input);
            setBackendSession(session);
            return session;
          }}
          onStartBackendGoogleOAuth={(input) => startBackendGoogleOAuth(normalizedRuntimeConfig, input)}
          onLogoutBackend={() => setBackendSession(null)}
          onBackendImport={importToBackend}
          cloudSyncSettings={cloudSyncSettings}
          cloudSyncStatus={cloudSyncStatus}
          onCloudSyncSettingsChange={setCloudSyncSettings}
          onPushCloudSync={backendMode ? undefined : pushCloudSync}
          onPullCloudSync={backendMode ? undefined : pullCloudSync}
          hideDeveloperControls={hideBackendUserDeveloperControls}
          onLoadDevelopmentAdventure={hideBackendUserDeveloperControls ? undefined : library.loadDevelopmentAdventure}
          onLoadDispatchAdventure={hideBackendUserDeveloperControls ? undefined : library.loadDispatchAdventure}
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
            onPullLatest={!backendMode && cloudSyncSettings.token.trim() ? handlePullLatest : undefined}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
            onOpenPlayTool={(tabId) => setPlayPanelTab(tabId as EditorTabId)}
            playPanelContent={playPanelTab ? renderAdventureTool(playPanelTab) : undefined}
            playPanelTitle={playPanelTab ? (modalTitles[playPanelTab as TabId] ?? "Tool") : undefined}
            onClosePlayPanel={() => setPlayPanelTab(undefined)}
            providerPresets={hideBackendUserDeveloperControls ? undefined : providerPresets}
            activePresetId={hideBackendUserDeveloperControls ? undefined : activePresetId}
            onSelectPreset={hideBackendUserDeveloperControls ? undefined : setActivePresetId}
            uiPreferences={uiPreferences}
            onUiPreferencesChange={setUiPreferences}
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
            onPullLatest={!backendMode && cloudSyncSettings.token.trim() ? handlePullLatest : undefined}
            onOpenTab={(tabId) => openTab(tabId as TabId)}
          />
        );
      case "edit":
        return (
          <section className="page editor-workspace">
            <header className="editor-header panel">
              <div className="editor-title-block">
                <input
                  className="editor-title-input"
                  value={adventure.title}
                  onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
                  placeholder="Adventure title"
                />
                <AdventureThumbnailPicker
                  thumbnail={getAdventureThumbnail(adventure)}
                  title={adventure.title}
                  compact
                  onChange={(thumbnail) =>
                    dispatch({ type: "UPDATE_METADATA", metadata: thumbnailMetadataPatch(thumbnail ?? null) })
                  }
                />
              </div>
              <p className="muted editor-save-status">{saveStatus}</p>
            </header>
            <nav className="editor-tabs" aria-label="Adventure editor">
              {visibleEditorTabs.map((tab) => {
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
      case "triggers":
      case "memoryInbox":
      case "importExport":
        return renderAdventureTool(activeTab);
      default:
        return null;
    }
  })();

  const activeTopTab = editorTabIds.has(activeTab) ? "edit" : activeTab === "adventures" ? "profile" : activeTab;
  const navHidden = activeTab === "play" && !navForceVisible;

  if (!backendSession?.sessionToken) {
    return (
      <WelcomePage
        onSignupPassword={(input) => signupBackendPassword(
          { ...normalizedRuntimeConfig, mode: normalizedRuntimeConfig.mode === "local" ? "backendLocal" : normalizedRuntimeConfig.mode },
          input,
        )}
        onVerifyEmail={async (token) => {
          const session = await verifyBackendEmail(normalizedRuntimeConfig, token);
          setBackendPublicProfileUserId(null);
          setBackendPublicProfile(undefined);
          setBackendSession(session);
          navigateTo("profile");
          return session;
        }}
        onLoginPassword={async (input) => {
          const session = await loginBackendPassword(normalizedRuntimeConfig, input);
          setBackendPublicProfileUserId(null);
          setBackendPublicProfile(undefined);
          setBackendSession(session);
          navigateTo("profile");
          return session;
        }}
        onStartGoogleOAuth={(input) => startBackendGoogleOAuth(normalizedRuntimeConfig, input)}
      />
    );
  }

  return (
    <div className={`app-shell${navHidden ? " nav-hidden" : ""}`}>
      {navHidden && (
        <button type="button" className="nav-show-btn" onClick={() => setNavForceVisible(true)} title="Show navigation">
          Menu
        </button>
      )}
      <header className="app-header">
        <div className="app-title">
          <button type="button" className="app-title-button" onClick={() => {
            setBackendPublicProfileUserId(null);
            setBackendPublicProfile(undefined);
            openTab("profile");
          }}>
            <span className="app-brand">AI Story Teller</span>
            {adventure && activeTab === "play" && <span className="muted">{adventure.title}</span>}
          </button>
          <span className="app-version">{__COMMIT_HASH__}</span>
        </div>
        <nav className="app-nav" aria-label="Primary">
          {adventure && (
            <span
              className={`open-adventure-nav-group${openAdventureNavCollapsed ? " collapsed" : ""}`}
              role="group"
              aria-label={`Open adventure navigation for ${adventure.title}`}
            >
              <button
                type="button"
                className="open-adventure-label"
                title={`${openAdventureNavCollapsed ? "Show" : "Hide"} adventure navigation for ${adventure.title}`}
                aria-expanded={!openAdventureNavCollapsed}
                onClick={() => setOpenAdventureNavCollapsed((collapsed) => !collapsed)}
              >
                Open: {adventure.title}
              </button>
              {!openAdventureNavCollapsed && (
                <>
                  <button
                    type="button"
                    className={activeTopTab === "dashboard" ? "active" : ""}
                    onClick={() => openTab("dashboard")}
                  >
                    Adventure
                  </button>
                  <button
                    type="button"
                    className={activeTopTab === "play" ? "active primary" : ""}
                    onClick={() => openTab("play")}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className={activeTopTab === "edit" ? "active" : ""}
                    onClick={() => {
                      if (activeTab === "edit") {
                        document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      } else {
                        openEditor(editorTab);
                      }
                    }}
                  >
                    Edit
                    {pendingProposalCount > 0 && <span className="nav-badge">{pendingProposalCount > 99 ? "99+" : pendingProposalCount}</span>}
                  </button>
                </>
              )}
            </span>
          )}
          <button
            type="button"
            className={activeTopTab === "profile" ? "active" : ""}
            onClick={() => {
              setBackendPublicProfileUserId(null);
              setBackendPublicProfile(undefined);
              openTab("profile");
            }}
          >
            Profile
          </button>
          <button
            type="button"
            className={activeTopTab === "explore" ? "active" : ""}
            onClick={() => openTab("explore")}
          >
            Explore
          </button>
          {isBackendAdmin && (
            <button
              type="button"
              className={activeTopTab === "admin" ? "active" : ""}
              onClick={() => openTab("admin")}
            >
              Admin
            </button>
          )}
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
