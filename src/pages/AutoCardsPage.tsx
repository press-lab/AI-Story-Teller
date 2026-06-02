import type { AutoCardUpdateMode, ContextInclusionPolicy } from "../types/adventure";
import { makeAutoCard } from "../state/defaults";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput, commaList, fromCommaList } from "./shared";

const updateModes: AutoCardUpdateMode[] = ["manual", "append", "replace"];
const inclusionPolicies: ContextInclusionPolicy[] = ["always", "triggered", "manual", "systemSuggested"];

interface AutoCardsPageProps extends AdventurePageProps {
  loading: boolean;
  onGenerateAutoCardNow: () => Promise<void>;
}

export function AutoCardsPage({ adventure, dispatch, loading, onGenerateAutoCardNow }: AutoCardsPageProps) {
  function updateSettings(patch: Partial<typeof adventure.autoCardSettings>) {
    dispatch({ type: "SET_AUTO_CARD_SETTINGS", settings: { ...adventure.autoCardSettings, ...patch } });
  }

  return (
    <section className="page">
      <article className="panel">
        <h3>Auto-Cards</h3>
        <p className="muted">
          Auto-Cards are <strong>AI-generated Story Cards</strong> — the model watches for new entities (characters, places, objects)
          matching your detection condition and proposes a card for each one. Generated cards land in the Review Queue for your approval
          before entering the active card pool.
          <strong> The settings panel</strong> controls when generation triggers and what the AI is told to write.
          Each approved card behaves like a normal Story Card: triggered by keywords, updated on a cooldown, and included in context only when relevant.
        </p>
      </article>

      <div className="toolbar">
        <button type="button" onClick={() => dispatch({ type: "UPSERT_AUTO_CARD", autoCard: makeAutoCard({ title: "New Auto-Card", content: "" }) })}>
          Create Auto-Card
        </button>
        <button type="button" disabled={loading} onClick={onGenerateAutoCardNow}>
          Generate Now
        </button>
      </div>

      <article className="panel">
        <h3>Semantic Auto-Cards</h3>
        <CheckboxField label="Enable Auto-Cards" checked={adventure.autoCardSettings.enabled} onChange={(enabled) => updateSettings({ enabled })} />
        <p className="muted">New named entities are detected automatically from story text — no configuration needed. Use the generation prompt below to control the style of generated cards.</p>
        <Field label="Generation Prompt">
          <textarea
            rows={5}
            value={adventure.autoCardSettings.generationPrompt}
            onChange={(event) => updateSettings({ generationPrompt: event.target.value })}
          />
        </Field>
        <Field label="Cooldown Between Generations">
          <NumberInput min={0} value={adventure.autoCardSettings.cooldownTurns} onChange={(cooldownTurns) => updateSettings({ cooldownTurns })} />
        </Field>
        <p className="muted">Last generated turn: {adventure.autoCardSettings.lastGeneratedTurn ?? "never"}</p>
      </article>

      <article className="panel">
        <h3>Review Queue</h3>
        {adventure.activeState.autoCardReviewQueue.length === 0 && <p className="muted">No generated cards waiting for review.</p>}
        <div className="list">
          {adventure.activeState.autoCardReviewQueue.map((review) => (
            <form
              key={review.id}
              className="card editor-card"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                dispatch({
                  type: "APPROVE_AUTO_CARD",
                  reviewId: review.id,
                  patch: {
                    title: String(data.get("title") ?? review.title),
                    content: String(data.get("content") ?? review.content),
                    keys: fromCommaList(String(data.get("keys") ?? commaList(review.keys))),
                  },
                });
              }}
            >
              <Field label="Title">
                <input name="title" defaultValue={review.title} />
              </Field>
              <Field label="Keys">
                <input name="keys" defaultValue={commaList(review.keys)} />
              </Field>
              <Field label="Content">
                <textarea name="content" rows={5} defaultValue={review.content} />
              </Field>
              <p className="muted">Generated at turn {review.generatedAtTurn}</p>
              <div className="row">
                <button type="submit">Approve</button>
                <button type="button" className="danger" onClick={() => dispatch({ type: "DISCARD_AUTO_CARD", reviewId: review.id })}>
                  Discard
                </button>
              </div>
            </form>
          ))}
        </div>
      </article>

      <div className="list">
        {adventure.autoCards.map((card) => (
          <article key={card.id} className="card editor-card">
            <div className="grid two">
              <Field label="Title">
                <input
                  value={card.title}
                  onChange={(event) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { title: event.target.value } })}
                />
              </Field>
              <Field label="Detected Entity">
                <input
                  value={card.detectedEntity}
                  onChange={(event) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { detectedEntity: event.target.value } })}
                />
              </Field>
            </div>
            <Field label="Triggers">
              <input
                value={commaList(card.triggers)}
                onChange={(event) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { triggers: fromCommaList(event.target.value) } })}
              />
            </Field>
            <Field label="Content">
              <textarea
                rows={6}
                value={card.content}
                onChange={(event) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { content: event.target.value } })}
              />
            </Field>
            <div className="grid four">
              <CheckboxField
                label="Active"
                checked={card.active}
                onChange={(checked) => dispatch({ type: checked ? "ACTIVATE_AUTO_CARD" : "DEACTIVATE_AUTO_CARD", autoCardId: card.id })}
              />
              <Field label="Update Mode">
                <select
                  value={card.updateMode}
                  onChange={(event) =>
                    dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { updateMode: event.target.value as AutoCardUpdateMode } })
                  }
                >
                  {updateModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cooldown Turns">
                <NumberInput
                  min={0}
                  value={card.cooldownTurns}
                  onChange={(value) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { cooldownTurns: value } })}
                />
              </Field>
              <Field label="Source">
                <input value={card.source} readOnly />
              </Field>
            </div>
            <div className="grid four">
              <Field label="Priority">
                <NumberInput value={card.priority} onChange={(value) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { priority: value } })} />
              </Field>
              <CheckboxField
                label="Pinned"
                checked={card.pinned}
                onChange={(checked) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { pinned: checked } })}
              />
              <CheckboxField
                label="Protected"
                checked={card.protected}
                onChange={(checked) => dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { protected: checked } })}
              />
              <Field label="Inclusion Policy">
                <select
                  value={card.inclusionPolicy}
                  onChange={(event) =>
                    dispatch({ type: "UPDATE_AUTO_CARD", autoCardId: card.id, patch: { inclusionPolicy: event.target.value as ContextInclusionPolicy } })
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
            <p className="muted">Last updated turn: {card.lastUpdatedTurn ?? "never"}</p>
            <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_AUTO_CARD", autoCardId: card.id })}>
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
