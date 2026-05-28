import type {
  Adventure,
  AdventureAction,
  AutoCardSettings,
  CloudSyncSettings,
  MemoryPriorityMode,
  ProviderRequestThrottle,
  SemanticEvaluationSettings,
  TokenBudgetSettings,
} from "../types/adventure";
import type { RuntimeProviderSettings } from "./pageTypes";
import { CheckboxField, Field, JsonTextarea, NumberInput } from "./shared";
import {
  cheapTokenBudgetPreset,
  defaultTokenBudgetSettings,
  heavyTokenBudgetPreset,
} from "../state/defaults";
import {
  createDevelopmentAdventureJson,
  createDevelopmentStoryCardsJson,
  developmentAdventureTitle,
} from "../dev/developmentAdventure";

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

interface SettingsPageProps {
  adventure?: Adventure;
  dispatch: (action: AdventureAction) => void;
  providerSettings: RuntimeProviderSettings;
  onProviderSettingsChange: (settings: RuntimeProviderSettings) => void;
  darkMode: boolean;
  onDarkModeChange: (darkMode: boolean) => void;
  cloudSyncSettings?: CloudSyncSettings;
  cloudSyncStatus?: string;
  onCloudSyncSettingsChange?: (settings: CloudSyncSettings) => void;
  onPushCloudSync?: () => Promise<void>;
  onPullCloudSync?: () => Promise<void>;
  onLoadDevelopmentAdventure?: () => Promise<void>;
}

