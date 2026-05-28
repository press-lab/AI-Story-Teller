import { useEffect, useRef, useState } from "react";
import { AdventureThumbnailFrame } from "../components/AdventureThumbnail";
import { getCurrentQuestObjective } from "../quests/questEngine";
import type { InputMode, Message } from "../types/adventure";
import { getAdventureThumbnail } from "../utils/adventureImages";
import type { PlayRuntimeProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput } from "./shared";

const MODES: InputMode[] = ["do", "story", "comms"];

const MODE_LABELS: Record<InputMode, string> = {
  do: "Do",
  story: "Story",
  comms: "Author",
};

const MODE_TOOLTIPS: Record<InputMode, string> = {
  do: "Do — describe your character's action. Gets prefixed with 'You ' automatically.",
  story: "Story — directly add or guide the next story beat, as the narrator.",
  comms: "Author — out-of-character message to the AI. Use for questions or instructions about the story.",
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
  const [showOverflow, setShowOverflow] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | undefined>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editingArticleRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAssistant = [...adventure.messages].reverse().find((m) => m.role === "assistant");
  const nextTurnNote = adventure.activeState.nextTurnNote;
  const pendingMemoryCount = adventure.activeState.memoryProposals.filter((proposal) => proposal.status === "pending").length;
  const thumbnail = getAdventureThumbnail(adventure);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [adventure.messages.length]);

  useEffect(() => {
    if (composerOpen) textareaRef.current?.focus();
  }, [composerOpen]);

  useEffect(() => {
    if (!editingMessageId) return;
    function handlePointerDown(e: PointerEvent) {
      if (editingArticleRef.current && !editingArticleRef.current.contains(e.target as Node)) {
        setEditingMessageId(undefined);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [editingMessageId]);

  function cycleMode(dir: 1 | -1) {
    const idx = MODES.indexOf(inputMode);
    setInputMode(MODES[(idx + dir + MODES.length) % MODES.length]);
  }

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setComposerOpen(false);
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
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void submit();
    }
  }

  function handleRememberKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void remember();
    if (event.key === "Escape") setShowRemember(false);
  }

  return (
    <section className="page play-layout">
      {error && <div className="error-box">{error}</div>}

      <div className="play-main">
        <div className="transcript" onClick={() => setComposerOpen(false)}>
          {adventure.openingScene && (
            <article className="message assistant opening-scene-message">
              <p>{adventure.openingScene}</p>
            </article>
          )}
          {!adventure.openingScene && adventure.messages.length === 0 && (
            <p className="muted">No turns yet. Set up your world, then start playing below.</p>
          )}
          {adventure.messages.map((message) => (
            <article
              key={message.id}
              ref={(el) => { if (editingMessageId === message.id) editingArticleRef.current = el; }}
              className={`message ${message.role}${message.inputMode === "comms" ? " comms" : ""}${message.inputMode === "do" ? " mode-do" : ""}${editingMessageId === message.id ? " editing" : ""}`}
            >
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
          <div ref={bottomRef} />
        </div>

        <div className={`composer panel${composerOpen ? "" : " composer-input-closed"}`}>
          <div className="mode-selector">
            {/* Desktop: individual pill buttons */}
            {(["do", "story", "comms"] as InputMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                title={MODE_TOOLTIPS[mode]}
                className={`mode-btn mode-btn-full${inputMode === mode ? " active" : ""}`}
                onClick={() => setInputMode(mode)}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
            {/* Mobile: cycling mode pill */}
            <div className="mode-cycle">
              <button type="button" className="mode-cycle-arrow" onClick={() => cycleMode(-1)} title="Previous mode">‹</button>
              <span className="mode-cycle-label" title={MODE_TOOLTIPS[inputMode]}>{MODE_LABELS[inputMode]}</span>
              <button type="button" className="mode-cycle-arrow" onClick={() => cycleMode(1)} title="Next mode">›</button>
            </div>
            <span className="mode-sep" aria-hidden="true">|</span>
            <label className="length-slider-label">
              <span className="muted length-label-text">{adventure.activeState.responseLengthHint ?? 150}w</span>
              <input
                type="range"
                className="length-slider"
                min={50}
                max={200}
                step={10}
                value={adventure.activeState.responseLengthHint ?? 150}
                onChange={(event) => dispatch({ type: "SET_RESPONSE_LENGTH_HINT", hint: Number(event.target.value) })}
                title={`Response length: ~${adventure.activeState.responseLengthHint ?? 150} words`}
              />
            </label>
            <span className="muted mode-hint">
              {inputMode === "do" && "Character action + quoted dialogue"}
              {inputMode === "story" && "Guide the narrative direction"}
              {inputMode === "comms" && "Talk to the AI out of character"}
            </span>
          </div>
          <div className="composer-input-row">
            <textarea
              ref={textareaRef}
              rows={4}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={MODE_PLACEHOLDERS[inputMode]}
            />
            <button
              type="button"
              className="composer-send-btn"
              disabled={loading || !input.trim()}
              onClick={submit}
              title={loading ? "Generating…" : "Take a Turn"}
            >
              {loading ? "…" : "↑"}
            </button>
          </div>
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
            <button type="button" className="take-a-turn-full" disabled={loading || !input.trim()} onClick={submit}>
              {loading ? "Generating..." : "Take a Turn"}
            </button>
            <div className={`secondary-actions${showOverflow ? " show-overflow" : ""}`}>
              <button
                type="button"
                className={`take-a-turn-mobile${input.trim() ? " has-input" : ""}`}
                onClick={() => setComposerOpen(true)}
              >
                {input.trim() ? "↑ Send" : "Take a Turn"}
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
                className="action-extra"
                disabled={loading || adventure.activeState.storyUndoStack.length === 0}
                onClick={() => dispatch({ type: "UNDO_STORY_EDIT" })}
              >
                Undo
              </button>
              <button
                type="button"
                className="action-extra"
                disabled={loading || adventure.activeState.storyRedoStack.length === 0}
                onClick={() => dispatch({ type: "REDO_STORY_EDIT" })}
              >
                Redo
              </button>
              <button
                type="button"
                className={`action-extra${showRemember ? " active-tool" : ""}`}
                onClick={() => setShowRemember((v) => !v)}
              >
                Remember
              </button>
              <button
                type="button"
                className="action-extra"
                onClick={() => { onBuildContext(); onOpenContext(); }}
              >
                Context Preview
              </button>
              <button
                type="button"
                className="action-overflow-toggle"
                onClick={() => setShowOverflow((v) => !v)}
                title="More actions"
              >
                {showOverflow ? "✕" : "···"}
              </button>
            </div>
            <span className="muted hint">Enter to submit · Shift+Enter for newline</span>
          </div>
        </div>
      </div>

      <aside className="play-sidebar">
        <header className="play-header panel">
          <AdventureThumbnailFrame thumbnail={thumbnail} title={adventure.title} className="play-sidebar-thumbnail" />
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
        <nav className="panel play-tool-drawer" aria-label="Adventure tools">
          <p className="eyebrow">Adventure Tools</p>
          <div className="play-tool-grid">
            <button type="button" onClick={() => onOpenTab?.("components")}>
              Plot
            </button>
            <button type="button" onClick={() => onOpenTab?.("storyCards")}>
              Cards
            </button>
            <button type="button" onClick={() => onOpenTab?.("brains")}>
              Characters
            </button>
            <button type="button" onClick={() => onOpenTab?.("memoryInbox")}>
              Memory
              {pendingMemoryCount > 0 && <span className="nav-badge">{pendingMemoryCount > 99 ? "99+" : pendingMemoryCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                onBuildContext();
                onOpenContext();
              }}
            >
              Context
            </button>
            <button type="button" onClick={() => onOpenTab?.("edit")}>
              Edit All
            </button>
          </div>
        </nav>
        <details className="panel next-turn-note">
          <summary>Next Turn Note {nextTurnNote.content.trim() ? "· active" : "(empty)"}</summary>
          <Field label="Visible next-output steering note">
            <textarea
              rows={2}
              value={nextTurnNote.content}
              onChange={(event) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { content: event.target.value } })}
              placeholder="One-turn instruction for the next AI response. Expires after use."
            />
          </Field>
          <div className="next-turn-note-controls">
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
      </aside>
    </section>
  );
}
