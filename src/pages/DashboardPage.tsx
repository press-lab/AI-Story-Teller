import { useMemo, useState } from "react";
import { buildContext } from "../contextBuilder/contextBuilder";
import { getCurrentQuestObjective } from "../quests/questEngine";
import type { InputMode } from "../types/adventure";
import type { PlayRuntimeProps } from "./pageTypes";

const inputModes: Array<{ id: InputMode; label: string }> = [
  { id: "story", label: "Story" },
  { id: "do", label: "Do" },
  { id: "comms", label: "Author" },
];

function transformInput(text: string, mode: InputMode): string {
  if (mode === "do" && !/^(you |i |i'|she |he |they |we )/i.test(text)) {
    return "You " + text.charAt(0).toLowerCase() + text.slice(1);
  }
  if (mode === "comms") return `[Out of Character: ${text}]`;
  return text;
}

function recentScene(adventure: PlayRuntimeProps["adventure"]): string {
  const lastAssistant = [...adventure.messages].reverse().find((message) => message.role === "assistant");
  return lastAssistant?.content || adventure.openingScene || "No scene text yet.";
}

export function DashboardPage({
  adventure,
  dispatch,
  contextResult,
  loading,
  error,
  saveStatus,
  onSubmitTurn,
  onContinue,
  onRegenerate,
  onBuildContext,
  onOpenContext,
  onRememberThis,
  onOpenTab,
}: PlayRuntimeProps) {
  const [input, setInput] = useState("");
  const [rememberInput, setRememberInput] = useState("");
  const [mode, setMode] = useState<InputMode>("story");
  const computedContext = useMemo(() => contextResult ?? buildContext(adventure), [adventure, contextResult]);
  const objective = getCurrentQuestObjective(adventure.quests);
  const activeCharacters = adventure.brains.filter((brain) => brain.active);
  const pendingProposals = adventure.activeState.memoryProposals.filter((proposal) => proposal.status === "pending");
  const latestEvaluation = adventure.activeState.evaluationLog[0];

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await onSubmitTurn(transformInput(text, mode), mode);
  }

  async function remember() {
    const text = rememberInput.trim();
    if (!text || loading) return;
    setRememberInput("");
    await onRememberThis(text);
  }

  return (
    <section className="page dashboard-page">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Adventure Cockpit</p>
          <h2>{adventure.title}</h2>
          <p className="muted">
            Turn {adventure.activeState.turn} · {saveStatus}
          </p>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={() => onOpenTab?.("play")}>
            Open Play
          </button>
          <button
            type="button"
            onClick={() => {
              onBuildContext();
              onOpenContext();
            }}
          >
            Inspect Context
          </button>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      <div className="dashboard-grid">
        <article className="panel cockpit-panel current-scene">
          <div className="panel-heading">
            <h3>Current Scene</h3>
            <span>{adventure.messages.length} chronicle messages</span>
          </div>
          <p>{recentScene(adventure)}</p>
        </article>

        <article className="panel cockpit-panel">
          <div className="panel-heading">
            <h3>Objective</h3>
          </div>
          <p>{objective || "No active objective."}</p>
        </article>

        <article className="panel cockpit-panel">
          <div className="panel-heading">
            <h3>Context Budget</h3>
            <button
              type="button"
              onClick={() => {
                onBuildContext();
                onOpenContext();
              }}
            >
              Preview
            </button>
          </div>
          <div className="meter-row">
            <div>
              <strong>{computedContext.totalEstimatedTokens}</strong>
              <span className="muted"> / {adventure.tokenBudgetSettings.maxContextTokens} estimated tokens</span>
            </div>
            <progress
              value={Math.min(computedContext.totalEstimatedTokens, adventure.tokenBudgetSettings.maxContextTokens)}
              max={adventure.tokenBudgetSettings.maxContextTokens}
            />
          </div>
          <p className="muted">
            {computedContext.excludedItems.length} excluded · {computedContext.pendingProposals.length} pending memory proposals
          </p>
        </article>

        <article className="panel cockpit-panel">
          <div className="panel-heading">
            <h3>Characters</h3>
            <button type="button" onClick={() => onOpenTab?.("brains")}>
              Manage
            </button>
          </div>
          {activeCharacters.length ? (
            <ul className="compact-list">
              {activeCharacters.slice(0, 6).map((brain) => (
                <li key={brain.id}>
                  <strong>{brain.characterName}</strong>
                  <span>{brain.lastUpdatedTurn !== undefined ? `updated turn ${brain.lastUpdatedTurn}` : "manual state"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No active character brains.</p>
          )}
        </article>

        <article className="panel cockpit-panel">
          <div className="panel-heading">
            <h3>Memory Inbox</h3>
            <button type="button" onClick={() => onOpenTab?.("memoryInbox")}>
              Review
            </button>
          </div>
          {pendingProposals.length ? (
            <ul className="compact-list">
              {pendingProposals.slice(0, 5).map((proposal) => (
                <li key={proposal.id}>
                  <strong>{proposal.title || proposal.proposedType}</strong>
                  <span>{proposal.proposedType} · {Math.round(proposal.confidence * 100)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No pending proposals.</p>
          )}
        </article>

        <article className="panel cockpit-panel">
          <div className="panel-heading">
            <h3>Evaluation</h3>
            <button type="button" onClick={() => onOpenTab?.("triggers")}>
              Logs
            </button>
          </div>
          {latestEvaluation ? (
            <p>
              Turn {latestEvaluation.turn}: {latestEvaluation.conditionsFired.length} fired,
              {" "}{latestEvaluation.errors.length} errors.
            </p>
          ) : (
            <p className="muted">No semantic evaluation log yet.</p>
          )}
        </article>
      </div>

      <article className="panel dashboard-composer">
        <div className="mode-selector">
          {inputModes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`mode-btn${mode === entry.id ? " active" : ""}`}
              onClick={() => setMode(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <textarea
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Continue the story, take an action, or talk to the AI as author..."
        />
        <div className="composer-actions">
          <button type="button" disabled={loading || !input.trim()} onClick={submit}>
            {loading ? "Generating..." : "Take a Turn"}
          </button>
          <button type="button" disabled={loading} onClick={onContinue}>
            Continue
          </button>
          <button
            type="button"
            disabled={loading || !adventure.messages.some((message) => message.role === "assistant")}
            onClick={onRegenerate}
          >
            Retry
          </button>
          <button
            type="button"
            disabled={loading || adventure.messages.length === 0}
            onClick={() => dispatch({ type: "DELETE_LAST_MESSAGE" })}
          >
            Erase
          </button>
          <button
            type="button"
            disabled={loading || adventure.activeState.storyUndoStack.length === 0}
            onClick={() => dispatch({ type: "UNDO_STORY_EDIT" })}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={loading || adventure.activeState.storyRedoStack.length === 0}
            onClick={() => dispatch({ type: "REDO_STORY_EDIT" })}
          >
            Redo
          </button>
          <span className="muted hint">Ctrl+Enter to submit</span>
        </div>
      </article>

      <article className="panel remember-inline">
        <strong>Remember This</strong>
        <div className="remember-row">
          <input
            value={rememberInput}
            onChange={(event) => setRememberInput(event.target.value)}
            placeholder="Important durable fact to propose as memory..."
          />
          <button type="button" disabled={loading || !rememberInput.trim()} onClick={remember}>
            Remember
          </button>
        </div>
      </article>
    </section>
  );
}
