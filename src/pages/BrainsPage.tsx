import type { BrainEntry, ContextInclusionPolicy } from "../types/adventure";
import { makeBrain } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, Highlight, NumberInput, commaList, fromCommaList } from "./shared";
import { useEffect, useState } from "react";

const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

interface BrainsPageProps extends AdventurePageProps {
  loading: boolean;
  onUpdateBrainNow: (brainId: string) => Promise<void>;
  /** Generate a character Brain from just a name, with a behavioral voice contract. */
  onGenerateBrain?: (name: string) => Promise<void>;
}

function BrainTriggerInput({
  triggers,
  onChange,
}: {
  triggers: string[];
  onChange: (triggers: string[]) => void;
}) {
  const [draft, setDraft] = useState(commaList(triggers));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(commaList(triggers));
  }, [focused, triggers]);

  return (
    <input
      value={draft}
      placeholder="Blazer, Blonde Blazer, Mandy"
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onChange(fromCommaList(next));
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setDraft(commaList(fromCommaList(draft)));
      }}
    />
  );
}

function thoughtSortValue(key: string): number {
  return Number(key.match(/\d+/)?.[0] ?? 0);
}

function thoughtTurnValue(key: string, value: string): number {
  return Number(value.match(/^(\d+)/)?.[1] ?? key.match(/\d+/)?.[0] ?? 0);
}

function brainThoughtEntries(thoughts: Record<string, string>): Array<[string, string]> {
  return Object.entries(thoughts)
    .filter(([, value]) => value.trim())
    .sort((a, b) => thoughtSortValue(b[0]) - thoughtSortValue(a[0]) || b[0].localeCompare(a[0]));
}

function formatThoughts(thoughts: Record<string, string>): string {
  return brainThoughtEntries(thoughts).map(([key, value]) => `${key}: ${value}`).join("\n");
}

function parseThoughts(text: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim().replace(/\s+/g, "_");
      const val = line.slice(idx + 1).trim();
      if (key && val) record[key] = val;
    }
  }
  return record;
}

function BrainThoughtList({ thoughts }: { thoughts: Record<string, string> }) {
  const entries = brainThoughtEntries(thoughts);
  if (entries.length === 0) {
    return <p className="muted brain-empty-state">No current thoughts yet.</p>;
  }
  return (
    <div className="brain-thought-list">
      {entries.map(([key, value]) => (
        <article key={key} className="brain-thought">
          <span className="brain-thought-key">{key}</span>
          <p>{value}</p>
        </article>
      ))}
    </div>
  );
}

function BrainThoughtHistory({ brain }: { brain: BrainEntry }) {
  const entries = [
    ...Object.entries(brain.thoughts).map(([key, value]) => ({ key, value, state: "current" as const })),
    ...Object.entries(brain.archivedThoughts).map(([key, value]) => ({ key, value, state: "archived" as const })),
  ]
    .filter((entry) => entry.value.trim())
    .sort((a, b) => thoughtTurnValue(b.key, b.value) - thoughtTurnValue(a.key, a.value) || b.key.localeCompare(a.key));

  if (entries.length === 0) {
    return <p className="muted brain-empty-state">No thought history yet.</p>;
  }

  return (
    <div className="brain-history-list">
      {entries.map((entry) => (
        <article key={`${entry.state}-${entry.key}`} className="brain-history-entry">
          <div className="brain-history-meta">
            <span>{entry.key}</span>
            <span className={`badge ${entry.state === "current" ? "badge-priority" : "badge-inactive"}`}>
              {entry.state}
            </span>
          </div>
          <p>{entry.value}</p>
        </article>
      ))}
    </div>
  );
}

function BrainSummary({ brain, query }: { brain: BrainEntry; query: string }) {
  const thoughtCount = Object.keys(brain.thoughts).length;
  const archivedCount = Object.keys(brain.archivedThoughts).length;
  return (
    <span className="story-card-summary">
      <span className="story-card-title">
        <Highlight text={brain.characterName || "Unnamed"} query={query} />
      </span>
      <span className="story-card-badges">
        <span className="badge badge-type">Character</span>
        {!brain.active && <span className="badge badge-inactive">Inactive</span>}
        {brain.pinned && <span className="badge badge-pinned">Pinned</span>}
        {brain.protected && <span className="badge badge-protected">Protected</span>}
        {brain.priority > 0 && <span className="badge badge-priority">p{brain.priority}</span>}
        {thoughtCount > 0 && <span className="badge badge-priority">{thoughtCount} thoughts</span>}
        {archivedCount > 0 && <span className="badge badge-priority">{archivedCount} archived</span>}
      </span>
      {brain.triggers.length > 0 && (
        <span className="search-snippet">
          <Highlight text={brain.triggers.join(", ")} query={query} />
        </span>
      )}
    </span>
  );
}

