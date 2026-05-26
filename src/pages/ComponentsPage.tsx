import type { ComponentType, ContextInclusionPolicy } from "../types/adventure";
import { makeComponent } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput } from "./shared";

const componentTypes: ComponentType[] = ["aiInstructions", "plotEssentials", "authorNote", "memory", "custom"];
const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

export function ComponentsPage({ adventure, dispatch }: AdventurePageProps) {
  return (
    <section className="page">
      <div className="toolbar">
        <button
          type="button"
          onClick={() => dispatch({ type: "UPSERT_COMPONENT", component: makeComponent({ title: "New Component", content: "" }) })}
        >
          Create Component
        </button>
      </div>

      <div className="list">
        {[...adventure.components].sort((a, b) => b.priority - a.priority).map((component) => (
          <article key={component.id} className="card editor-card">
            <div className="grid two">
              <Field label="Title">
                <input
                  value={component.title}
                  onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { title: event.target.value } })}
                />
              </Field>
              <Field label="Type">
                <select
                  value={component.type}
                  onChange={(event) =>
                    dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { type: event.target.value as ComponentType } })
                  }
                >
                  {componentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Content">
              <textarea
                rows={6}
                value={component.content}
                onChange={(event) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { content: event.target.value } })}
              />
            </Field>
            <div className="grid four">
              <Field label="Priority">
                <NumberInput
                  value={component.priority}
                  onChange={(value) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { priority: value } })}
                />
              </Field>
              <Field label="Token Budget">
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
                label="Pinned"
                checked={component.pinned}
                onChange={(checked) => dispatch({ type: checked ? "PIN_COMPONENT" : "UNPIN_COMPONENT", componentId: component.id })}
              />
            </div>
            <CheckboxField
              label="Always on"
              checked={component.alwaysOn}
              onChange={(checked) => dispatch({ type: "UPDATE_COMPONENT", componentId: component.id, patch: { alwaysOn: checked } })}
            />
            <div className="grid two">
              <CheckboxField
                label="Protected from truncation"
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
            <Field label="State">
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
          </article>
        ))}
      </div>
    </section>
  );
}