export function SettingsPage({
  adventure,
  dispatch,
  providerSettings,
  onProviderSettingsChange,
  darkMode,
  onDarkModeChange,
  cloudSyncSettings,
  cloudSyncStatus,
  onCloudSyncSettingsChange,
  onPushCloudSync,
  onPullCloudSync,
  onLoadDevelopmentAdventure,
}: SettingsPageProps) {
  function updateCloudSync(patch: Partial<CloudSyncSettings>) {
    if (!cloudSyncSettings || !onCloudSyncSettingsChange) return;
    onCloudSyncSettingsChange({ ...cloudSyncSettings, ...patch });
  }
  function updateProvider(patch: Partial<RuntimeProviderSettings>) {
    const next = { ...providerSettings, ...patch };
    onProviderSettingsChange(next);
    if (adventure) dispatch({ type: "SET_MODEL_CONFIG", config: next });
  }

  function updateThrottle(patch: Partial<ProviderRequestThrottle>) {
    const current = providerSettings.requestThrottle ?? fallbackThrottle;
    updateProvider({ requestThrottle: { ...current, ...patch } });
  }

  function updateBudget(patch: Partial<TokenBudgetSettings>) {
    if (!adventure) return;
    dispatch({ type: "SET_TOKEN_BUDGET_SETTINGS", settings: { ...adventure.tokenBudgetSettings, ...patch } });
  }

  function updateSemanticSettings(patch: Partial<SemanticEvaluationSettings>) {
    if (!adventure) return;
    dispatch({
      type: "SET_SEMANTIC_EVALUATION_SETTINGS",
      settings: { ...adventure.semanticEvaluationSettings, ...patch },
    });
  }

  function updateAutoCardSettings(patch: Partial<AutoCardSettings>) {
    if (!adventure) return;
    dispatch({ type: "SET_AUTO_CARD_SETTINGS", settings: { ...adventure.autoCardSettings, ...patch } });
  }

  return (
    <section className="page">
      <div className="grid two">
        <article className="panel">
          <h3>Interface</h3>
          <CheckboxField label="Dark mode" checked={darkMode} onChange={onDarkModeChange} />
        </article>

        <article className="panel">
          <h3>Provider</h3>
          <Field label="Provider Name">
            <input value={providerSettings.name} onChange={(event) => updateProvider({ name: event.target.value })} />
          </Field>
          <Field label="Base URL">
            <input value={providerSettings.baseUrl} onChange={(event) => updateProvider({ baseUrl: event.target.value })} />
          </Field>
          <Field label="Model">
            <input value={providerSettings.model} onChange={(event) => updateProvider({ model: event.target.value })} />
          </Field>
          <Field label="API Key">
            <input
              type="password"
              value={providerSettings.apiKey}
              onChange={(event) => onProviderSettingsChange({ ...providerSettings, apiKey: event.target.value })}
              placeholder="Stored only in localStorage"
            />
          </Field>
          <div className="grid two">
            <Field label="Temperature">
              <NumberInput value={providerSettings.temperature} onChange={(value) => updateProvider({ temperature: value })} />
            </Field>
            <Field label="Max Output Tokens">
              <NumberInput min={1} value={providerSettings.maxOutputTokens} onChange={(value) => updateProvider({ maxOutputTokens: value })} />
            </Field>
          </div>
          <h4>API Throttle</h4>
          <CheckboxField
            label="Enable API request throttle"
            checked={providerSettings.requestThrottle?.enabled ?? fallbackThrottle.enabled}
            onChange={(enabled) => updateThrottle({ enabled })}
          />
          <div className="grid two">
            <Field label="Minimum seconds between API calls">
              <NumberInput
                min={0}
                value={providerSettings.requestThrottle?.minSecondsBetweenRequests ?? fallbackThrottle.minSecondsBetweenRequests}
                onChange={(minSecondsBetweenRequests) => updateThrottle({ minSecondsBetweenRequests })}
              />
            </Field>
            <Field label="Max API calls per minute">
              <NumberInput
                min={0}
                value={providerSettings.requestThrottle?.maxRequestsPerMinute ?? fallbackThrottle.maxRequestsPerMinute}
                onChange={(maxRequestsPerMinute) => updateThrottle({ maxRequestsPerMinute })}
              />
            </Field>
          </div>
          <p className="muted">
            The throttle is enforced before every provider call, including turns, summaries, Remember This,
            semantic evaluation, and generated memory updates. Use 0 for no per-minute cap.
          </p>
          <p className="muted">API keys are not written to adventure JSON or IndexedDB saves.</p>
        </article>

        {adventure && (
          <>
            <article className="panel">
              <h3>Context Budget</h3>
              <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
                <button type="button" title="8k tokens, 15 messages, tight section budgets — lowest cost" onClick={() => updateBudget(cheapTokenBudgetPreset)}>Cheap</button>
                <button type="button" title="16k tokens, 40 messages — balanced default" onClick={() => updateBudget(defaultTokenBudgetSettings)}>Normal</button>
                <button type="button" title="32k tokens, 80 messages, large section budgets — maximum context" onClick={() => updateBudget(heavyTokenBudgetPreset)}>Heavy</button>
              </div>
              <Field label="Max Context Tokens">
                <NumberInput
                  min={512}
                  value={adventure.tokenBudgetSettings.maxContextTokens}
                  onChange={(value) => updateBudget({ maxContextTokens: value })}
                />
              </Field>
              <Field label="Max Recent Messages">
                <NumberInput
                  min={0}
                  value={adventure.tokenBudgetSettings.maxRecentMessages}
                  onChange={(value) => updateBudget({ maxRecentMessages: value })}
                />
              </Field>
              <Field label="Memory Priority Mode">
                <select
                  value={adventure.tokenBudgetSettings.memoryPriorityMode}
                  onChange={(event) => updateBudget({ memoryPriorityMode: event.target.value as MemoryPriorityMode })}
                >
                  <option value="userLocked">userLocked</option>
                  <option value="systemSuggested">systemSuggested</option>
                  <option value="hybrid">hybrid</option>
                </select>
              </Field>
              <CheckboxField
                label="Allow system to prioritize memory"
                checked={adventure.tokenBudgetSettings.allowSystemToPrioritizeMemory}
                onChange={(allowSystemToPrioritizeMemory) => updateBudget({ allowSystemToPrioritizeMemory })}
              />
              <CheckboxField
                label="Allow system to drop unpinned triggered cards"
                checked={adventure.tokenBudgetSettings.allowSystemToDropUnpinnedTriggeredCards}
                onChange={(allowSystemToDropUnpinnedTriggeredCards) => updateBudget({ allowSystemToDropUnpinnedTriggeredCards })}
              />
              <CheckboxField
                label="Allow system to truncate rolling summary"
                checked={adventure.tokenBudgetSettings.allowSystemToTruncateSummary}
                onChange={(allowSystemToTruncateSummary) => updateBudget({ allowSystemToTruncateSummary })}
              />
              <CheckboxField
                label="Auto-summarize in background"
                checked={adventure.tokenBudgetSettings.autoSummarize ?? true}
                onChange={(autoSummarize) => updateBudget({ autoSummarize })}
              />
              <Field label="Auto-summarize every N turns">
                <NumberInput
                  min={5}
                  value={adventure.tokenBudgetSettings.autoSummarizeEveryNTurns ?? 20}
                  onChange={(autoSummarizeEveryNTurns) => updateBudget({ autoSummarizeEveryNTurns })}
                />
              </Field>
              <Field label="Trigger Recent Message Window">
                <NumberInput
                  min={0}
                  value={adventure.tokenBudgetSettings.recentMessageWindow}
                  onChange={(value) => updateBudget({ recentMessageWindow: value })}
                />
              </Field>
              <Field label="Section Budgets JSON">
                <JsonTextarea
                  value={adventure.tokenBudgetSettings.sectionBudgets}
                  onValidChange={(sectionBudgets) => updateBudget({ sectionBudgets })}
                />
              </Field>
            </article>

            <article className="panel">
              <h3>LLM Evaluation</h3>
              <Field label="Evaluation Model Override">
                <input
                  value={adventure.semanticEvaluationSettings.evaluationModel}
                  placeholder={providerSettings.model}
                  onChange={(event) => updateSemanticSettings({ evaluationModel: event.target.value })}
                />
              </Field>
              <Field label="Messages Included In Evaluation">
                <NumberInput
                  min={1}
                  value={adventure.semanticEvaluationSettings.messagesIncluded}
                  onChange={(messagesIncluded) => updateSemanticSettings({ messagesIncluded })}
                />
              </Field>
              <CheckboxField
                label="Enable semantic triggers"
                checked={adventure.semanticEvaluationSettings.enabled}
                onChange={(enabled) => updateSemanticSettings({ enabled })}
              />
              <CheckboxField
                label="Show evaluation log on Automations page"
                checked={adventure.semanticEvaluationSettings.showLog}
                onChange={(showLog) => updateSemanticSettings({ showLog })}
              />
              <Field label="Max Parallel Update Calls">
                <NumberInput
                  min={1}
                  value={adventure.semanticEvaluationSettings.maxParallelUpdateCalls}
                  onChange={(maxParallelUpdateCalls) => updateSemanticSettings({ maxParallelUpdateCalls })}
                />
              </Field>
              <CheckboxField
                label="Require approval before applying auto-updates"
                checked={adventure.semanticEvaluationSettings.requireApprovalForAutoUpdates ?? false}
                onChange={(requireApprovalForAutoUpdates) => updateSemanticSettings({ requireApprovalForAutoUpdates })}
              />
              <p className="muted">
                When on, all LLM-generated brain, story card, and Plot Essentials updates go to the
                Memory Suggestions as proposals for your review instead of applying directly.
              </p>
            </article>

            <article className="panel">
              <h3>Auto-Cards</h3>
              <CheckboxField label="Enable Auto-Cards" checked={adventure.autoCardSettings.enabled} onChange={(enabled) => updateAutoCardSettings({ enabled })} />
              <Field label="Detection Condition">
                <textarea
                  rows={3}
                  value={adventure.autoCardSettings.detectionCondition}
                  onChange={(event) => updateAutoCardSettings({ detectionCondition: event.target.value })}
                />
              </Field>
              <Field label="Generation Prompt">
                <textarea
                  rows={5}
                  value={adventure.autoCardSettings.generationPrompt}
                  onChange={(event) => updateAutoCardSettings({ generationPrompt: event.target.value })}
                />
              </Field>
              <Field label="Cooldown Between Generations (turns)">
                <NumberInput
                  min={0}
                  value={adventure.autoCardSettings.cooldownTurns}
                  onChange={(cooldownTurns) => updateAutoCardSettings({ cooldownTurns })}
                />
              </Field>
            </article>
          </>
        )}

        {cloudSyncSettings && onCloudSyncSettingsChange && (
          <article className="panel cloud-sync-panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Personal Cloud Sync</p>
                <h3>Switch between phone and computer</h3>
                <p className="muted">
                  Sync all local adventures through a private GitHub repo while keeping this app hosted on GitHub Pages.
                  The token is stored only in this browser's localStorage.
                </p>
              </div>
            </div>

            <div className="grid three">
              <Field label="GitHub token">
                <input
                  type="password"
                  value={cloudSyncSettings.token}
                  onChange={(event) => updateCloudSync({ token: event.target.value })}
                  placeholder="Fine-grained token with repo contents access"
                />
              </Field>
              <Field label="Owner / username">
                <input
                  value={cloudSyncSettings.owner}
                  onChange={(event) => updateCloudSync({ owner: event.target.value })}
                  placeholder="Leave blank to use token owner"
                />
              </Field>
              <Field label="Private repo">
                <input
                  value={cloudSyncSettings.repo}
                  onChange={(event) => updateCloudSync({ repo: event.target.value })}
                />
              </Field>
            </div>

            <div className="grid three">
              <Field label="Branch">
                <input
                  value={cloudSyncSettings.branch}
                  onChange={(event) => updateCloudSync({ branch: event.target.value })}
                />
              </Field>
              <Field label="Sync file path">
                <input
                  value={cloudSyncSettings.path}
                  onChange={(event) => updateCloudSync({ path: event.target.value })}
                />
              </Field>
              <CheckboxField
                label="Create private repo if missing"
                checked={cloudSyncSettings.createPrivateRepoIfMissing}
                onChange={(createPrivateRepoIfMissing) => updateCloudSync({ createPrivateRepoIfMissing })}
              />
            </div>

            <div className="toolbar">
              <button type="button" disabled={!onPullCloudSync} onClick={onPullCloudSync}>
                Pull From GitHub
              </button>
              <button type="button" disabled={!onPushCloudSync} onClick={onPushCloudSync}>
                Push To GitHub
              </button>
              {cloudSyncStatus && <span className="status-pill">{cloudSyncStatus}</span>}
            </div>
            <p className="notice">
              Sync merges by adventure ID and keeps the newest <code>updatedAt</code> copy. It does not sync provider API keys.
            </p>
          </article>
        )}

        {onLoadDevelopmentAdventure && (
          <details className="panel dev-adventure-panel" style={{ gridColumn: "1 / -1" }}>
            <summary>Developer Test Adventure</summary>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Playtest Seed</p>
                <h3>{developmentAdventureTitle}</h3>
                <p className="muted">
                  Loads a complete adult Fire Nation AU scenario with World Blocks, Story Cards, Characters,
                  semantic triggers, a quest, a rolling summary, and one opening message. Use it to test live
                  LLM updates without rebuilding setup by hand.
                </p>
              </div>
            </div>
            <div className="toolbar">
              <button type="button" onClick={onLoadDevelopmentAdventure}>
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
                Download Story Cards JSON
              </button>
            </div>
            <p className="notice">
              The full adventure JSON can be re-uploaded through Import / Export. The Story Cards JSON can be
              pasted or uploaded in New Adventure setup or the Story Cards editor.
            </p>
          </details>
        )}
      </div>
    </section>
  );
}
