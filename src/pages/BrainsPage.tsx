import type { ContextInclusionPolicy } from "../types/adventure";
import { makeBrain } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput, commaList, fromCommaList } from "./shared";
import { useState } from "react";

const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

interface BrainsPageProps extends AdventurePageProps {
  loading: boolean;
  onUpdateBrainNow: (brainId: string) => Promise<void>;
}

function ThoughtArchive({ archivedThoughts }: { archivedThoughts: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(archivedThoughts).sort((a, b) => {
    const turnA = parseInt(a[1].match(/^(\d+)/)?.[1] ?? "0", 10);
    const turnB = parseInt(b[1].match(/^(\d+)/)?.[1] ?? "0", 10);
    return turnB - turnA;
  });
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="muted">Thought Archive ({entries.length})</summary>
      {entries.length === 0 ? (
        <p className="muted" style={{ margin: "0.5rem 0" }}>No archived thoughts yet.</p>
      ) : (
        <div style={{ fontSize: "0.85em", color: "var(--color-muted, #888)", marginTop: "0.5rem" }}>
          {entries.map(([key, value]) => (
            <div key={key} style={{ marginBottom: "0.25rem" }}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

export function BrainsPage({ adventure, dispatch, loading, onUpdateBrainNow }: BrainsPageProps) {
  return (
    <section className="page">
      <p className="muted" style={{ margin: 0 }}>
        Character Brains are private internal monologue — thoughts only. The AI records one new thought per update.
        Old thoughts are archived rather than deleted. If a thought reveals a stable character truth, the brain can propose
        an update to a linked story card via the Memory Inbox.
      </p>

      <div className="toolbar">
        <button type="button" onClick={() => dispatch({ type: "UPSERT_BRAIN", brain: makeBrain({ characterName: "New Character" }) })}>
          Create Character Self
        </button>
      </div>

      <div className="list">
        {[...adventure.brains].sort((a, b) => b.priority - a.priority).map((brain) => (
          <article key={brain.id} className="card editor-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{brain.active ? "active" : "inactive"}{brain.pinned ? " · pinned" : ""}</p>
                <strong>{brain.characterName || "Unnamed"}</strong>
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

            <details>
              <summary className="muted">Update Settings &amp; Thoughts</summary>

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
              <Field label="Thoughts (AI-managed — key: turnN → first-person observation, one per line)">
                <textarea
                  rows={4}
                  value={Object.entries(brain.thoughts).map(([k, v]) => `${k}: ${v}`).join("\n")}
                  onChange={(event) => {
                    const record: Record<string, string> = {};
                    for (const line of event.target.value.split("\n")) {
                      const idx = line.indexOf(":");
                      if (idx > 0) {
                        const key = line.slice(0, idx).trim().replace(/\s+/g, "_");
                        const val = line.slice(idx + 1).trim();
                        if (key && val) record[key] = val;
                      }
                    }
                    dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { thoughts: record } });
                  }}
                />
              </Field>
              <div className="grid two">
                <Field label="Last Generated Update Preview">
                  <textarea rows={3} readOnly value={brain.lastGeneratedUpdatePreview ?? ""} />
                </Field>
              </div>
            </details>

            <ThoughtArchive archivedThoughts={brain.archivedThoughts} />
          </article>
        ))}
      </div>
    </section>
  );
}
