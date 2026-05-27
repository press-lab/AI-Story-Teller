import { useState } from "react";
import { getCurrentQuestObjective } from "../quests/questEngine";
import type { InputMode, Message, ResponseLengthHint } from "../types/adventure";
import type { PlayRuntimeProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput } from "./shared";

const MODE_LABELS: Record<InputMode, string> = {
  do: "Do",
  story: "Story",
  comms: "Author",
};

const MODE_PLACEHOLDERS: Record<InputMode, string> = {
  do: "What do you do? (prefixed with 'You ')",
  story: "Guide the next story beat...",
  comms: "Ask the AI a question or give it direction (out of character)...",
};

function transformInput(text: string, mode: InputMode): string {
  if (mode === "do" && !/^(you |i |i'|she |he |they |we )/i.test(text)) {
    return "You " + text.charAt(0).toLowerCase() + text.slice(1);
  }
  if (mode === "comms") return `[Out of Character: ${text}]`;
  return text;
}

function messageLabel(role: string, mode?: InputMode): string {
  if (mode === "comms") return role === "user" ? "Author" : "AI (Author)";
  if (mode === "do") return "You";
  if (role === "assistant") return "AI";
  return "You";
}

function messageRows(message: Message): number {
  return Math.max(3, Math.min(12, message.content.split(/\n/).length + 2));
}

export function PlayPage({
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
  const [inputMode, setInputMode] = useState<InputMode>("story");
  const [rememberInput, setRememberInput] = useState("");
  const [showRemember, setShowRemember] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | undefined>();

  const lastAssistant = [...adventure.messages].reverse().find((m) => m.role === "assistant");
  const nextTurnNote = adventure.activeState.nextTurnNote;

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    await onSubmitTurn(transformInput(text, inputMode), inputMode);
  }

  async function remember() {
    const text = rememberInput.trim();
    if (!text || loading) return;
    setRememberInput("");
    setShowRemember(false);
    await onRememberThis(text);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  }

  function handleRememberKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void remember();
    if (event.key === "Escape") setShowRemember(false);
  }

  const hasSetupContent = Boolean(adventure.openingScene.trim() || nextTurnNote.content.trim());

  return (
    <section className="page play-layout">
      <header className="play-header panel">
        <div>
          <h2>{adventure.title}</h2>
          <p className="muted">Turn {adventure.activeState.turn} · {saveStatus}</p>
        </div>
        <div className="token-strip">
          <span>{contextResult?.totalEstimatedTokens ?? 0} tokens</span>
          {getCurrentQuestObjective(adventure.quests) && (
            <span>{getCurrentQuestObjective(adventure.quests)}</span>
          )}
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      <div className="story-setup-row">
        <details className="panel opening-scene-details">
          <summary>Opening Scene {adventure.openingScene ? "" : "(not set)"}</summary>
          <Field label="The AI's first message before any player input — always protected in context">
            <textarea
              rows={5}
              value={adventure.openingScene}
              onChange={(event) => dispatch({ type: "SET_OPENING_SCENE", content: event.target.value })}
              placeholder="Describe the opening scene. Appears as the first assistant message in every context window."
            />
          </Field>
        </details>

        <details className="panel next-turn-note" open={Boolean(nextTurnNote.content.trim())}>
          <summary>Next Output Bias {nextTurnNote.content.trim() ? "" : "(empty)"}</summary>
          <Field label="Visible next-output steering note">
            <textarea
              rows={3}
              value={nextTurnNote.content}
              onChange={(event) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { content: event.target.value } })}
              placeholder="e.g. Keep the next output focused on the oath's consequences."
            />
          </Field>
          <div className="grid four">
            <CheckboxField
              label="Active"
              checked={nextTurnNote.active}
              onChange={(active) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { active } })}
            />
            <CheckboxField
              label="Pinned"
              checked={nextTurnNote.pinned}
              onChange={(pinned) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { pinned } })}
            />
            <CheckboxField
              label="Protected"
              checked={nextTurnNote.protected}
              onChange={(protectedValue) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { protected: protectedValue } })}
            />
            <CheckboxField
              label="Expires after output"
              checked={nextTurnNote.expiresAfterUse}
              onChange={(expiresAfterUse) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { expiresAfterUse } })}
            />
          </div>
          <div className="toolbar">
            <Field label="Priority">
              <NumberInput
                value={nextTurnNote.priority}
                onChange={(priority) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { priority } })}
              />
            </Field>
            <button type="button" onClick={() => dispatch({ type: "CLEAR_NEXT_TURN_NOTE" })}>
              Clear
            </button>
          </div>
        </details>
      </div>

      <div className="transcript">
        {adventure.messages.length === 0 && (
          <p className="muted">No turns yet. Set up your world, then start playing below.</p>
        )}
        {adventure.messages.map((message) => (
          <article
            key={message.id}
            className={`message ${message.role}${message.inputMode === "comms" ? " comms" : ""}`}
          >
            <div className="message-toolbar">
              <strong className="message-label">{messageLabel(message.role, message.inputMode)}</strong>
              <div className="message-actions">
                <button
                  type="button"
                  onClick={() => setEditingMessageId(editingMessageId === message.id ? undefined : message.id)}
                >
                  {editingMessageId === message.id ? "Done" : "Edit"}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => dispatch({ type: "DELETE_MESSAGE", messageId: message.id })}
                >
                  Delete
                </button>
              </div>
            </div>
            {editingMessageId === message.id ? (
              <textarea
                className="message-editor"
                rows={messageRows(message)}
                value={message.content}
                onChange={(event) =>
                  dispatch({ type: "UPDATE_MESSAGE", messageId: message.id, content: event.target.value })
                }
              />
            ) : (
              <p onDoubleClick={() => setEditingMessageId(message.id)}>{message.content}</p>
            )}
          </article>
        ))}
      </div>

      <div className="composer panel">
        <div className="mode-selector">
          {(["do", "story", "comms"] as InputMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`mode-btn${inputMode === mode ? " active" : ""}`}
              onClick={() => setInputMode(mode)}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
          <span className="mode-sep" aria-hidden="true">|</span>
          {(["short", "medium", "long"] as ResponseLengthHint[]).map((hint) => (
            <button
              key={hint}
              type="button"
              className={`mode-btn length-btn${adventure.activeState.responseLengthHint === hint ? " active" : ""}`}
              title={{ short: "Short (~50–150 words)", medium: "Medium (~150–300 words)", long: "Long (~300–600 words)" }[hint]}
              onClick={() => dispatch({ type: "SET_RESPONSE_LENGTH_HINT", hint })}
            >
              {hint[0].toUpperCase()}
            </button>
          ))}
          <span className="muted mode-hint">
            {inputMode === "do" && "Character action + quoted dialogue"}
            {inputMode === "story" && "Guide the narrative direction"}
            {inputMode === "comms" && "Talk to the AI out of character"}
          </span>
        </div>
        <textarea
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={MODE_PLACEHOLDERS[inputMode]}
        />
        {showRemember && (
          <div className="remember-inline-row">
            <input
              autoFocus
              value={rememberInput}
              onChange={(event) => setRememberInput(event.target.value)}
              onKeyDown={handleRememberKeyDown}
              placeholder="e.g. Mira and Kael are now married"
            />
            <button type="button" disabled={loading || !rememberInput.trim()} onClick={remember}>
              Save
            </button>
            <button type="button" onClick={() => setShowRemember(false)}>✕</button>
          </div>
        )}
        <div className="composer-actions">
          <button type="button" disabled={loading || !input.trim()} onClick={submit}>
            {loading ? "Generating..." : "Take a Turn"}
          </button>
          <button type="button" disabled={loading} onClick={onContinue}>
            Continue
          </button>
          <button type="button" disabled={loading || !lastAssistant} onClick={onRegenerate}>
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
          <button
            type="button"
            className={showRemember ? "active-tool" : ""}
            onClick={() => setShowRemember((v) => !v)}
          >
            Remember
          </button>
          <button
            type="button"
            onClick={() => { onBuildContext(); onOpenContext(); }}
          >
            Context Preview
          </button>
          <span className="muted hint">Ctrl+Enter to submit</span>
        </div>
      </div>
    </section>
  );
}
