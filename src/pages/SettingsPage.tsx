import type { Adventure, AdventureAction, AutoCardSettings, MemoryPriorityMode, SemanticEvaluationSettings, TokenBudgetSettings } from "../types/adventure";
import type { RuntimeProviderSettings } from "./pageTypes";
import { CheckboxField, Field, JsonTextarea, NumberInput } from "./shared";

interface SettingsPageProps {
  adventure?: Adventure;
  dispatch: (action: AdventureAction) => void;
  providerSettings: RuntimeProviderSettings;
  onProviderSettingsChange: (settings: RuntimeProviderSettings) => void;
  darkMode: boolean;
  onDarkModeChange: (darkMode: boolean) => void;
}

export function SettingsPage({
  adventure,
  dispatch,
  providerSettings,
  onProviderSettingsChange,
  darkMode,
  onDarkModeChange,
}: SettingsPageProps) {
  function updateProvider(patch: Partial<RuntimeProviderSettings>) {
    const next = { ...providerSettings, ...patch };
    onProviderSettingsChange(next);
    if (adventure) dispatch({ type: "SET_MODEL_CONFIG", config: next });
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
          <p className="muted">API keys are not written to adventure JSON or IndexedDB saves.</p>
        </article>

        {adventure && (
          <>
            <article className="panel">
              <h3>Context Budget</h3>
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
      </div>
    </section>
  );
}
