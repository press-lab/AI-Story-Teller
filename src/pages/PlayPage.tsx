import { useEffect, useRef, useState } from "react";
import { getCurrentQuestObjective } from "../quests/questEngine";
import type { InputMode, Message } from "../types/adventure";
import type { PlayRuntimeProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput } from "./shared";

function StoryParagraphs({ content, trailing }: { content: string; trailing?: React.ReactNode }) {
  const paras = content.split(/\n\n+/);
  if (paras.length === 1) return <p>{content}{trailing}</p>;
  return (
    <>
      {paras.map((para, i) => (
        <p key={i}>{para}{i === paras.length - 1 && trailing}</p>
      ))}
    </>
  );
}

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
  onOpenPlayTool,
  playPanelContent,
  playPanelTitle,
  onClosePlayPanel,
  onDismissError,
}: PlayRuntimeProps) {
  const [input, setInput] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("do");
  const [rememberInput, setRememberInput] = useState("");
  const [showRemember, setShowRemember] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | undefined>();
  const [editingOpeningScene, setEditingOpeningScene] = useState(false);
  const [toolkitWidth, setToolkitWidth] = useState(() => {
    try {
      const stored = localStorage.getItem("play-toolkit-width");
      return stored ? parseInt(stored, 10) : 160;
    } catch {
      return 160;
    }
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editingArticleRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAssistant = [...adventure.messages].reverse().find((m) => m.role === "assistant");
  const nextTurnNote = adventure.activeState.nextTurnNote;
  const pendingMemoryCount = adventure.activeState.memoryProposals.filter((p) => p.status === "pending").length;

  const budgetDropped = contextResult?.excludedItems.filter((i) => i.reason === "budget_exceeded") ?? [];
  const droppedMessages = budgetDropped.filter((i) => i.sourceType === "message").length;
  const droppedCards = budgetDropped.filter((i) => i.sourceType === "storyCard" || i.sourceType === "autoCard").length;
  const summaryTruncated = budgetDropped.some((i) => i.sourceType === "summary");
  const totalDropped = budgetDropped.length;
  const trimTooltip = [
    droppedMessages > 0 && `${droppedMessages} story turn${droppedMessages !== 1 ? "s" : ""} dropped`,
    droppedCards > 0 && `${droppedCards} story card${droppedCards !== 1 ? "s" : ""} dropped`,
    summaryTruncated && "summary truncated",
  ].filter(Boolean).join(" · ");

  function startToolkitResize(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = toolkitWidth;
    const el = e.currentTarget;
    el.onpointermove = (ev: PointerEvent) => {
      const next = Math.round(Math.max(120, Math.min(600, startWidth + startX - ev.clientX)));
      setToolkitWidth(next);
      try { localStorage.setItem("play-toolkit-width", String(next)); } catch { /* ignore */ }
    };
    el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; };
  }

  function openTool(tabId: string) {
    if (onOpenPlayTool) {
      onOpenPlayTool(tabId);
    } else {
      onOpenTab?.(tabId);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [adventure.messages.length]);

  useEffect(() => {
    if (composerOpen) textareaRef.current?.focus();
  }, [composerOpen]);

  useEffect(() => {
    if (!editingMessageId) return;
    let startX = 0, startY = 0;
    function handlePointerDown(e: PointerEvent) { startX = e.clientX; startY = e.clientY; }
    function handlePointerUp(e: PointerEvent) {
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) return;
      if (editingArticleRef.current && !editingArticleRef.current.contains(e.target as Node)) {
        setEditingMessageId(undefined);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointerup", handlePointerUp);
    };
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

  const toolButtons = (
    <>
      <button type="button" onClick={() => openTool("components")}>Plot</button>
      <button type="button" onClick={() => openTool("storyCards")}>Cards</button>
      <button type="button" onClick={() => openTool("brains")}>Characters</button>
      <button type="button" onClick={() => openTool("memoryInbox")}>
        Memory
        {pendingMemoryCount > 0 && <span className="nav-badge">{pendingMemoryCount > 99 ? "99+" : pendingMemoryCount}</span>}
      </button>
      <button
        type="button"
        onClick={() => { onBuildContext(); openTool("context"); }}
      >
        Context
      </button>
      <button type="button" onClick={() => onOpenTab?.("edit")}>Edit All</button>
    </>
  );

  return (
    <section className="page play-layout">
      {error && (
        <div className="error-box error-dismissible">
          <span>{error}</span>
          {onDismissError && (
            <button type="button" className="error-dismiss" aria-label="Dismiss error" onClick={onDismissError}>
              ×
            </button>
          )}
        </div>
      )}

      <div className="play-main">
        <div className="transcript" onClick={() => setComposerOpen(false)}>
          {adventure.openingScene && (
            <article className={`message assistant opening-scene-message${editingOpeningScene ? " editing" : ""}`}>
              <div className="message-actions">
                <button type="button" onClick={() => setEditingOpeningScene(!editingOpeningScene)}>
                  {editingOpeningScene ? "Done" : "Edit"}
                </button>
              </div>
              {editingOpeningScene ? (
                <textarea
                  className="message-editor"
                  rows={8}
                  value={adventure.openingScene}
                  onChange={(e) => dispatch({ type: "SET_OPENING_SCENE", content: e.target.value })}
                />
              ) : (
                <StoryParagraphs content={adventure.openingScene} />
              )}
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
                <div onDoubleClick={() => setEditingMessageId(message.id)}>
                  <StoryParagraphs
                    content={message.content}
                    trailing={message.role === "assistant" && message.id === lastAssistant?.id && totalDropped > 0 && (
                      <button
                        type="button"
                        className="context-drop-warning"
                        title={trimTooltip || "Context was trimmed to fit token budget"}
                        onClick={(e) => { e.stopPropagation(); onBuildContext(); onOpenContext(); }}
                      >
                        ⚠️
                      </button>
                    )}
                  />
                  {message.role === "assistant" && message.usage && (
                    <span className="message-usage muted">
                      ↑{message.usage.promptTokens} ↓{message.usage.completionTokens} tokens
                    </span>
                  )}
                </div>
              )}
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Compact tool strip — visible on tablet/mobile, hidden on desktop */}
        <nav className="play-tool-row" aria-label="Adventure tools">
          {toolButtons}
        </nav>

        <div className={`composer panel${composerOpen ? "" : " composer-input-closed"}`}>
          <div className="mode-selector">
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
              <button type="button" disabled={loading || !rememberInput.trim()} onClick={remember}>Save</button>
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
              <button type="button" disabled={loading} onClick={onContinue}>Continue</button>
              <button type="button" disabled={loading || !lastAssistant} onClick={onRegenerate}>Retry</button>
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

      {/* Drag handle between story column and Toolkit */}
      <div
        className="play-toolkit-handle"
        onPointerDown={startToolkitResize}
        title="Drag to resize Toolkit"
        role="separator"
        aria-orientation="vertical"
      />

      {/* Toolkit — compact nav + optional tool panel */}
      <aside
        className={`play-sidebar${playPanelContent ? " has-panel" : ""}`}
        style={{ width: toolkitWidth }}
      >
        <div className="play-status">
          <span className="muted">Turn {adventure.activeState.turn} · {saveStatus}</span>
          <div className="token-strip">
            <span>{contextResult?.totalEstimatedTokens ?? 0} tokens</span>
            {totalDropped > 0 && (
              <span className="trim-warning" title={trimTooltip || "Context trimmed to fit token budget"}>
                ⚠ {totalDropped} dropped
              </span>
            )}
            {getCurrentQuestObjective(adventure.quests) && (
              <span>{getCurrentQuestObjective(adventure.quests)}</span>
            )}
          </div>
        </div>

        <nav className="play-tool-nav" aria-label="Adventure tools">
          {toolButtons}
        </nav>

        {playPanelContent && (
          <div className="play-sidebar-panel">
            <div className="play-sidebar-panel-header">
              <span className="play-sidebar-panel-title">{playPanelTitle ?? "Tool"}</span>
              <button type="button" onClick={onClosePlayPanel} title="Close panel">✕</button>
            </div>
            <div className="play-sidebar-panel-body">
              {playPanelContent}
            </div>
          </div>
        )}

        <details className="next-turn-note panel" style={{ flex: "0 0 auto" }}>
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
            <CheckboxField label="Active" checked={nextTurnNote.active} onChange={(active) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { active } })} />
            <CheckboxField label="Pinned" checked={nextTurnNote.pinned} onChange={(pinned) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { pinned } })} />
            <CheckboxField label="Protected" checked={nextTurnNote.protected} onChange={(protectedValue) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { protected: protectedValue } })} />
            <CheckboxField label="Expires after output" checked={nextTurnNote.expiresAfterUse} onChange={(expiresAfterUse) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { expiresAfterUse } })} />
          </div>
          <div className="toolbar">
            <Field label="Priority">
              <NumberInput value={nextTurnNote.priority} onChange={(priority) => dispatch({ type: "SET_NEXT_TURN_NOTE", note: { priority } })} />
            </Field>
            <button type="button" onClick={() => dispatch({ type: "CLEAR_NEXT_TURN_NOTE" })}>Clear</button>
          </div>
        </details>
      </aside>
    </section>
  );
}
