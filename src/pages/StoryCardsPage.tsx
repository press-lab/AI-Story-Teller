import { useState } from "react";
import type { ContextInclusionPolicy, StoryCard, StoryCardType, TriggerMatchType } from "../types/adventure";
import { makeStoryCard } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput, commaList, fromCommaList } from "./shared";

const storyCardTypes: StoryCardType[] = ["character", "location", "lore", "plot", "custom"];
const matchTypes: TriggerMatchType[] = ["keyword", "phrase", "regex"];
const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

export function StoryCardsPage({ adventure, dispatch }: AdventurePageProps) {
  const [importText, setImportText] = useState("");

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

  return (
    <section className="page">
      <div className="toolbar">
        <button
          type="button"
          onClick={() => dispatch({ type: "UPSERT_STORY_CARD", storyCard: makeStoryCard({ title: "New Story Card", content: "" }) })}
        >
          Create Story Card
        </button>
        <button type="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(adventure.storyCards, null, 2))}>
          Copy Story Cards JSON
        </button>
      </div>

      <details className="panel">
        <summary>Import Story Cards JSON</summary>
        <textarea rows={6} value={importText} onChange={(event) => setImportText(event.target.value)} />
        <button type="button" onClick={importCards}>
          Import Story Cards
        </button>
      </details>

      <div className="list">
        {[...adventure.storyCards].sort((a, b) => b.priority - a.priority).map((card) => (
          <article key={card.id} className="card editor-card">
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
                  {storyCardTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid two">
              <Field label="Triggers / Keys">
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
                  {matchTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Content / Value">
              <textarea
                rows={6}
                value={card.content}
                onChange={(event) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { content: event.target.value } })}
              />
            </Field>
            <div className="grid four">
              <Field label="Priority">
                <NumberInput
                  value={card.priority}
                  onChange={(value) => dispatch({ type: "UPDATE_STORY_CARD", storyCardId: card.id, patch: { priority: value } })}
                />
              </Field>
              <Field label="Token Budget">
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
                label="Pinned"
                checked={card.pinned}
                onChange={(checked) => dispatch({ type: checked ? "PIN_STORY_CARD" : "UNPIN_STORY_CARD", storyCardId: card.id })}
              />
            </div>
            <div className="grid two">
              <CheckboxField
                label="Protected from truncation"
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
            <Field label="State">
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
          </article>
        ))}
      </div>
    </section>
  );
}
