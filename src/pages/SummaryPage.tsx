import { useState } from "react";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput } from "./shared";

interface SummaryPageProps extends AdventurePageProps {
  onGenerateDurableSummary: () => Promise<string>;
  onGenerateSceneState: () => Promise<string>;
}

export function SummaryPage({ adventure, dispatch, onGenerateDurableSummary, onGenerateSceneState }: SummaryPageProps) {
  const [durableDraft, setDurableDraft] = useState<string | null>(null);
  const [durableLoading, setDurableLoading] = useState(false);
  const [durableError, setDurableError] = useState<string | undefined>();

  const [sceneDraft, setSceneDraft] = useState<string | null>(null);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | undefined>();

  async function handleGenerateDurable() {
    setDurableLoading(true);
    setDurableError(undefined);
    try {
      const text = await onGenerateDurableSummary();
      setDurableDraft(text);
    } catch (err) {
      setDurableError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setDurableLoading(false);
    }
  }

  async function handleGenerateScene() {
    setSceneLoading(true);
    setSceneError(undefined);
    try {
      const text = await onGenerateSceneState();
      setSceneDraft(text);
    } catch (err) {
      setSceneError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setSceneLoading(false);
    }
  }

  const durableValue = durableDraft ?? adventure.rollingSummary.content;
  const sceneValue = sceneDraft ?? adventure.sceneState?.content ?? "";
  const savedSceneContent = adventure.sceneState?.content ?? "";

  return (
    <section className="page">
      <article className="panel">
        <h3>Durable Story Summary</h3>
        <p className="muted">
          Long-term canon — arc beats, permanent changes, relationships, open plot threads.
          Sent every turn so older history stays alive. New facts are appended automatically.
        </p>
        <div className="grid two">
          <CheckboxField
            label="Auto-summarize"
            checked={adventure.tokenBudgetSettings.autoSummarize ?? true}
            onChange={(autoSummarize) => dispatch({ type: "SET_TOKEN_BUDGET_SETTINGS", settings: { ...adventure.tokenBudgetSettings, autoSummarize } })}
          />
          <Field label="Every N turns">
            <NumberInput
              min={1}
              value={adventure.tokenBudgetSettings.autoSummarizeEveryNTurns ?? 20}
              onChange={(autoSummarizeEveryNTurns) => dispatch({ type: "SET_TOKEN_BUDGET_SETTINGS", settings: { ...adventure.tokenBudgetSettings, autoSummarizeEveryNTurns } })}
            />
          </Field>
        </div>
      </article>

      <div className="toolbar">
        <button type="button" disabled={durableLoading} onClick={handleGenerateDurable}>
          {durableLoading ? "Generating..." : "Regenerate"}
        </button>
        {durableDraft !== null && durableDraft !== adventure.rollingSummary.content && (
          <>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "UPDATE_ROLLING_SUMMARY", content: durableDraft, lastSummarizedMessageIndex: adventure.messages.length });
                setDurableDraft(null);
              }}
            >
              Apply
            </button>
            <button type="button" onClick={() => setDurableDraft(null)}>Discard</button>
          </>
        )}
        <span className="muted">Updated {new Date(adventure.rollingSummary.updatedAt).toLocaleString()}</span>
      </div>
      {durableError && <p className="error">{durableError}</p>}
      <textarea
        rows={12}
        value={durableValue}
        onChange={(e) => {
          if (durableDraft !== null) {
            setDurableDraft(e.target.value);
          } else {
            dispatch({ type: "UPDATE_ROLLING_SUMMARY", content: e.target.value });
          }
        }}
        placeholder="A durable summary of permanent story events, established facts, and open plot threads."
      />

      <article className="panel">
        <h3>Current Scene State</h3>
        <p className="muted">
          Immediate present — current location, present characters, last important beat.
          Placed just before Recent Messages to ground the model in the current moment.
        </p>
        <CheckboxField
          label="Include scene state in context and auto-update"
          checked={adventure.tokenBudgetSettings.sceneStateEnabled !== false}
          onChange={(sceneStateEnabled) => dispatch({ type: "SET_TOKEN_BUDGET_SETTINGS", settings: { ...adventure.tokenBudgetSettings, sceneStateEnabled } })}
        />
      </article>

      <div className="toolbar">
        <button type="button" disabled={sceneLoading} onClick={handleGenerateScene}>
          {sceneLoading ? "Generating..." : "Regenerate"}
        </button>
        {sceneDraft !== null && sceneDraft !== savedSceneContent && (
          <>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "UPDATE_SCENE_STATE", content: sceneDraft });
                setSceneDraft(null);
              }}
            >
              Apply
            </button>
            <button type="button" onClick={() => setSceneDraft(null)}>Discard</button>
          </>
        )}
        {adventure.sceneState?.updatedAt && (
          <span className="muted">Updated {new Date(adventure.sceneState.updatedAt).toLocaleString()}</span>
        )}
      </div>
      {sceneError && <p className="error">{sceneError}</p>}
      <textarea
        rows={6}
        value={sceneValue}
        onChange={(e) => {
          if (sceneDraft !== null) {
            setSceneDraft(e.target.value);
          } else {
            dispatch({ type: "UPDATE_SCENE_STATE", content: e.target.value });
          }
        }}
        placeholder="Current location, present characters, last story beat."
      />
    </section>
  );
}