export function BrainsPage({ adventure, dispatch, loading, onUpdateBrainNow, onGenerateBrain }: BrainsPageProps) {
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [openBrainId, setOpenBrainId] = useState<string | null>(null);
  const searchLower = search.toLowerCase().trim();
  const visibleBrains = [...adventure.brains]
    .sort((a, b) => b.priority - a.priority)
    .filter((brain) => !searchLower
      || brain.characterName.toLowerCase().includes(searchLower)
      || brain.triggers.some((trigger) => trigger.toLowerCase().includes(searchLower))
      || brain.notes.toLowerCase().includes(searchLower)
      || Object.values(brain.thoughts).some((thought) => thought.toLowerCase().includes(searchLower))
      || Object.values(brain.archivedThoughts).some((thought) => thought.toLowerCase().includes(searchLower)));
  const activeCount = adventure.brains.filter((brain) => brain.active).length;

  return (
    <section className="page editor-surface brains-page">
      <div className="editor-page-summary">
        <p className="muted">
          Character-internal state for major recurring characters. Keep durable public facts in Cards.
        </p>
        <div className="editor-stat-row" aria-label="Character counts">
          <span>{adventure.brains.length} total</span>
          <span>{activeCount} active</span>
          {searchLower && <span>{visibleBrains.length} shown</span>}
        </div>
      </div>
      <p className="muted editor-legacy-help" style={{ margin: 0 }}>
        Character Brains are private internal monologue — thoughts only. The AI records one new thought per update.
        Old thoughts are archived rather than deleted. If a thought reveals a stable character truth, the brain can propose
        an update to a linked story card via the Memory Inbox.
      </p>

      <div className="editor-command-bar">
        <input
          type="search"
          placeholder="Search characters..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="button" onClick={() => dispatch({ type: "UPSERT_BRAIN", brain: makeBrain({ characterName: "New Character" }) })}>
          Create Character Self
        </button>
      </div>

      {onGenerateBrain && (
        <details className="panel editor-tools-panel">
          <summary>AI character tools</summary>
          <div className="toolbar">
            <input
              placeholder="Character name..."
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              style={{ minWidth: "12rem" }}
            />
            <button
              type="button"
              disabled={loading || !newName.trim()}
              onClick={() => void onGenerateBrain(newName.trim()).then(() => setNewName(""))}
              title="Enter a name and let the AI build a behavioral voice contract for this character."
            >
              {loading ? "Generating..." : "✨ Generate from name"}
            </button>
          </div>
        </details>
      )}

      <div className="list split-editor-list">
        {visibleBrains.map((brain) => (
          <details
            key={brain.id}
            className="card story-card-item split-editor-item brain-item"
            open={openBrainId === brain.id}
          >
            <summary
              onClick={(event) => {
                event.preventDefault();
                setOpenBrainId((current) => current === brain.id ? null : brain.id);
              }}
            >
              <BrainSummary brain={brain} query={searchLower} />
            </summary>
            <div className="editor-card brain-inspector">
            <div className="panel-heading brain-inspector-heading">
              <div>
                <p className="eyebrow">{brain.active ? "active" : "inactive"}{brain.pinned ? " · pinned" : ""}</p>
                <h3>{brain.characterName || "Unnamed"}</h3>
                <div className="brain-tag-row" aria-label="Character aliases">
                  {brain.triggers.length === 0 && <span className="brain-tag muted">No aliases</span>}
                  {brain.triggers.map((trigger) => (
                    <span key={trigger} className="brain-tag">{trigger}</span>
                  ))}
                </div>
              </div>
              <div className="row">
                <button type="button" disabled={loading} onClick={() => onUpdateBrainNow(brain.id)}>
                  Update Now
                </button>
                <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_BRAIN", brainId: brain.id })}>
                  Delete
                </button>
              </div>
            </div>

            <div className="grid two">
              <Field label="Character Name">
                <input
                  value={brain.characterName}
                  onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { characterName: event.target.value } })}
                />
              </Field>
              <Field label="Additional Triggers / Aliases">
                <BrainTriggerInput
                  triggers={brain.triggers}
                  onChange={(triggers) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { triggers } })}
                />
              </Field>
            </div>

            <section className="brain-focus-section">
              <div className="brain-section-heading">
                <div>
                  <p className="eyebrow">thought timeline</p>
                  <h4>Current and archived thoughts</h4>
                </div>
                <span className="muted">
                  {Object.keys(brain.thoughts).length} current · {Object.keys(brain.archivedThoughts).length} archived
                </span>
              </div>
              <BrainThoughtHistory brain={brain} />
              <details className="brain-inline-details">
                <summary>Edit current thoughts</summary>
                <Field label="Thoughts (key: turnN -> first-person observation, one per line)">
                  <textarea
                    rows={4}
                    value={formatThoughts(brain.thoughts)}
                    onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { thoughts: parseThoughts(event.target.value) } })}
                  />
                </Field>
              </details>
            </section>

            <details className="brain-secondary-details">
              <summary>Update cadence and priority</summary>
            <div className="grid two">
              <Field label="Priority">
                <NumberInput
                  value={brain.priority}
                  onChange={(value) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { priority: value } })}
                />
              </Field>
            </div>
            <div className="grid two">
              <Field label="Capture thought every N turns (0 = every turn character appears)">
                <NumberInput
                  value={brain.autoUpdateCooldownTurns ?? 0}
                  min={0}
                  onChange={(value) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { autoUpdateCooldownTurns: value || undefined } })}
                />
              </Field>
              <Field label="Last updated (turn)">
                <input readOnly value={brain.lastUpdatedTurn ?? "Never"} />
              </Field>
            </div>
            </details>
            <Field label="Notes (manual freetext — not injected into context)">
              <textarea
                rows={3}
                value={brain.notes}
                placeholder="Personal notes about this character — for your reference only."
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { notes: event.target.value } })}
              />
            </Field>
            <Field label="Linked Story Card (for trait proposals)">
              <select
                value={brain.linkedStoryCardId ?? ""}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { linkedStoryCardId: event.target.value || undefined } })}
              >
                <option value="">None</option>
                {adventure.storyCards.map((card) => (
                  <option key={card.id} value={card.id}>{card.title}</option>
                ))}
              </select>
            </Field>

            <details className="brain-secondary-details">
              <summary>Automation &amp; context settings</summary>

              <Field label="Update Condition">
                <textarea
                  rows={3}
                  value={brain.updateCondition}
                  onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { updateCondition: event.target.value } })}
                />
              </Field>
              <Field label="Update Prompt Override">
                <textarea
                  rows={4}
                  value={brain.updatePrompt}
                  placeholder="Optional. Empty uses the default brain update prompt."
                  onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { updatePrompt: event.target.value } })}
                />
              </Field>
              <div className="grid two">
                <CheckboxField
                  label="Active"
                  checked={brain.active}
                  onChange={(checked) => dispatch({ type: checked ? "ACTIVATE_BRAIN" : "DEACTIVATE_BRAIN", brainId: brain.id })}
                />
                <CheckboxField
                  label="Pinned"
                  checked={brain.pinned}
                  onChange={(checked) => dispatch({ type: checked ? "PIN_BRAIN" : "UNPIN_BRAIN", brainId: brain.id })}
                />
                <CheckboxField
                  label="Protected from truncation"
                  checked={brain.protected}
                  onChange={(checked) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { protected: checked } })}
                />
                <CheckboxField
                  label="Print thoughts in story"
                  checked={!!brain.printThoughts}
                  onChange={(checked) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { printThoughts: checked } })}
                />
                <Field label="Update Mode">
                  <select
                    value={brain.updateMode}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { updateMode: event.target.value as "replace" | "append" } })
                    }
                  >
                    <option value="replace">replace</option>
                    <option value="append">append</option>
                  </select>
                </Field>
                <Field label="Inclusion Policy">
                  <select
                    value={brain.inclusionPolicy}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { inclusionPolicy: event.target.value as ContextInclusionPolicy } })
                    }
                  >
                    {inclusionPolicies.map((policy) => (
                      <option key={policy} value={policy}>
                        {policy}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Token Budget (0 = no limit)">
                  <NumberInput
                    value={brain.tokenBudget ?? 0}
                    min={0}
                    onChange={(value) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { tokenBudget: value || undefined } })}
                  />
                </Field>
              </div>
              <div className="grid two">
                <Field label="Last Generated Update Preview">
                  <textarea rows={3} readOnly value={brain.lastGeneratedUpdatePreview ?? ""} />
                </Field>
              </div>
            </details>

            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
