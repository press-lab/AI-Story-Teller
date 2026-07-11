import { useState } from "react";
import type {
  Adventure,
  AdventureAction,
  CloudSyncSettings,
  MemoryAutoApproveSettings,
  MemoryDetectionSettings,
  OpenRouterDataCollection,
  MemoryPriorityMode,
  OpenRouterProviderSort,
  ProviderRequestThrottle,
  SemanticEvaluationSettings,
  TokenBudgetSettings,
} from "../types/adventure";
import type { GlobalAdventureSettings, ProviderPreset, RuntimeProviderSettings, UiPreferences } from "./pageTypes";
import { defaultUiPreferences } from "./pageTypes";
import type { RuntimeConfig, RuntimeMode } from "../runtime/runtimeConfig";
import { runtimeModeLabel } from "../runtime/runtimeConfig";
import type {
  BackendImportRequest,
  BackendPasswordSignupResult,
  BackendSessionState,
} from "../runtime/backendApi";
import { CheckboxField, Field, JsonTextarea, NumberInput } from "./shared";
import {
  lightTokenBudgetPreset,
  defaultTokenBudgetSettings,
  heavyTokenBudgetPreset,
} from "../state/defaults";
import {
  createDevelopmentAdventureJson,
  createDevelopmentStoryCardsJson,
  developmentAdventureTitle,
} from "../dev/developmentAdventure";
import {
  createDispatchAdventureJson,
  createDispatchStoryCardsJson,
  dispatchAdventureTitle,
} from "../dev/dispatchAdventure";
import { useActionFeedback } from "../components/ActionFeedback";

