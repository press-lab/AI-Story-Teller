import { useEffect, useRef, useState } from "react";
import type { ContextInclusionPolicy, StoryCard, StoryCardType, TriggerMatchType } from "../types/adventure";
import type { AuditRecommendation } from "../memory/storyCardAudit";
import { makeStoryCard } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, Highlight, NumberInput, commaList, contentSnippet, fromCommaList } from "./shared";

const TYPE_ORDER: StoryCardType[] = ["character", "location", "lore", "plot", "custom"];
const matchTypes: TriggerMatchType[] = ["keyword", "phrase", "regex"];
const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

const TYPE_LABELS: Record<StoryCardType, string> = {
  character: "Character",
  location: "Location",
  lore: "Lore",
  plot: "Plot",
  custom: "Custom",
};

type SortMode = "alpha" | "recent";

function CardSummary({ card, query }: { card: StoryCard; query: string }) {
  const keyPreview = card.keys.slice(0, 4);
  const snippet = contentSnippet(card.content, query);
  return (
    <span className="story-card-summary">
      <span className="story-card-title"><Highlight text={card.title} query={query} /></span>
      <span className="story-card-badges">
        <span className="badge badge-type">{TYPE_LABELS[card.type]}</span>
        {!card.active && <span className="badge badge-inactive">Inactive</span>}
        {card.pinned && <span className="badge badge-pinned">Pinned</span>}
        {card.protected && <span className="badge badge-protected">Protected</span>}
        {card.priority > 0 && <span className="badge badge-priority">p{card.priority}</span>}
      </span>
      {keyPreview.length > 0 && (
        <span className="story-card-keys muted">
          {keyPreview.map((k, i) => <span key={k}>{i > 0 && ", "}<Highlight text={k} query={query} /></span>)}
          {card.keys.length > 4 ? "…" : ""}
        </span>
      )}
      {snippet && <span className="search-snippet"><Highlight text={snippet} query={query} /></span>}
    </span>
  );
}

