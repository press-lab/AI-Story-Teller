import type { ContextInclusionPolicy } from "../types/adventure";
import { makeBrain } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput, commaList, fromCommaList } from "./shared";

const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

interface BrainsPageProps extends AdventurePageProps {
  loading: boolean;
  onUpdateBrainNow: (brainId: string) => Promise<void>;
}

export function BrainsPage({ adventure, dispatch, loading, onUpdateBrainNow }: BrainsPageProps) {
  return (
    <section className="page">
      <div className="toolbar">
        <button type="button" onClick={() => dispatch({ type: "UPSERT_BRAIN", brain: makeBrain({ characterName: "New Character" }) })}>
          Create Brain
        </button>
      </div>

      <div className="list">
        {[...adventure.brains].sort((a, b) => b.priority - a.priority).map((brain) => (
          <article key={brain.id} className="card editor-card">
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
            <Field label="Aliases">
              <input
                value={commaList(brain.aliases)}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { aliases: fromCommaList(event.target.value) } })}
              />
            </Field>
            <Field label="Triggers">
              <input
                value={commaList(brain.triggers)}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { triggers: fromCommaList(event.target.value) } })}
              />
            </Field>
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
            </div>
            <Field label="Token Budget">
              <NumberInput
                value={brain.tokenBudget ?? 0}
                min={0}
                onChange={(value) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { tokenBudget: value || undefined } })}
              />
            </Field>
            <Field label="Current State">
              <textarea
                rows={4}
                value={brain.currentState}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { currentState: event.target.value } })}
              />
            </Field>
            <Field label="Thoughts">
              <textarea
                rows={3}
                value={brain.thoughts}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { thoughts: event.target.value } })}
              />
            </Field>
            <Field label="Relationship Pressure">
              <textarea
                rows={3}
                value={brain.relationshipPressure}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { relationshipPressure: event.target.value } })}
              />
            </Field>
            <Field label="Emotional Interpretation">
              <textarea
                rows={3}
                value={brain.emotionalInterpretation}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { emotionalInterpretation: event.target.value } })}
              />
            </Field>
            <Field label="Recent Developments">
              <textarea
                rows={3}
                value={brain.recentDevelopments}
                onChange={(event) => dispatch({ type: "UPDATE_BRAIN", brainId: brain.id, patch: { recentDevelopments: event.target.value } })}
              />
            </Field>
            <div className="grid two">
              <Field label="Last Updated">
                <input
                  readOnly
                  value={
                    brain.lastUpdatedTurn === undefined
                      ? "Never"
                      : `Turn ${brain.lastUpdatedTurn}${brain.lastUpdatedAt ? ` at ${new Date(brain.lastUpdatedAt).toLocaleString()}` : ""}`
                  }
                />
              </Field>
              <Field label="Last Generated Update Preview">
                <textarea rows={3} readOnly value={brain.lastGeneratedUpdatePreview ?? ""} />
              </Field>
            </div>
            <div className="row">
              <button type="button" disabled={loading} onClick={() => onUpdateBrainNow(brain.id)}>
                Update Now
              </button>
              <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_BRAIN", brainId: brain.id })}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
