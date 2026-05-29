import type { ComponentEntry, ComponentType, ContextInclusionPolicy } from "../types/adventure";
import { makeComponent } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput } from "./shared";

const SINGLETON_TYPES = new Set<ComponentType>(["narrationRules", "aiInstructions", "plotEssentials", "authorNote"]);

const activeComponentTypes: ComponentType[] = ["narrationRules", "aiInstructions", "plotEssentials", "authorNote", "custom"];
const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

const TYPE_LABELS: Record<ComponentType, string> = {
  narrationRules: "Narration Rules",
  aiInstructions: "AI Instructions",
  plotEssentials: "Plot Essentials",
  authorNote: "Author's Note",
  memory: "Lore Block (legacy)",
  custom: "Custom",
};

const TYPE_DESCRIPTIONS: Record<ComponentType, string> = {
  narrationRules: "Global narration style — POV, tone, format, writing rules. Loaded first. One per adventure.",
  aiInstructions: "Direct AI behavior rules that sit separately from narration style — model constraints, persona, safety scope. One per adventure.",
  plotEssentials: "Tiny always-on current-state constraints that change the AI's behavior right now. AI may update with approval. One per adventure.",
  authorNote: "Near-context narrative direction. Inserted close to recent messages for maximum influence on the next response. One per adventure.",
  memory: "Legacy lore block. Move content to a Story Card with type Lore for triggered inclusion.",
  custom: "A general-purpose context block. Configure inclusion policy, priority, and protection manually.",
};

function ComponentSummary({ component }: { component: ComponentEntry }) {
  return (
    <span className="story-card-summary">
      <span className="story-card-title">{TYPE_LABELS[component.type]}</span>
      <span className="story-card-badges">
        {!component.active && <span className="badge badge-inactive">Inactive</span>}
        {component.pinned && <span className="badge badge-pinned">Pinned</span>}
        {component.protected && <span className="badge badge-protected">Protected</span>}
        {component.priority > 0 && <span className="badge badge-priority">p{component.priority}</span>}
      </span>
    </span>
  );
}

interface ComponentsPageProps extends AdventurePageProps {
  loading?: boolean;
  onSuggestPlotUpdates?: () => Promise<void>;
}

export function ComponentsPage({ adventure, dispatch, loading, onSuggestPlotUpdates }: ComponentsPageProps) {
  const existingTypes = new Set(adventure.components.map((c) => c.type));
  const hasActivePlotEssentials = adventure.components.some((c) => c.type === "plotEssentials" && c.active);

  const availableTypes = activeComponentTypes.filter(
    (t) => !SINGLETON_TYPES.has(t) || !existingTypes.has(t),
  );

  return (
    <section className="page">
      <p className="muted" style={{ margin: 0 }}>
        World Blocks are <strong>always-on context</strong> — they load every turn regardless of the story.
        Use them for narration rules, plot state, and author direction.
        For characters, places, and lore that should only load <em>when relevant</em>, use <strong>Story Cards</strong> — they're more token-efficient.
        <strong> Narration Rules, AI Instructions, Plot Essentials,</strong> and <strong>Author's Note</strong> are singletons — one of each per adventure.
      </p>

      <div className="toolbar">
        {availableTypes.filter((t) => SINGLETON_TYPES.has(t)).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => dispatch({ type: "UPSERT_COMPONENT", component: makeComponent({ title: TYPE_LABELS[type], content: "", type }) })}
          >
            Add {TYPE_LABELS[type]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => dispatch({ type: "UPSERT_COMPONENT", component: makeComponent({ title: "New Block", content: "", type: "custom" }) })}
        >
          Add Custom Block
        </button>
        {onSuggestPlotUpdates && (
          <button
            type="button"
            disabled={loading || !hasActivePlotEssentials}
            onClick={onSuggestPlotUpdates}
            title="Ask the AI to review recent story turns and suggest updates to Plot Essentials. Results appear in Memory Suggestions."
          >
            {loading ? "Generating…" : "Suggest Updates"}
          </button>
        )}
      </div>

      <div className="list">
        {[...adventure.components].sort((a, b) => b.priority - a.priority).map((component) => (
          <details key={component.id} className="card story-card-item">
            <summary><ComponentSummary component={component} /></summary>

            <div className="editor-card">
              <div className="grid two">
                <Field label="Type">
                  <select
                    value={component.type}
                    onChange={(event) => {
                      const newType = event.target.value as ComponentType;
                      dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { type: newType, title: TYPE_LABELS[newType] } });
                    }}
                  >
                    {[component.type, ...activeComponentTypes.filter((t) => t !== component.type && (!SINGLETON_TYPES.has(t) || !existingTypes.has(t)))].map((type) => (
                      <option key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <p className="muted component-type-hint">{TYPE_DESCRIPTIONS[component.type]}</p>
              <Field label="Content">
                <textarea
                  rows={6}
                  value={component.content}
                  onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { content: event.target.value } })}
                />
              </Field>
              <div className="grid four">
                <Field label="Priority (higher loads first)">
                  <NumberInput
                    value={component.priority}
                    onChange={(value) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { priority: value } })}
                  />
                </Field>
                <Field label="Token Budget (0 = no limit)">
                  <NumberInput
                    value={component.tokenBudget ?? 0}
                    min={0}
                    onChange={(value) =>
                      dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { tokenBudget: value || undefined } })
                    }
                  />
                </Field>
                <CheckboxField
                  label="Active"
                  checked={component.active}
                  onChange={(checked) =>
                    dispatch({ type: checked ? "ACTIVATE_COMPONENT" : "DEACTIVATE_COMPONENT", componentId: component.id })
                  }
                />
                <CheckboxField
                  label="Pinned (loads before triggered items)"
                  checked={component.pinned}
                  onChange={(checked) => dispatch({ type: checked ? "PIN_COMPONENT" : "UNPIN_COMPONENT", componentId: component.id })}
                />
              </div>
              <CheckboxField
                label="Always on (ignore inclusion policy — load every turn)"
                checked={component.alwaysOn}
                onChange={(checked) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { alwaysOn: checked } })}
              />
              <div className="grid two">
                <CheckboxField
                  label="Protected (cannot be dropped by token truncation)"
                  checked={component.protected}
                  onChange={(checked) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { protected: checked } })}
                />
                <Field label="Inclusion Policy">
                  <select
                    value={component.inclusionPolicy}
                    onChange={(event) =>
                      dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { inclusionPolicy: event.target.value as ContextInclusionPolicy } })
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
              <Field label="State (runtime note visible to automation conditions)">
                <input
                  value={component.state}
                  onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { state: event.target.value } })}
                />
              </Field>
              <div className="row">
                <button type="button" onClick={() => dispatch({ type: "REORDER_COMPONENT", componentId: component.id, direction: "up" })}>
                  Move Up
                </button>
                <button type="button" onClick={() => dispatch({ type: "REORDER_COMPONENT", componentId: component.id, direction: "down" })}>
                  Move Down
                </button>
                <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_COMPONENT", componentId: component.id })}>
                  Delete
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
