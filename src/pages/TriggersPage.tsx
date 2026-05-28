import { useState } from "react";
import type { TriggerEvaluationMode, TriggerMatchType, TriggerSource } from "../types/adventure";
import { makeTriggerRule } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, JsonTextarea, NumberInput, commaList, fromCommaList } from "./shared";

const sources: TriggerSource[] = ["input", "output", "both"];
const matchTypes: TriggerMatchType[] = ["keyword", "phrase", "regex"];
const evaluationModes: TriggerEvaluationMode[] = ["semantic", "keyword", "regex"];

export function TriggersPage({ adventure, dispatch }: AdventurePageProps) {
  const [flagKey, setFlagKey] = useState("");
  const [flagValue, setFlagValue] = useState("");

  function setFlag() {
    const key = flagKey.trim();
    if (!key) return;
    const raw = flagValue.trim();
    const value = raw === "true" ? true : raw === "false" ? false : !Number.isNaN(Number(raw)) && raw !== "" ? Number(raw) : raw;
    dispatch({ type: "SET_STATE_FLAG", key, value });
    setFlagKey("");
    setFlagValue("");
  }

  return (
    <section className="page">
      <article className="panel">
        <h3>Automations</h3>
        <p className="muted">
          Trigger rules run automatically after each turn and fire actions when their conditions match.
          <strong> Keyword / regex</strong> triggers scan story text synchronously (before and after AI generation) — they're fast and exact.
          <strong> Semantic</strong> triggers use the AI to evaluate natural-language conditions after the turn completes — they don't block the UI and run in the background.
        </p>
        <p className="muted">
          Actions can update Story Cards, Brains, Plot Essentials, set state flags, or create Memory Suggestion proposals.
          Check the Trigger History and Evaluation Log panels to see what fired and why.
        </p>
      </article>

      <div className="toolbar">
        <button type="button" onClick={() => dispatch({ type: "UPSERT_TRIGGER_RULE", triggerRule: makeTriggerRule({ name: "New Trigger" }) })}>
          Create Trigger
        </button>
      </div>

      <div className="grid two">
        <div className="list">
          {[...adventure.triggerRules].sort((a, b) => b.priority - a.priority).map((rule) => (
            <article key={rule.id} className="card editor-card">
              <div className="grid two">
                <Field label="Name">
                  <input
                    value={rule.name}
                    onChange={(event) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { name: event.target.value } })}
                  />
                </Field>
                <CheckboxField
                  label="Enabled"
                  checked={rule.enabled}
                  onChange={(checked) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { enabled: checked } })}
                />
              </div>
              <div className="grid four">
                <Field label="Evaluation Mode">
                  <select
                    value={rule.evaluationMode ?? "semantic"}
                    onChange={(event) =>
                      dispatch({
                        type: "UPDATE_TRIGGER_RULE",
                        triggerRuleId: rule.id,
                        patch: { evaluationMode: event.target.value as TriggerEvaluationMode },
                      })
                    }
                  >
                    {evaluationModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source">
                  <select
                    value={rule.source}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { source: event.target.value as TriggerSource } })
                    }
                  >
                    {sources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Match Type">
                  <select
                    value={rule.matchType}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { matchType: event.target.value as TriggerMatchType } })
                    }
                  >
                    {matchTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <NumberInput
                    value={rule.priority}
                    onChange={(value) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { priority: value } })}
                  />
                </Field>
                <Field label="Cooldown">
                  <NumberInput
                    min={0}
                    value={rule.cooldownTurns}
                    onChange={(value) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { cooldownTurns: value } })}
                  />
                </Field>
              </div>
              <Field label="Semantic Condition">
                <textarea
                  rows={3}
                  value={rule.condition}
                  onChange={(event) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { condition: event.target.value } })}
                />
              </Field>
              <Field label="Update Prompt Override">
                <textarea
                  rows={4}
                  value={rule.updatePrompt}
                  placeholder="Optional. Generated content actions use their default target prompt when this is empty."
                  onChange={(event) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { updatePrompt: event.target.value } })}
                />
              </Field>
              <Field label="Patterns">
                <input
                  value={commaList(rule.patterns)}
                  onChange={(event) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { patterns: fromCommaList(event.target.value) } })}
                />
              </Field>
              <Field label="Conditions JSON">
                <JsonTextarea value={rule.conditions} onValidChange={(conditions) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { conditions } })} />
              </Field>
              <Field label="Actions JSON">
                <JsonTextarea value={rule.actions} onValidChange={(actions) => dispatch({ type: "UPDATE_TRIGGER_RULE", triggerRuleId: rule.id, patch: { actions } })} rows={8} />
              </Field>
              <p className="muted">Last fired turn: {rule.lastFiredTurn ?? "never"}</p>
              <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_TRIGGER_RULE", triggerRuleId: rule.id })}>
                Delete
              </button>
            </article>
          ))}
        </div>

        <article className="panel">
          <h3>Trigger History</h3>
          {adventure.activeState.triggerLog.length === 0 && <p className="muted">No triggers fired yet.</p>}
          {adventure.activeState.triggerLog.map((entry) => (
            <div key={entry.id} className="log-entry">
              <strong>{entry.triggerName}</strong>
              <p>
                Turn {entry.turn} · {entry.source} · pattern {entry.matchedPattern ?? "(unknown)"} · {entry.actionCount} actions
              </p>
              <p className="muted">{entry.textSnippet}</p>
            </div>
          ))}
        </article>

        {adventure.semanticEvaluationSettings.showLog && (
          <article className="panel">
            <h3>Evaluation Log</h3>
            {adventure.activeState.evaluationLog.length === 0 && <p className="muted">No semantic evaluations logged yet.</p>}
            {adventure.activeState.evaluationLog.slice(0, 20).map((entry) => (
              <details key={entry.id} className="log-entry">
                <summary>
                  Turn {entry.turn}: {entry.conditionsFired.length} fired / {entry.conditionsEvaluated.length} evaluated
                </summary>
                <p className="muted">Created {new Date(entry.createdAt).toLocaleString()}</p>
                <h4>Fired Conditions</h4>
                <pre>{JSON.stringify(entry.conditionsFired, null, 2)}</pre>
                <h4>Actions Executed</h4>
                <pre>{JSON.stringify(entry.actionsExecuted, null, 2)}</pre>
                <h4>Generated Content</h4>
                <pre>{JSON.stringify(entry.generatedContent, null, 2)}</pre>
                <h4>Errors</h4>
                <pre>{JSON.stringify(entry.errors, null, 2)}</pre>
                <h4>Conditions Evaluated</h4>
                <pre>{JSON.stringify(entry.conditionsEvaluated, null, 2)}</pre>
              </details>
            ))}
          </article>
        )}

        <article className="panel">
          <h3>State Flags</h3>
          <p className="muted">Runtime key-value flags readable by trigger conditions (<code>field: "stateFlag"</code>). Values auto-typed: "true"/"false" → boolean, numeric strings → number, everything else → string.</p>
          {Object.keys(adventure.activeState.stateFlags).length === 0 && <p className="muted">No flags set.</p>}
          {Object.entries(adventure.activeState.stateFlags).map(([key, value]) => (
            <div key={key} className="card">
              <div className="grid two">
                <span><strong>{key}</strong></span>
                <span className="muted">{typeof value}: {String(value)}</span>
              </div>
              <button
                type="button"
                className="danger"
                onClick={() => dispatch({ type: "SET_STATE_FLAG", key, value: "" })}
              >
                Clear
              </button>
            </div>
          ))}
          <div className="grid two">
            <Field label="Key">
              <input value={flagKey} onChange={(event) => setFlagKey(event.target.value)} placeholder="flagName" />
            </Field>
            <Field label="Value">
              <input value={flagValue} onChange={(event) => setFlagValue(event.target.value)} placeholder="true / false / 0 / string" />
            </Field>
          </div>
          <button type="button" disabled={!flagKey.trim()} onClick={setFlag}>
            Set Flag
          </button>
        </article>
      </div>
    </section>
  );
}