function sortCards(cards: StoryCard[], mode: SortMode): StoryCard[] {
  if (mode === "alpha") {
    return [...cards].sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...cards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

interface StoryCardsPageProps extends AdventurePageProps {
  loading?: boolean;
  onSuggestCardUpdates?: () => Promise<void>;
  onAuditStoryCards?: (nTurns: number) => Promise<AuditRecommendation[]>;
}

type AuditState = {
  status: "running" | "done" | "error";
  recommendations: AuditRecommendation[];
  errorMessage?: string;
};

export function StoryCardsPage({ adventure, dispatch, loading, onSuggestCardUpdates, onAuditStoryCards }: StoryCardsPageProps) {
  const [importText, setImportText] = useState("");
  const [newCardId, setNewCardId] = useState<string | undefined>();
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [search, setSearch] = useState("");
  const [auditTurns, setAuditTurns] = useState(20);
  const [audit, setAudit] = useState<AuditState | null>(null);
  const newCardRef = useRef<HTMLDetailsElement | null>(null);

  function updateRec(id: string, patch: Partial<AuditRecommendation>) {
    setAudit((prev) => prev && {
      ...prev,
      recommendations: prev.recommendations.map((r) => r.id === id ? { ...r, ...patch } : r),
    });
  }

  function approveRec(rec: AuditRecommendation) {
    if (rec.action === "delete" && rec.cardId) {
      dispatch({ type: "DELETE_STORY_CARD", storyCardId: rec.cardId });
    } else if (rec.action === "edit" && rec.cardId) {
      dispatch({
        type: "UPDATE_STORY_CARD",
        storyCardId: rec.cardId,
        patch: {
          content: rec.editedContent,
          keys: rec.editedKeys.split(",").map((k) => k.trim()).filter(Boolean),
        },
      });
    } else if (rec.action === "create") {
      const validTypes = new Set<StoryCardType>(["character", "location", "lore", "plot", "custom"]);
      const type: StoryCardType = validTypes.has(rec.suggestedType as StoryCardType)
        ? (rec.suggestedType as StoryCardType)
        : "custom";
      dispatch({
        type: "UPSERT_STORY_CARD",
        storyCard: makeStoryCard({
          title: rec.title,
          content: rec.editedContent,
          keys: rec.editedKeys.split(",").map((k) => k.trim()).filter(Boolean),
          type,
        }),
      });
    }
    updateRec(rec.id, { decision: "approved" });
  }

  async function runAudit() {
    if (!onAuditStoryCards) return;
    setAudit({ status: "running", recommendations: [] });
    try {
      const recs = await onAuditStoryCards(auditTurns);
      setAudit({ status: "done", recommendations: recs });
    } catch (err) {
      setAudit({ status: "error", recommendations: [], errorMessage: err instanceof Error ? err.message : "Audit failed." });
    }
  }

  useEffect(() => {
    if (!newCardId || !newCardRef.current) return;
    newCardRef.current.open = true;
    newCardRef.current.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    setNewCardId(undefined);
  }, [newCardId, adventure.storyCards.length]);

  function importCards() {
    try {
      const parsed = JSON.parse(importText) as StoryCard[];
      if (!Array.isArray(parsed)) throw new Error("Expected an array of story cards.");
      parsed.forEach((card) => dispatch({ type: "UPSERT_STORY_CARD", storyCard: card }));
      setImportText("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not import story cards.");
    }
  }

  const searchLower = search.toLowerCase().trim();
  function cardMatchesSearch(card: StoryCard): boolean {
    if (!searchLower) return true;
    return card.title.toLowerCase().includes(searchLower) || card.keys.some((k) => k.toLowerCase().includes(searchLower)) || card.content.toLowerCase().includes(searchLower);
  }

  // Group cards by type, only include types that have at least one card
  const groups: Array<{ type: StoryCardType; cards: StoryCard[] }> = TYPE_ORDER
    .map((type) => ({ type, cards: sortCards(adventure.storyCards.filter((c) => c.type === type && cardMatchesSearch(c)), sortMode) }))
    .filter((g) => g.cards.length > 0);

  return (
    <section className="page">
      <p className="muted" style={{ margin: 0 }}>
        Story Cards are <strong>triggered memory</strong> — they only enter the model context when their trigger keys match
        the current input or recent story. Use them for characters, places, relationships, secrets, rules, and recurring facts
        that are only relevant some of the time.
        For always-on world lore that should load every turn regardless, use a <strong>World Block</strong>.
      </p>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search cards…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1, minWidth: "8rem", maxWidth: "20rem" }}
        />
        <button
          type="button"
          onClick={() => {
            const card = makeStoryCard({ title: "New Story Card", content: "" });
            dispatch({ type: "UPSERT_STORY_CARD", storyCard: card });
            setNewCardId(card.id);
          }}
        >
          Create Story Card
        </button>
        <span className="audit-trigger">
          <span className="audit-turns-wrap">
            Update cards every
            <input
              type="number"
              min={0}
              value={adventure.semanticEvaluationSettings.storyCardCooldownTurns ?? 0}
              onChange={(e) => {
                const v = Math.max(0, Number(e.target.value));
                dispatch({ type: "SET_SEMANTIC_EVALUATION_SETTINGS", settings: { ...adventure.semanticEvaluationSettings, storyCardCooldownTurns: v || undefined } });
              }}
              className="audit-turns-input"
            />
            turns (0 = per-card)
          </span>
        </span>
        {onSuggestCardUpdates && (
          <button
            type="button"
            disabled={loading || adventure.storyCards.filter((c) => c.active).length === 0}
            onClick={onSuggestCardUpdates}
            title="Ask the AI to review recent story turns and suggest updates to all active Story Cards. Results appear in Memory Suggestions."
          >
            {loading ? "Generating…" : "Suggest Updates"}
          </button>
        )}
        {onAuditStoryCards && (
          <span className="audit-trigger">
            <button
              type="button"
              disabled={loading || audit?.status === "running"}
              onClick={runAudit}
              title="Review all story cards and get AI recommendations to edit, delete, or create cards."
            >
              {audit?.status === "running" ? "Auditing…" : "Audit Cards"}
            </button>
            <span className="audit-turns-wrap">
              last
              <input
                type="number"
                min={1}
                max={500}
                value={auditTurns}
                onChange={(e) => setAuditTurns(Math.max(1, Number(e.target.value)))}
                className="audit-turns-input"
              />
              turns
            </span>
          </span>
        )}
        <button type="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(adventure.storyCards, null, 2))}>
          Copy Story Cards JSON
        </button>
        <div className="sort-toggle">
          <button
            type="button"
            className={sortMode === "alpha" ? "active" : ""}
            onClick={() => setSortMode("alpha")}
          >
            A–Z
          </button>
          <button
            type="button"
            className={sortMode === "recent" ? "active" : ""}
            onClick={() => setSortMode("recent")}
          >
            Recent
          </button>
        </div>
      </div>

      <details className="panel">
        <summary>Import Story Cards JSON</summary>
        <textarea rows={6} value={importText} onChange={(event) => setImportText(event.target.value)} />
        <button type="button" onClick={importCards}>
          Import Story Cards
        </button>
      </details>

      {groups.length === 0 && <p className="muted">No story cards yet.</p>}

      {audit && audit.status !== "running" && (
        <div className="audit-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAudit(null); }}>
          <div className="audit-modal">
            <div className="audit-modal-header">
              <h3>Story Card Audit</h3>
              <button type="button" className="audit-modal-close" onClick={() => setAudit(null)}>✕</button>
            </div>

            {audit.status === "error" && (
              <p className="audit-error">{audit.errorMessage}</p>
            )}

            {audit.status === "done" && audit.recommendations.length === 0 && (
              <p className="muted">No changes recommended — your story cards look good.</p>
            )}

            {audit.recommendations.map((rec) => (
              <div key={rec.id} className={`audit-rec ${rec.decision !== "pending" ? `audit-rec-${rec.decision}` : ""}`}>
                <div className="audit-rec-header">
                  <span className={`audit-badge audit-badge-${rec.action}`}>{rec.action.toUpperCase()}</span>
                  {rec.source === "deterministic" && <span className="audit-badge audit-badge-det">DETECTED</span>}
                  <span className="audit-rec-title">{rec.title}</span>
                  {rec.decision !== "pending" && (
                    <span className={`audit-badge audit-badge-decision-${rec.decision}`}>{rec.decision}</span>
                  )}
                </div>
                <p className="audit-rec-rationale">{rec.rationale}</p>

                {rec.action !== "delete" && rec.decision === "pending" && (
                  <div className="audit-rec-fields">
                    <label className="field">
                      <span>Content</span>
                      <textarea
                        rows={5}
                        value={rec.editedContent}
                        onChange={(e) => updateRec(rec.id, { editedContent: e.target.value })}
                        spellCheck={false}
                      />
                    </label>
                    <label className="field">
                      <span>Keys (comma-separated)</span>
                      <input
                        value={rec.editedKeys}
                        onChange={(e) => updateRec(rec.id, { editedKeys: e.target.value })}
                      />
                    </label>
                  </div>
                )}

                {rec.decision === "pending" && (
                  <div className="audit-rec-actions">
                    <button type="button" onClick={() => approveRec(rec)}>Approve</button>
                    <button type="button" className="danger" onClick={() => updateRec(rec.id, { decision: "rejected" })}>Reject</button>
                  </div>
                )}
              </div>
            ))}

            <div className="audit-modal-footer">
              <button type="button" onClick={() => setAudit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {groups.map(({ type, cards }) => (
        <div key={type} className="card-group">
          <h4 className="card-group-label">{TYPE_LABELS[type]} <span className="muted">({cards.length})</span></h4>
          <div className="list">
            {cards.map((card) => (
              <details key={card.id} ref={card.id === newCardId ? newCardRef : null} className="card story-card-item">
                <summary><CardSummary card={card} query={searchLower} /></summary>

                <div className="editor-card">
                  <div className="grid two">
                    <Field label="Title">
                      <input
                        value={card.title}
                        onChange={(event) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { title: event.target.value } })}
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        value={card.type}
                        onChange={(event) =>
                          dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { type: event.target.value as StoryCardType } })
                        }
                      >
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid two">
                    <Field label="Trigger Keys (comma-separated words or phrases that activate this card)">
                      <input
                        value={commaList(card.keys)}
                        onChange={(event) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { keys: fromCommaList(event.target.value) } })}
                      />
                    </Field>
                    <Field label="Trigger Match Type">
                      <select
                        value={card.matchType ?? "phrase"}
                        onChange={(event) =>
                          dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { matchType: event.target.value as TriggerMatchType } })
                        }
                      >
                        <option value="keyword">keyword — matches anywhere the word appears, even inside longer words</option>
                        <option value="phrase">phrase — whole-word match, won't fire inside another word (default)</option>
                        <option value="regex">regex — full regular expression for complex patterns</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Content">
                    <textarea
                      rows={6}
                      value={card.content}
                      onChange={(event) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { content: event.target.value } })}
                    />
                  </Field>
                  <div className="grid four">
                    <Field label="Priority (higher = loaded first)">
                      <NumberInput
                        value={card.priority}
                        onChange={(value) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { priority: value } })}
                      />
                    </Field>
                    <Field label="Token Budget (0 = no limit)">
                      <NumberInput
                        value={card.tokenBudget ?? 0}
                        min={0}
                        onChange={(value) =>
                          dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { tokenBudget: value || undefined } })
                        }
                      />
                    </Field>
                    <CheckboxField
                      label="Active"
                      checked={card.active}
                      onChange={(checked) => dispatch({ type: checked ? "ACTIVATE_STORY_CARD" : "DEACTIVATE_STORY_CARD", storyCardId: card.id })}
                    />
                    <CheckboxField
                      label="Pinned (loads before other triggered cards)"
                      checked={card.pinned}
                      onChange={(checked) => dispatch({ type: checked ? "PIN_STORY_CARD" : "UNPIN_STORY_CARD", storyCardId: card.id })}
                    />
                  </div>
                  <div className="grid two">
                    <CheckboxField
                      label="Protected (cannot be dropped by token truncation)"
                      checked={card.protected}
                      onChange={(checked) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { protected: checked } })}
                    />
                    <Field label="Inclusion Policy">
                      <select
                        value={card.inclusionPolicy}
                        onChange={(event) =>
                          dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { inclusionPolicy: event.target.value as ContextInclusionPolicy } })
                        }
                      >
                        {inclusionPolicies.map((policy) => (
                          <option key={policy} value={policy}>
                            {policy}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <CheckboxField
                    label="Auto-update via AI after relevant scenes"
                    checked={card.autoUpdate ?? false}
                    onChange={(autoUpdate) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { autoUpdate } })}
                  />
                  <div className="grid two">
                    <Field label="Auto-update cooldown (turns)">
                      <NumberInput
                        value={card.autoUpdateCooldownTurns ?? 3}
                        min={0}
                        onChange={(autoUpdateCooldownTurns) =>
                          dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { autoUpdateCooldownTurns } })
                        }
                      />
                    </Field>
                    <Field label="Last auto-update turn">
                      <input value={card.lastAutoUpdateTurn ?? "Never"} readOnly />
                    </Field>
                  </div>
                  <Field label="State (runtime note visible to automation conditions)">
                    <input
                      value={card.state}
                      onChange={(event) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { state: event.target.value } })}
                    />
                  </Field>
                  <div className="row">
                    <button type="button" onClick={() => dispatch({ type: "REORDER_STORY_CARD", storyCardId: card.id, direction: "up" })}>
                      Move Up
                    </button>
                    <button type="button" onClick={() => dispatch({ type: "REORDER_STORY_CARD", storyCardId: card.id, direction: "down" })}>
                      Move Down
                    </button>
                    <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_STORY_CARD", storyCardId: card.id })}>
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