function downloadJson(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const fallbackThrottle: ProviderRequestThrottle = {
  enabled: false,
  minSecondsBetweenRequests: 2,
  maxRequestsPerMinute: 20,
};

type BackendModelMode = "platform" | "personal";

const personalProviderOptions = [
  { label: "OpenRouter", name: "openrouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "DeepSeek", name: "deepseek", baseUrl: "https://api.deepseek.com" },
  { label: "OpenAI", name: "openai", baseUrl: "https://api.openai.com/v1" },
  { label: "Groq", name: "groq", baseUrl: "https://api.groq.com/openai/v1" },
];

interface SettingsPageProps {
  adventure?: Adventure;
  dispatch: (action: AdventureAction) => void;
  providerPresets: ProviderPreset[];
  activePresetId: string;
  onProviderPresetsChange: (presets: ProviderPreset[]) => void;
  onSelectPreset: (id: string) => void;
  uiPreferences: UiPreferences;
  onUiPreferencesChange: (prefs: UiPreferences) => void;
  globalAdventureSettings: GlobalAdventureSettings;
  onGlobalAdventureSettingsChange: (settings: GlobalAdventureSettings) => void;
  runtimeConfig?: RuntimeConfig;
  onRuntimeConfigChange?: (config: RuntimeConfig) => void;
  backendSession?: BackendSessionState | null;
  backendModelMode?: BackendModelMode;
  onBackendModelModeChange?: (mode: BackendModelMode) => void;
  deviceOnlyDataMode?: boolean;
  hideDeveloperControls?: boolean;
  onSignupBackendPassword?: (input: { inviteToken: string; email: string; password: string; displayName?: string }) => Promise<BackendPasswordSignupResult>;
  onVerifyBackendEmail?: (token: string) => Promise<BackendSessionState>;
  onLoginBackendPassword?: (input: { email: string; password: string }) => Promise<BackendSessionState>;
  onStartBackendGoogleOAuth?: (input: { inviteToken?: string; returnTo?: string }) => Promise<{ authUrl: string; expiresAt: string }>;
  onLogoutBackend?: () => void;
  onListBackendSessions?: () => Promise<{ sessions: Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }> }>;
  onRevokeAllBackendSessions?: () => Promise<void>;
  onExportBackendAccount?: () => Promise<Record<string, unknown>>;
  onDeleteBackendAccount?: () => Promise<void>;
  onBackendImport?: (input: BackendImportRequest) => Promise<Adventure>;
  cloudSyncSettings?: CloudSyncSettings;
  cloudSyncStatus?: string;
  onCloudSyncSettingsChange?: (settings: CloudSyncSettings) => void;
  onPushCloudSync?: () => Promise<void>;
  onPullCloudSync?: () => Promise<void>;
  onLoadDevelopmentAdventure?: () => Promise<void>;
  onLoadDispatchAdventure?: () => Promise<void>;
}

export function SettingsPage({
  adventure,
  dispatch,
  providerPresets,
  activePresetId,
  onProviderPresetsChange,
  onSelectPreset,
  uiPreferences,
  onUiPreferencesChange,
  globalAdventureSettings,
  onGlobalAdventureSettingsChange,
  runtimeConfig,
  onRuntimeConfigChange,
  backendSession,
  backendModelMode = "platform",
  onBackendModelModeChange,
  deviceOnlyDataMode = false,
  hideDeveloperControls = false,
  onSignupBackendPassword,
  onVerifyBackendEmail,
  onLoginBackendPassword,
  onStartBackendGoogleOAuth,
  onLogoutBackend,
  onListBackendSessions,
  onRevokeAllBackendSessions,
  onExportBackendAccount,
  onDeleteBackendAccount,
  onBackendImport,
  cloudSyncSettings,
  cloudSyncStatus,
  onCloudSyncSettingsChange,
  onPushCloudSync,
  onPullCloudSync,
  onLoadDevelopmentAdventure,
  onLoadDispatchAdventure,
}: SettingsPageProps) {
  const { confirmAction, notify } = useActionFeedback();
  const isBackendMode = runtimeConfig ? runtimeConfig.mode !== "local" : false;
  const showLocalDeveloperControls = (!isBackendMode || deviceOnlyDataMode) && !hideDeveloperControls;
  const advanced = uiPreferences.showAdvancedSettings && showLocalDeveloperControls;
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState("");
  const [backendInviteToken, setBackendInviteToken] = useState("");
  const [backendEmail, setBackendEmail] = useState("");
  const [backendPassword, setBackendPassword] = useState("");
  const [backendDisplayName, setBackendDisplayName] = useState("");
  const [backendVerificationToken, setBackendVerificationToken] = useState("");
  const [backendImportSource, setBackendImportSource] = useState<BackendImportRequest["sourceType"]>("aist");
  const [backendImportText, setBackendImportText] = useState("");
  const [backendImportTitle, setBackendImportTitle] = useState("");
  const [backendSessions, setBackendSessions] = useState<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>>([]);

  const activePreset = providerPresets.find((p) => p.id === activePresetId) ?? providerPresets[0];
  const showRuntimeTechnicalControls = showLocalDeveloperControls;
  const showBackendModelSource = isBackendMode && Boolean(backendSession) && !deviceOnlyDataMode;
  const showBackendAuthControls = isBackendMode && !backendSession;
  const showBackendImportControls = false;
  const showCloudSyncControls = showLocalDeveloperControls && !deviceOnlyDataMode;

  function updateUi(patch: Partial<UiPreferences>) {
    onUiPreferencesChange({ ...uiPreferences, ...patch });
  }

  function updateCloudSync(patch: Partial<CloudSyncSettings>) {
    if (!cloudSyncSettings || !onCloudSyncSettingsChange) return;
    onCloudSyncSettingsChange({ ...cloudSyncSettings, ...patch });
  }

  function updateRuntime(patch: Partial<RuntimeConfig>) {
    if (!runtimeConfig || !onRuntimeConfigChange) return;
    onRuntimeConfigChange({ ...runtimeConfig, ...patch });
  }

  async function runBackendAction<T>(label: string, action: () => Promise<T>): Promise<T | undefined> {
    setBackendStatus(`${label}...`);
    notify(`${label}...`, { type: "info" });
    try {
      const result = await action();
      setBackendStatus(`${label} complete.`);
      notify(`${label} complete.`, { type: "success" });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} failed.`;
      setBackendStatus(message);
      notify(message, { type: "error" });
      return undefined;
    }
  }

  async function revokeEveryBackendSession() {
    if (!onRevokeAllBackendSessions) return;
    const confirmed = await confirmAction({
      title: "Sign out every session?",
      message: "This signs this account out on every device, including this one.",
      confirmLabel: "Sign out everywhere",
      danger: true,
    });
    if (confirmed) await runBackendAction("Revoking sessions", onRevokeAllBackendSessions);
  }

  async function deleteCurrentBackendAccount() {
    if (!onDeleteBackendAccount) return;
    const confirmed = await confirmAction({
      title: "Permanently delete this account?",
      message: "This permanently deletes the account, hosted adventures, scenarios, and related account data.",
      confirmLabel: "Delete account",
      danger: true,
    });
    if (confirmed) await runBackendAction("Deleting account", onDeleteBackendAccount);
  }

  async function signupWithBackendPassword() {
    await runBackendAction("Password signup", async () => {
      if (!onSignupBackendPassword) throw new Error("Backend signup is unavailable.");
      return onSignupBackendPassword({
        inviteToken: backendInviteToken,
        email: backendEmail,
        password: backendPassword,
        displayName: backendDisplayName,
      });
    });
  }

  async function verifyBackendAccount() {
    await runBackendAction("Verify email", async () => {
      if (!onVerifyBackendEmail) throw new Error("Backend email verification is unavailable.");
      return onVerifyBackendEmail(backendVerificationToken);
    });
  }

  async function loginWithBackendPassword() {
    await runBackendAction("Password login", async () => {
      if (!onLoginBackendPassword) throw new Error("Backend login is unavailable.");
      return onLoginBackendPassword({ email: backendEmail, password: backendPassword });
    });
  }

  async function startGoogleOAuth() {
    const result = await runBackendAction("Google OAuth", async () => {
      if (!onStartBackendGoogleOAuth) throw new Error("Backend Google OAuth is unavailable.");
      return onStartBackendGoogleOAuth({
        inviteToken: backendInviteToken.trim() || undefined,
        returnTo: window.location.href.split("#")[0],
      });
    });
    if (result?.authUrl) window.location.assign(result.authUrl);
  }

  async function importBackendJson() {
    const result = await runBackendAction("Backend import", async () => {
      if (!onBackendImport) throw new Error("Backend import is unavailable.");
      return onBackendImport({
        sourceType: backendImportSource,
        text: backendImportText,
        title: backendImportTitle,
      });
    });
    if (result) setBackendImportText("");
  }

  function updatePreset(id: string, patch: Partial<ProviderPreset>) {
    const updated = providerPresets.map((p) => (p.id === id ? { ...p, ...patch } : p));
    onProviderPresetsChange(updated);
    if (adventure && id === activePresetId) {
      const next = updated.find((p) => p.id === id)!;
      dispatch({ type: "SET_MODEL_CONFIG", config: next });
    }
  }

  function updatePresetApiKey(id: string, apiKey: string) {
    onProviderPresetsChange(providerPresets.map((p) => (p.id === id ? { ...p, apiKey } : p)));
  }

  function updateActivePersonalProvider(patch: Partial<ProviderPreset>) {
    if (!activePreset) return;
    updatePreset(activePreset.id, patch);
  }

  function selectPersonalProvider(baseUrl: string) {
    const provider = personalProviderOptions.find((option) => option.baseUrl === baseUrl);
    if (!provider || !activePreset) return;
    updatePreset(activePreset.id, { name: provider.name, baseUrl: provider.baseUrl });
  }

  function updateThrottle(id: string, patch: Partial<ProviderRequestThrottle>) {
    const preset = providerPresets.find((p) => p.id === id);
    if (!preset) return;
    const current = preset.requestThrottle ?? fallbackThrottle;
    updatePreset(id, { requestThrottle: { ...current, ...patch } });
  }

  function addPreset() {
    const base = activePreset ?? providerPresets[0];
    const newId = `preset-${Date.now()}`;
    const newPreset: ProviderPreset = { ...(base ?? { name: "", baseUrl: "", model: "", apiKey: "", temperature: 0.7, maxOutputTokens: 2048, topP: 0.95, presencePenalty: 0.8, frequencyPenalty: 0 }), id: newId, label: "New Model", apiKey: "" };
    onProviderPresetsChange([...providerPresets, newPreset]);
    setExpandedPresetId(newId);
  }

  async function deletePreset(id: string) {
    const preset = providerPresets.find((p) => p.id === id);
    const confirmed = await confirmAction({
      title: "Delete model preset?",
      message: `Delete "${preset?.label || "this preset"}"?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    const remaining = providerPresets.filter((p) => p.id !== id);
    onProviderPresetsChange(remaining);
    if (id === activePresetId && remaining.length > 0) onSelectPreset(remaining[0].id);
    if (expandedPresetId === id) setExpandedPresetId(remaining[0]?.id ?? null);
    notify("Model preset deleted.", { type: "success" });
  }

  async function runCloudAction(label: string, action?: () => Promise<void>) {
    if (!action) return;
    notify(`${label}...`, { type: "info" });
    try {
      await action();
      notify(`${label} complete.`, { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : `${label} failed.`, { type: "error" });
    }
  }

  async function loadDevelopmentAdventure() {
    if (!onLoadDevelopmentAdventure) return;
    const confirmed = await confirmAction({
      title: "Load development adventure?",
      message: "This will save and open the development adventure in the current library.",
      confirmLabel: "Load",
    });
    if (!confirmed) return;
    notify("Loading development adventure...", { type: "info" });
    try {
      await onLoadDevelopmentAdventure();
      notify("Development adventure loaded.", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Development adventure failed to load.", { type: "error" });
    }
  }

  async function loadDispatchAdventure() {
    if (!onLoadDispatchAdventure) return;
    const confirmed = await confirmAction({
      title: "Load Dispatch adventure?",
      message: "This will save and open the Dispatch development adventure in the current library.",
      confirmLabel: "Load",
    });
    if (!confirmed) return;
    notify("Loading Dispatch adventure...", { type: "info" });
    try {
      await onLoadDispatchAdventure();
      notify("Dispatch adventure loaded.", { type: "success" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Dispatch adventure failed to load.", { type: "error" });
    }
  }

  function updateBudget(patch: Partial<TokenBudgetSettings>) {
    if (adventure) { dispatch({ type: "SET_TOKEN_BUDGET_SETTINGS", settings: { ...adventure.tokenBudgetSettings, ...patch } }); return; }
    onGlobalAdventureSettingsChange({ ...globalAdventureSettings, tokenBudgetSettings: { ...activeSettings.tokenBudgetSettings, ...patch } });
  }

  function updateSemanticSettings(patch: Partial<SemanticEvaluationSettings>) {
    if (adventure) { dispatch({ type: "SET_SEMANTIC_EVALUATION_SETTINGS", settings: { ...adventure.semanticEvaluationSettings, ...patch } }); return; }
    onGlobalAdventureSettingsChange({ ...globalAdventureSettings, semanticEvaluationSettings: { ...activeSettings.semanticEvaluationSettings, ...patch } });
  }

  function updateMemoryDetection(patch: Partial<MemoryDetectionSettings>) {
    if (adventure) {
      dispatch({ type: "SET_MEMORY_DETECTION_SETTINGS", settings: { ...adventure.memoryDetectionSettings, ...patch } });
      return;
    }
    onGlobalAdventureSettingsChange({ ...globalAdventureSettings, memoryDetectionSettings: { ...globalAdventureSettings.memoryDetectionSettings, ...patch } });
  }

  function updateMemoryAutoApprove(patch: Partial<MemoryAutoApproveSettings>) {
    if (adventure) { dispatch({ type: "SET_MEMORY_AUTO_APPROVE", settings: { ...adventure.memoryAutoApprove, ...patch } }); return; }
    onGlobalAdventureSettingsChange({ ...globalAdventureSettings, memoryAutoApprove: { ...activeSettings.memoryAutoApprove, ...patch } });
  }

  const activeSettings: GlobalAdventureSettings = adventure ? {
    tokenBudgetSettings: adventure.tokenBudgetSettings,
    semanticEvaluationSettings: adventure.semanticEvaluationSettings,
    memoryDetectionSettings: adventure.memoryDetectionSettings,
    memoryAutoApprove: adventure.memoryAutoApprove,
  } : globalAdventureSettings;
  const activeModelLabel = activePreset?.label || activePreset?.model || "No model";
  const backgroundStatus = activeSettings.semanticEvaluationSettings.enabled
    ? `every ${activeSettings.semanticEvaluationSettings.semanticEvalEveryNTurns ?? 1} turns`
    : "off";

  return (
    <section className="page editor-surface settings-page">
      <div className="editor-page-summary">
        <div>
          <p className="eyebrow">Preferences</p>
          <p className="muted">Reading and appearance settings affect this app. Story behavior settings below affect {adventure ? `only “${adventure.title}”` : "new Stories by default"}. Advanced diagnostics stay collapsed until you ask for them.</p>
        </div>
        <div className="editor-stat-row" aria-label="Settings summary">
          <span>{adventure ? "Current Story" : "App defaults"}</span>
          <span>{uiPreferences.density}</span>
          <span>{uiPreferences.darkMode ? "dark" : "light"}</span>
          {showLocalDeveloperControls && <span>{activeModelLabel}</span>}
          {showLocalDeveloperControls && <span>background {backgroundStatus}</span>}
          {deviceOnlyDataMode && <span>device-only adventure</span>}
          {isBackendMode && showBackendModelSource && <span>{backendModelMode === "personal" ? "personal model" : "platform model"}</span>}
          {advanced && <span>advanced</span>}
        </div>
      </div>

      <div className="settings-section-grid">

        {/* ── Interface ─────────────────────────────── */}
        <article className="panel settings-card settings-interface-panel">
          <h3>Interface</h3>
          <CheckboxField label="Dark mode" checked={uiPreferences.darkMode} onChange={(darkMode) => updateUi({ darkMode })} />
          <div className="grid two">
            <Field label="Dark mode text color">
              <input
                type="color"
                value={uiPreferences.darkModeTextColor || defaultUiPreferences.darkModeTextColor}
                onChange={(e) => updateUi({ darkModeTextColor: e.target.value })}
              />
            </Field>
            <Field label="Reset text color">
              <button type="button" onClick={() => updateUi({ darkModeTextColor: defaultUiPreferences.darkModeTextColor })}>
                Reset
              </button>
            </Field>
          </div>
          <Field label="Density">
            <select
              value={uiPreferences.density}
              onChange={(e) => updateUi({ density: e.target.value as "compact" | "comfortable" })}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </Field>
          <div className="grid two">
            <Field label="Story text size (px)">
              <NumberInput min={12} max={24} value={uiPreferences.storyFontSize} onChange={(storyFontSize) => updateUi({ storyFontSize })} />
            </Field>
            <Field label="Story box width (px)">
              <NumberInput min={520} max={1800} value={uiPreferences.storyContentWidth} onChange={(storyContentWidth) => updateUi({ storyContentWidth })} />
            </Field>
            <Field label="Story box position">
              <select
                value={uiPreferences.storyContentAlign}
                onChange={(e) => updateUi({ storyContentAlign: e.target.value as UiPreferences["storyContentAlign"] })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </Field>
            <Field label="Max content width (px)">
              <NumberInput min={600} max={1800} value={uiPreferences.maxContentWidth} onChange={(maxContentWidth) => updateUi({ maxContentWidth })} />
            </Field>
          </div>
          {advanced && (
            <CheckboxField
              label="Show exact token estimates in Play"
              checked={uiPreferences.showTokenEstimates}
              onChange={(showTokenEstimates) => updateUi({ showTokenEstimates })}
            />
          )}
          {showLocalDeveloperControls && (
            <CheckboxField
              label="Show advanced settings"
              checked={uiPreferences.showAdvancedSettings}
              onChange={(showAdvancedSettings) => updateUi({ showAdvancedSettings })}
            />
          )}
        </article>

        {/* ── Models ────────────────────────────────── */}
        <article className="panel settings-card settings-runtime-panel">
          <h3>{isBackendMode ? "Account" : "Runtime"}</h3>
          {showRuntimeTechnicalControls && (
            <>
              <Field label="Execution mode">
                <select
                  value={runtimeConfig?.mode ?? "local"}
                  onChange={(event) => updateRuntime({ mode: event.target.value as RuntimeMode })}
                >
                  <option value="local">{runtimeModeLabel("local")}</option>
                  <option value="backendLocal">{runtimeModeLabel("backendLocal")}</option>
                  <option value="hostedBackend">{runtimeModeLabel("hostedBackend")}</option>
                </select>
              </Field>
              <Field label="Backend API URL">
                <input
                  value={runtimeConfig?.apiBaseUrl ?? "http://127.0.0.1:8787"}
                  onChange={(event) => updateRuntime({ apiBaseUrl: event.target.value })}
                  placeholder="http://127.0.0.1:8787"
                />
              </Field>
            </>
          )}
          <div className="editor-stat-row" aria-label="Backend account summary">
            <span>{backendSession ? backendSession.user.email : "not signed in"}</span>
            <span>{backendSession ? backendSession.user.status : "local only"}</span>
          </div>
          {backendStatus && <p className="notice">{backendStatus}</p>}

          {showBackendAuthControls && (
            <>
              <Field label="Invite token">
                <input value={backendInviteToken} onChange={(event) => setBackendInviteToken(event.target.value)} />
              </Field>

              <div className="grid two">
                <Field label="Email">
                  <input value={backendEmail} onChange={(event) => setBackendEmail(event.target.value)} />
                </Field>
                <Field label="Display name">
                  <input value={backendDisplayName} onChange={(event) => setBackendDisplayName(event.target.value)} />
                </Field>
                <Field label="Password">
                  <input type="password" value={backendPassword} onChange={(event) => setBackendPassword(event.target.value)} />
                </Field>
                {!hideDeveloperControls && (
                  <Field label="Verification token">
                    <input value={backendVerificationToken} onChange={(event) => setBackendVerificationToken(event.target.value)} />
                  </Field>
                )}
              </div>
              <div className="toolbar">
                <button type="button" onClick={() => void signupWithBackendPassword()}>
                  Sign up
                </button>
                {!hideDeveloperControls && (
                  <button type="button" onClick={() => void verifyBackendAccount()}>
                    Verify
                  </button>
                )}
                <button type="button" onClick={() => void loginWithBackendPassword()}>
                  Log in
                </button>
                <button type="button" onClick={() => void startGoogleOAuth()} disabled={!backendInviteToken.trim()}>
                  Continue with Google
                </button>
              </div>
            </>
          )}
          <div className="toolbar settings-account-actions">
            <button type="button" onClick={onLogoutBackend} disabled={!backendSession}>
              Log out
            </button>
            {backendSession && onListBackendSessions && (
              <button type="button" onClick={() => void runBackendAction("Loading sessions", async () => {
                const result = await onListBackendSessions();
                setBackendSessions(result.sessions);
              })}>Sessions</button>
            )}
            {backendSession && onRevokeAllBackendSessions && (
              <button type="button" onClick={() => void revokeEveryBackendSession()}>Sign out everywhere</button>
            )}
            {backendSession && onExportBackendAccount && (
              <button type="button" onClick={() => void runBackendAction("Exporting account", async () => {
                const exported = await onExportBackendAccount();
                downloadJson("ai-story-teller-account-export.json", JSON.stringify(exported, null, 2));
              })}>Export account</button>
            )}
            {backendSession && onDeleteBackendAccount && (
              <button type="button" className="danger" onClick={() => void deleteCurrentBackendAccount()}>Delete account</button>
            )}
          </div>
          {backendSessions.length > 0 && (
            <ul className="compact-list" aria-label="Active sessions">
              {backendSessions.map((session) => (
                <li key={session.id}>{session.current ? "Current session" : "Session"} · created {new Date(session.createdAt).toLocaleString()} · expires {new Date(session.expiresAt).toLocaleString()}</li>
              ))}
            </ul>
          )}

          {showBackendModelSource && (
            <details className="setup-panel">
              <summary>Model Source</summary>
              <p className="muted">
                Platform model uses the owner-hosted backend model. Personal model uses your key for generation requests while backend policy checks and saves stay active.
              </p>
              <Field label="Generation model source">
                <select
                  value={backendModelMode}
                  onChange={(event) => onBackendModelModeChange?.(event.target.value as BackendModelMode)}
                >
                  <option value="platform">Platform model</option>
                  <option value="personal">My personal model</option>
                </select>
              </Field>
              {backendModelMode === "personal" && activePreset && (
                <>
                  <div className="grid two">
                    <Field label="Provider">
                      <select
                        value={personalProviderOptions.some((option) => option.baseUrl === activePreset.baseUrl) ? activePreset.baseUrl : ""}
                        onChange={(event) => selectPersonalProvider(event.target.value)}
                      >
                        <option value="" disabled>Select provider</option>
                        {personalProviderOptions.map((provider) => (
                          <option key={provider.baseUrl} value={provider.baseUrl}>{provider.label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Model">
                      <input
                        value={activePreset.model}
                        onChange={(event) => updateActivePersonalProvider({ model: event.target.value })}
                        placeholder="deepseek/deepseek-v3.2"
                      />
                    </Field>
                  </div>
                  <Field label="API Key">
                    <input
                      type="password"
                      value={activePreset.apiKey}
                      onChange={(event) => updatePresetApiKey(activePreset.id, event.target.value)}
                      placeholder="Stored in this browser and sent only for your turns"
                    />
                  </Field>
                  <div className="grid two">
                    <Field label="Temperature">
                      <NumberInput
                        min={0}
                        max={2}
                        value={activePreset.temperature}
                        onChange={(temperature) => updateActivePersonalProvider({ temperature })}
                      />
                    </Field>
                    <Field label="Max output tokens">
                      <NumberInput
                        min={1}
                        value={activePreset.maxOutputTokens}
                        onChange={(maxOutputTokens) => updateActivePersonalProvider({ maxOutputTokens })}
                      />
                    </Field>
                    {activePreset.baseUrl.toLowerCase().includes("openrouter.ai") && (
                      <Field label="OpenRouter data policy">
                        <select
                          value={activePreset.openRouterDataCollection ?? ""}
                          onChange={(event) =>
                            updateActivePersonalProvider({
                              openRouterDataCollection: (event.target.value || undefined) as OpenRouterDataCollection | undefined,
                            })
                          }
                        >
                          <option value="">Key or workspace default</option>
                          <option value="allow">Allow provider data collection</option>
                          <option value="deny">Exclude data-collection providers</option>
                        </select>
                      </Field>
                    )}
                  </div>
                  <p className="notice">
                    Personal provider URLs are restricted to approved HTTPS providers before the backend will call them.
                  </p>
                </>
              )}
            </details>
          )}

          {showBackendImportControls && (
            <>
              <div className="grid two">
                <Field label="Import source">
                  <select
                    value={backendImportSource}
                    onChange={(event) => setBackendImportSource(event.target.value as BackendImportRequest["sourceType"])}
                  >
                    <option value="aist">AIST JSON</option>
                    <option value="githubSave">GitHub save JSON</option>
                  </select>
                </Field>
              </div>
              <Field label="Backend import title">
                <input value={backendImportTitle} onChange={(event) => setBackendImportTitle(event.target.value)} />
              </Field>
              <Field label="Backend import JSON">
                <textarea
                  rows={5}
                  value={backendImportText}
                  onChange={(event) => setBackendImportText(event.target.value)}
                  placeholder="Paste AIST or GitHub save JSON."
                />
              </Field>
              <div className="toolbar">
                <button type="button" onClick={() => void importBackendJson()} disabled={!backendSession || !backendImportText.trim()}>
                  Import to backend
                </button>
              </div>
            </>
          )}
          {!isBackendMode && (
            <p className="muted">
              Browser Local keeps IndexedDB, browser provider settings, JSON backup/restore, and GitHub saves independent from the backend.
            </p>
          )}
        </article>

        {showLocalDeveloperControls && (
        <article className="panel settings-card settings-models-panel">
          <div className="preset-list-header">
            <h3 style={{ margin: 0 }}>Models</h3>
            <button type="button" onClick={addPreset}>+ Add Model</button>
          </div>
          {providerPresets.map((preset) => {
            const isActive = preset.id === activePresetId;
            const isExpanded = expandedPresetId === preset.id;
            return (
              <div key={preset.id} className="preset-item">
                <div className="preset-item-header">
                  <button
                    type="button"
                    className="preset-item-toggle"
                    onClick={() => setExpandedPresetId(isExpanded ? null : preset.id)}
                  >
                    <strong>{preset.label || "(unnamed)"}</strong>
                    <span className="muted preset-item-model"> · {preset.model || "no model set"}</span>
                    <span className="preset-item-caret">{isExpanded ? " ▲" : " ▼"}</span>
                  </button>
                  <div className="preset-item-actions">
                    {isActive ? (
                      <span className="status-pill">Active</span>
                    ) : (
                      <button type="button" onClick={() => onSelectPreset(preset.id)}>Use</button>
                    )}
                    {providerPresets.length > 1 && (
                      <button type="button" className="danger" onClick={() => void deletePreset(preset.id)}>Delete</button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="preset-item-form">
                    <div className="grid two">
                      <Field label="Label">
                        <input value={preset.label} onChange={(e) => updatePreset(preset.id, { label: e.target.value })} />
                      </Field>
                      <Field label="Provider Name">
                        <input value={preset.name} onChange={(e) => updatePreset(preset.id, { name: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Base URL">
                      <input value={preset.baseUrl} onChange={(e) => updatePreset(preset.id, { baseUrl: e.target.value })} />
                    </Field>
                    <Field label="Model">
                      <input value={preset.model} onChange={(e) => updatePreset(preset.id, { model: e.target.value })} />
                    </Field>
                    <Field label="API Key">
                      <input
                        type="password"
                        value={preset.apiKey}
                        onChange={(e) => updatePresetApiKey(preset.id, e.target.value)}
                        placeholder="Stored only in localStorage"
                      />
                    </Field>
                    <div className="grid two">
                      <Field label="Temperature">
                        <NumberInput value={preset.temperature} onChange={(temperature) => updatePreset(preset.id, { temperature })} />
                      </Field>
                      <Field label="Max Output Tokens">
                        <NumberInput min={1} value={preset.maxOutputTokens} onChange={(maxOutputTokens) => updatePreset(preset.id, { maxOutputTokens })} />
                      </Field>
                      <Field label="Top P (nucleus; 1 = off)">
                        <NumberInput min={0} max={1} value={preset.topP ?? 1} onChange={(topP) => updatePreset(preset.id, { topP })} />
                      </Field>
                      <Field label="Top K (0 = off; unsupported on DeepSeek)">
                        <NumberInput min={0} value={preset.topK ?? 0} onChange={(topK) => updatePreset(preset.id, { topK: topK || undefined })} />
                      </Field>
                      <Field label="Presence Penalty (reduces looping; 0–2)">
                        <NumberInput min={0} value={preset.presencePenalty ?? 0} onChange={(presencePenalty) => updatePreset(preset.id, { presencePenalty })} />
                      </Field>
                      <Field label="Frequency Penalty (0–2)">
                        <NumberInput min={0} value={preset.frequencyPenalty ?? 0} onChange={(frequencyPenalty) => updatePreset(preset.id, { frequencyPenalty })} />
                      </Field>
                    </div>
                    <p className="muted" style={{ fontSize: "0.8em", margin: "0.25rem 0 0" }}>
                      Storytelling profile (AID-style): Temp ~0.7, Top P 0.95, Presence ~0.8. Lower temp + a presence
                      penalty keeps prose coherent without looping. Top K only works on providers that support it.
                    </p>
                    {advanced && (
                      <>
                        <CheckboxField
                          label="Enable prompt caching / sticky sessions"
                          checked={preset.promptCaching ?? false}
                          onChange={(promptCaching) => updatePreset(preset.id, { promptCaching })}
                        />
                        <Field label="OpenRouter routing preference">
                          <select
                            value={preset.openRouterProviderSort ?? ""}
                            onChange={(e) =>
                              updatePreset(preset.id, {
                                openRouterProviderSort: (e.target.value || undefined) as OpenRouterProviderSort | undefined,
                              })
                            }
                          >
                            <option value="">Balanced default</option>
                            <option value="price">Lowest price</option>
                            <option value="latency">Lowest latency</option>
                            <option value="throughput">Highest throughput</option>
                          </select>
                        </Field>
                        <Field label="OpenRouter data policy">
                          <select
                            value={preset.openRouterDataCollection ?? ""}
                            onChange={(e) =>
                              updatePreset(preset.id, {
                                openRouterDataCollection: (e.target.value || undefined) as OpenRouterDataCollection | undefined,
                              })
                            }
                          >
                            <option value="">Key or workspace default</option>
                            <option value="allow">Allow provider data collection</option>
                            <option value="deny">Exclude data-collection providers</option>
                          </select>
                        </Field>
                          <p className="muted">
                            OpenRouter's default already weighs lower price with uptime. Lowest price disables that
                            load balancing; use latency or throughput if the model is feeling slow. If OpenRouter reports
                            a data-policy endpoint error, set data policy to Allow or adjust the OpenRouter key/workspace policy.
                          </p>
                        <h4>API Throttle</h4>
                        <CheckboxField
                          label="Enable API request throttle"
                          checked={preset.requestThrottle?.enabled ?? fallbackThrottle.enabled}
                          onChange={(enabled) => updateThrottle(preset.id, { enabled })}
                        />
                        <div className="grid two">
                          <Field label="Minimum seconds between API calls">
                            <NumberInput
                              min={0}
                              value={preset.requestThrottle?.minSecondsBetweenRequests ?? fallbackThrottle.minSecondsBetweenRequests}
                              onChange={(minSecondsBetweenRequests) => updateThrottle(preset.id, { minSecondsBetweenRequests })}
                            />
                          </Field>
                          <Field label="Max API calls per minute">
                            <NumberInput
                              min={0}
                              value={preset.requestThrottle?.maxRequestsPerMinute ?? fallbackThrottle.maxRequestsPerMinute}
                              onChange={(maxRequestsPerMinute) => updateThrottle(preset.id, { maxRequestsPerMinute })}
                            />
                          </Field>
                        </div>
                        <p className="muted">Enforced before every provider call. Use 0 for no per-minute cap.</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="muted" style={{ marginTop: "0.5rem" }}>API keys are not written to adventure JSON or IndexedDB saves.</p>
        </article>
        )}

        {/* ── Background Cost Mode ──────────────────── */}
        {showLocalDeveloperControls && (() => {
          const sem = activeSettings.semanticEvaluationSettings;
          const bud = activeSettings.tokenBudgetSettings;
          const mem = activeSettings.memoryDetectionSettings;
          const isOff = !sem.enabled;
          const isLight = sem.enabled && (sem.semanticEvalEveryNTurns ?? 1) >= 5 && (bud.autoSceneStateEveryNTurns ?? 1) >= 5 && mem.enabled && mem.everyNTurns >= 5;
          const isNormal = sem.enabled && (sem.semanticEvalEveryNTurns ?? 1) === 2 && (bud.autoSceneStateEveryNTurns ?? 1) === 2 && mem.enabled && mem.everyNTurns === 3;
          const isHeavy = sem.enabled && (sem.semanticEvalEveryNTurns ?? 1) === 1 && (bud.autoSceneStateEveryNTurns ?? 1) === 1 && mem.enabled && mem.everyNTurns === 1;
          return (
            <article className="panel settings-card settings-section-full" style={{ gridColumn: "1 / -1" }}>
              <h3>Background Cost</h3>
              <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
                <button type="button" className={isOff ? "active" : ""} title="Disable all background AI calls. Play-only." onClick={() => {
                  updateSemanticSettings({ enabled: false, semanticEvalEveryNTurns: 1 });
                  updateBudget({ autoSceneStateEveryNTurns: 0 });
                  updateMemoryDetection({ enabled: false });
                }}>Off</button>
                <button type="button" className={isLight ? "active" : ""} title="PE/Summary check every 5 turns. Character thoughts are free (inline)." onClick={() => {
                  updateSemanticSettings({ enabled: true, semanticEvalEveryNTurns: 5 });
                  updateBudget({ autoSceneStateEveryNTurns: 5 });
                  updateMemoryDetection({ enabled: true, everyNTurns: 5 });
                }}>Light</button>
                <button type="button" className={isNormal ? "active" : ""} title="PE/Summary check every 2–3 turns. Balanced." onClick={() => {
                  updateSemanticSettings({ enabled: true, semanticEvalEveryNTurns: 2 });
                  updateBudget({ autoSceneStateEveryNTurns: 2 });
                  updateMemoryDetection({ enabled: true, everyNTurns: 3 });
                }}>Normal</button>
                <button type="button" className={isHeavy ? "active" : ""} title="PE/Summary check every turn. Maximum tracking." onClick={() => {
                  updateSemanticSettings({ enabled: true, semanticEvalEveryNTurns: 1 });
                  updateBudget({ autoSceneStateEveryNTurns: 1 });
                  updateMemoryDetection({ enabled: true, everyNTurns: 1 });
                }}>Heavy</button>
              </div>
              <div className="grid three" style={{ marginTop: "0.5rem" }}>
                <Field label="Memory every N turns">
                  <NumberInput min={1} value={mem.everyNTurns} onChange={(everyNTurns) => updateMemoryDetection({ everyNTurns: Math.max(1, everyNTurns) })} />
                </Field>
                <Field label="Scene state every N turns (0 = off)">
                  <NumberInput min={0} value={bud.autoSceneStateEveryNTurns ?? 1} onChange={(autoSceneStateEveryNTurns) => updateBudget({ autoSceneStateEveryNTurns })} />
                </Field>
                <Field label="Semantic eval every N turns (0 = off)">
                  <NumberInput min={0} value={sem.semanticEvalEveryNTurns ?? 1} onChange={(semanticEvalEveryNTurns) => updateSemanticSettings({ semanticEvalEveryNTurns })} />
                </Field>
              </div>
            </article>
          );
        })()}

        {/* ── Context Budget (advanced) ─────────────── */}
        {advanced && (
          <article className="panel settings-card settings-section-full" style={{ gridColumn: "1 / -1" }}>
            <h3>Context Budget</h3>
            <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
              <button type="button" title="8k tokens, 15 messages, tight section budgets" onClick={() => updateBudget(lightTokenBudgetPreset)}>Light</button>
              <button type="button" title="16k tokens, 40 messages — balanced default" onClick={() => updateBudget(defaultTokenBudgetSettings)}>Normal</button>
              <button type="button" title="32k tokens, 80 messages, large section budgets — maximum context" onClick={() => updateBudget(heavyTokenBudgetPreset)}>Heavy</button>
            </div>
            <div className="grid two">
              <Field label="Max Context Tokens">
                <NumberInput
                  min={512}
                  value={activeSettings.tokenBudgetSettings.maxContextTokens}
                  onChange={(value) => updateBudget({ maxContextTokens: value })}
                />
              </Field>
              <Field label="Max Recent Messages">
                <NumberInput
                  min={0}
                  value={activeSettings.tokenBudgetSettings.maxRecentMessages}
                  onChange={(value) => updateBudget({ maxRecentMessages: value })}
                />
              </Field>
              <Field label="Memory Priority Mode">
                <select
                  value={activeSettings.tokenBudgetSettings.memoryPriorityMode}
                  onChange={(e) => updateBudget({ memoryPriorityMode: e.target.value as MemoryPriorityMode })}
                >
                  <option value="userLocked">userLocked</option>
                  <option value="systemSuggested">systemSuggested</option>
                  <option value="hybrid">hybrid</option>
                </select>
              </Field>
              <Field label="Trigger Recent Message Window">
                <NumberInput
                  min={0}
                  value={activeSettings.tokenBudgetSettings.recentMessageWindow}
                  onChange={(value) => updateBudget({ recentMessageWindow: value })}
                />
              </Field>
            </div>
            <div className="grid two" style={{ marginTop: "0.5rem" }}>
              <div>
                <CheckboxField
                  label="Allow system to prioritize memory"
                  checked={activeSettings.tokenBudgetSettings.allowSystemToPrioritizeMemory}
                  onChange={(allowSystemToPrioritizeMemory) => updateBudget({ allowSystemToPrioritizeMemory })}
                />
                <CheckboxField
                  label="Allow system to drop unpinned triggered cards"
                  checked={activeSettings.tokenBudgetSettings.allowSystemToDropUnpinnedTriggeredCards}
                  onChange={(allowSystemToDropUnpinnedTriggeredCards) => updateBudget({ allowSystemToDropUnpinnedTriggeredCards })}
                />
                <CheckboxField
                  label="Allow system to truncate rolling summary (legacy)"
                  checked={activeSettings.tokenBudgetSettings.allowSystemToTruncateSummary}
                  onChange={(allowSystemToTruncateSummary) => updateBudget({ allowSystemToTruncateSummary })}
                />
              </div>
              <div>
                <CheckboxField
                  label="Auto-summarize in background (legacy)"
                  checked={activeSettings.tokenBudgetSettings.autoSummarize ?? true}
                  onChange={(autoSummarize) => updateBudget({ autoSummarize })}
                />
                <Field label="Auto-summarize every N turns (legacy)">
                  <NumberInput
                    min={5}
                    value={activeSettings.tokenBudgetSettings.autoSummarizeEveryNTurns ?? 20}
                    onChange={(autoSummarizeEveryNTurns) => updateBudget({ autoSummarizeEveryNTurns })}
                  />
                </Field>
                <Field label="Scene state every N turns (0 = manual only)">
                  <NumberInput
                    min={0}
                    value={activeSettings.tokenBudgetSettings.autoSceneStateEveryNTurns ?? 1}
                    onChange={(autoSceneStateEveryNTurns) => updateBudget({ autoSceneStateEveryNTurns })}
                  />
                </Field>
                <Field label="Section Budgets JSON">
                  <JsonTextarea
                    value={activeSettings.tokenBudgetSettings.sectionBudgets}
                    onValidChange={(sectionBudgets) => updateBudget({ sectionBudgets })}
                  />
                </Field>
              </div>
            </div>
          </article>
        )}

        {/* ── LLM Evaluation (advanced) ─────────────── */}
        {advanced && (
          <article className="panel settings-card">
            <h3>LLM Evaluation</h3>
            <Field label="Evaluation Model Override">
              <input
                value={activeSettings.semanticEvaluationSettings.evaluationModel}
                placeholder={activePreset?.model ?? ""}
                onChange={(e) => updateSemanticSettings({ evaluationModel: e.target.value })}
              />
            </Field>
            <Field label="Messages Included In Evaluation">
              <NumberInput
                min={1}
                value={activeSettings.semanticEvaluationSettings.messagesIncluded}
                onChange={(messagesIncluded) => updateSemanticSettings({ messagesIncluded })}
              />
            </Field>
            <Field label="Semantic eval every N turns (0 = disabled, 1 = every turn)">
              <NumberInput
                min={0}
                value={activeSettings.semanticEvaluationSettings.semanticEvalEveryNTurns ?? 1}
                onChange={(semanticEvalEveryNTurns) => updateSemanticSettings({ semanticEvalEveryNTurns })}
              />
            </Field>
            <CheckboxField
              label="Enable semantic triggers"
              checked={activeSettings.semanticEvaluationSettings.enabled}
              onChange={(enabled) => updateSemanticSettings({ enabled })}
            />
            <CheckboxField
              label="Show evaluation log on Automations page"
              checked={activeSettings.semanticEvaluationSettings.showLog}
              onChange={(showLog) => updateSemanticSettings({ showLog })}
            />
            <Field label="Max Parallel Update Calls">
              <NumberInput
                min={1}
                value={activeSettings.semanticEvaluationSettings.maxParallelUpdateCalls}
                onChange={(maxParallelUpdateCalls) => updateSemanticSettings({ maxParallelUpdateCalls })}
              />
            </Field>
            <CheckboxField
              label="Route all auto-updates to Memory Inbox (disable to auto-apply without review)"
              checked={activeSettings.semanticEvaluationSettings.requireApprovalForAutoUpdates ?? true}
              onChange={(requireApprovalForAutoUpdates) => updateSemanticSettings({ requireApprovalForAutoUpdates })}
            />
            <p className="muted">
              When on, all LLM-generated updates go to Memory Suggestions for your review instead of applying directly.
            </p>
            <h4>Background Provider</h4>
            <p className="muted">
              Route background tasks (evaluation, brain updates, reference card updates, and plot updates) through a
              separate provider. Leave blank to use the active preset for all tasks.
            </p>
            <Field label="Base URL">
              <input
                value={activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.baseUrl ?? ""}
                placeholder="https://api.groq.com/openai/v1"
                onChange={(e) =>
                  updateSemanticSettings({
                    backgroundProviderConfig: {
                      ...activeSettings.semanticEvaluationSettings.backgroundProviderConfig,
                      baseUrl: e.target.value,
                      model: activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.model ?? "",
                    },
                  })
                }
              />
            </Field>
            <Field label="API Key">
              <input
                type="password"
                value={activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.apiKey ?? ""}
                placeholder="gsk_..."
                onChange={(e) =>
                  updateSemanticSettings({
                    backgroundProviderConfig: {
                      ...activeSettings.semanticEvaluationSettings.backgroundProviderConfig,
                      baseUrl: activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.baseUrl ?? "",
                      model: activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.model ?? "",
                      apiKey: e.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Model">
              <input
                value={activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.model ?? ""}
                placeholder="llama-3.3-70b-versatile"
                onChange={(e) =>
                  updateSemanticSettings({
                    backgroundProviderConfig: {
                      ...activeSettings.semanticEvaluationSettings.backgroundProviderConfig,
                      baseUrl: activeSettings.semanticEvaluationSettings.backgroundProviderConfig?.baseUrl ?? "",
                      model: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </article>
        )}

        {/* ── Memory Detection (advanced) ───────────── */}
        {advanced && (
          <article className="panel settings-card">
            <h3>Memory Detection</h3>
            <p className="muted">
              After each turn, use the evaluation model to detect new durable facts worth storing as memory proposals.
              The pre-filter skips the call when nothing novel is detected.
            </p>
            <CheckboxField
              label="Enable AI memory detection"
              checked={activeSettings.memoryDetectionSettings.enabled}
              onChange={(enabled) => updateMemoryDetection({ enabled })}
            />
            {activeSettings.memoryDetectionSettings.enabled && (
              <>
                <Field label="Run every N turns (1 = every turn)">
                  <NumberInput
                    min={1}
                    value={activeSettings.memoryDetectionSettings.everyNTurns}
                    onChange={(everyNTurns) => updateMemoryDetection({ everyNTurns: Math.max(1, everyNTurns) })}
                  />
                </Field>
                <CheckboxField
                  label="Generate card content"
                  checked={activeSettings.memoryDetectionSettings.generateContent}
                  onChange={(generateContent) => updateMemoryDetection({ generateContent })}
                />
                <p className="muted">
                  When on, the AI writes the proposal body in the same call — more useful but costs more tokens.
                  When off, proposals arrive with blank content for you to fill in.
                </p>
                <div className="auto-approve-toggles">
                  <span className="auto-approve-label muted">Auto-approve:</span>
                  <CheckboxField label="Legacy Summary" checked={activeSettings.memoryAutoApprove.summaryUpdate} onChange={(summaryUpdate) => updateMemoryAutoApprove({ summaryUpdate })} />
                  <CheckboxField label="Plot Essentials" checked={activeSettings.memoryAutoApprove.plotEssentialsUpdate} onChange={(plotEssentialsUpdate) => updateMemoryAutoApprove({ plotEssentialsUpdate })} />
                  <CheckboxField label="Active Pressure" checked={activeSettings.memoryAutoApprove.plotPressureUpdate} onChange={(plotPressureUpdate) => updateMemoryAutoApprove({ plotPressureUpdate })} />
                  <CheckboxField label="Current Arc" checked={activeSettings.memoryAutoApprove.currentArcUpdate} onChange={(currentArcUpdate) => updateMemoryAutoApprove({ currentArcUpdate })} />
                  <CheckboxField label="Arc Proposals" checked={activeSettings.memoryAutoApprove.arcProposal} onChange={(arcProposal) => updateMemoryAutoApprove({ arcProposal })} />
                  <CheckboxField label="Reference Cards" checked={activeSettings.memoryAutoApprove.storyCard} onChange={(storyCard) => updateMemoryAutoApprove({ storyCard })} />
                  <CheckboxField label="Characters" checked={activeSettings.memoryAutoApprove.brainUpdate} onChange={(brainUpdate) => updateMemoryAutoApprove({ brainUpdate })} />
                </div>
                <p className="muted">
                  These toggles apply to Memory Suggestions created by automatic detection, manual builders,
                  inline memory tags, and Plot Essentials history carry-forward.
                </p>
              </>
            )}
          </article>
        )}

        {/* ── Cloud Sync ────────────────────────────── */}
        {showCloudSyncControls && cloudSyncSettings && onCloudSyncSettingsChange && (
          <article className="panel settings-card settings-section-full cloud-sync-panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Personal Cloud Sync</p>
                <h3>Switch between phone and computer</h3>
                <p className="muted">
                  Sync all local adventures through a private GitHub repo. Token is stored only in localStorage.
                </p>
              </div>
            </div>

            <div className="grid three">
              <Field label="GitHub token">
                <input
                  type="password"
                  value={cloudSyncSettings.token}
                  onChange={(e) => updateCloudSync({ token: e.target.value })}
                  placeholder="Fine-grained token with repo contents access"
                />
              </Field>
              <Field label="Owner / username">
                <input
                  value={cloudSyncSettings.owner}
                  onChange={(e) => updateCloudSync({ owner: e.target.value })}
                  placeholder="Leave blank to use token owner"
                />
              </Field>
              <Field label="Private repo">
                <input
                  value={cloudSyncSettings.repo}
                  onChange={(e) => updateCloudSync({ repo: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid three">
              <Field label="Branch">
                <input
                  value={cloudSyncSettings.branch}
                  onChange={(e) => updateCloudSync({ branch: e.target.value })}
                />
              </Field>
              <Field label="Sync file path">
                <input
                  value={cloudSyncSettings.path}
                  onChange={(e) => updateCloudSync({ path: e.target.value })}
                />
              </Field>
              <CheckboxField
                label="Create private repo if missing"
                checked={cloudSyncSettings.createPrivateRepoIfMissing}
                onChange={(createPrivateRepoIfMissing) => updateCloudSync({ createPrivateRepoIfMissing })}
              />
            </div>

            <div className="toolbar">
              <button type="button" disabled={!onPullCloudSync} onClick={() => void runCloudAction("Pull from GitHub", onPullCloudSync)}>
                Pull From GitHub
              </button>
              <button type="button" disabled={!onPushCloudSync} onClick={() => void runCloudAction("Push to GitHub", onPushCloudSync)}>
                Push To GitHub
              </button>
              {cloudSyncStatus && <span className="status-pill">{cloudSyncStatus}</span>}
            </div>
            <p className="notice">
              Sync merges by adventure ID and keeps the newest <code>updatedAt</code> copy. It does not sync provider API keys.
            </p>
          </article>
        )}

        {/* ── Dev Adventure (advanced) ──────────────── */}
        {advanced && onLoadDevelopmentAdventure && (
          <details className="panel settings-card settings-section-full dev-adventure-panel" style={{ gridColumn: "1 / -1" }}>
            <summary>Developer Test Adventure</summary>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Playtest Seed</p>
                <h3>{developmentAdventureTitle}</h3>
                <p className="muted">
                  Loads a complete adult Fire Nation AU scenario with World Blocks, Reference Cards, Characters,
                  semantic triggers, a quest, legacy rolling summary data, and one opening message.
                </p>
              </div>
            </div>
            <div className="toolbar">
              <button type="button" onClick={() => void loadDevelopmentAdventure()}>
                Load Development Adventure
              </button>
              <button
                type="button"
                onClick={() => downloadJson("ai-story-teller-dev-adventure.json", createDevelopmentAdventureJson())}
              >
                Download Adventure JSON
              </button>
              <button
                type="button"
                onClick={() => downloadJson("ai-story-teller-dev-story-cards.json", createDevelopmentStoryCardsJson())}
              >
                Download Reference Cards JSON
              </button>
            </div>
            <p className="notice">
              The full adventure JSON can be re-uploaded through Import / Export. The Reference Cards JSON can be
              pasted or uploaded in New Story setup or the Reference Cards editor.
            </p>
          </details>
        )}

        {advanced && onLoadDispatchAdventure && (
          <details className="panel settings-card settings-section-full dev-adventure-panel" style={{ gridColumn: "1 / -1" }}>
            <summary>Developer Test Adventure — Dispatch (Supers)</summary>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Playtest Seed</p>
                <h3>{dispatchAdventureTitle}</h3>
                <p className="muted">
                  Loads the SDN superhero dispatch scenario: Avery / Titan (Absolute Adaptation), Z-Team, a
                  five-way romantic tangle, a mission loop, preloaded brains, and a configured Arc Director
                  pointed at Shroud and the Red Ring.
                </p>
              </div>
            </div>
            <div className="toolbar">
              <button type="button" onClick={() => void loadDispatchAdventure()}>
                Load Dispatch Adventure
              </button>
              <button
                type="button"
                onClick={() => downloadJson("ai-story-teller-dispatch-adventure.json", createDispatchAdventureJson())}
              >
                Download Adventure JSON
              </button>
              <button
                type="button"
                onClick={() => downloadJson("ai-story-teller-dispatch-story-cards.json", createDispatchStoryCardsJson())}
              >
                Download Reference Cards JSON
              </button>
            </div>
            <p className="notice">
              The full adventure JSON can be re-uploaded through Import / Export. The Reference Cards JSON can be
              pasted or uploaded in New Story setup or the Reference Cards editor.
            </p>
          </details>
        )}

      </div>
    </section>
  );
}
