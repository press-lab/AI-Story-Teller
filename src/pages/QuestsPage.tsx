import { createId } from "../utils/id";
import { makeQuest } from "../state/defaults";
import type { QuestStatus, QuestStep, QuestStepStatus } from "../types/adventure";
import type { AdventurePageProps } from "./pageTypes";
import { Field, JsonTextarea, commaList, fromCommaList } from "./shared";

const statuses: QuestStatus[] = ["inactive", "active", "completed", "failed"];

function newStep(): QuestStep {
  return {
    id: createId("step"),
    title: "New Step",
    objective: "",
    status: "pending",
    completionCondition: "",
    triggerConditions: [],
    onStartActions: [],
    onCompleteActions: [],
    contextText: "",
  };
}

export function QuestsPage({ adventure, dispatch }: AdventurePageProps) {
  function updateStep(questId: string, stepId: string, patch: Partial<QuestStep>) {
    const quest = adventure.quests.find((entry) => entry.id === questId);
    if (!quest) return;
    dispatch({
      type: "UPSERT_QUEST",
      quest: {
        ...quest,
        steps: quest.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
      },
    });
  }

  return (
    <section className="page">
      <div className="toolbar">
        <button type="button" onClick={() => dispatch({ type: "UPSERT_QUEST", quest: makeQuest({ title: "New Quest" }) })}>
          Create Quest
        </button>
      </div>

      <div className="list">
        {adventure.quests.map((quest) => (
          <article key={quest.id} className="card editor-card">
            <div className="grid two">
              <Field label="Title">
                <input
                  value={quest.title}
                  onChange={(event) => dispatch({ type: "UPSERT_QUEST", quest: { ...quest, title: event.target.value } })}
                />
              </Field>
              <Field label="Status">
                <select
                  value={quest.status}
                  onChange={(event) =>
                    dispatch({ type: "UPSERT_QUEST", quest: { ...quest, status: event.target.value as QuestStatus } })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={4}
                value={quest.description}
                onChange={(event) => dispatch({ type: "UPSERT_QUEST", quest: { ...quest, description: event.target.value } })}
              />
            </Field>
            <Field label="Current Step">
              <select
                value={quest.currentStepId ?? ""}
                onChange={(event) => dispatch({ type: "UPSERT_QUEST", quest: { ...quest, currentStepId: event.target.value || undefined } })}
              >
                <option value="">None</option>
                {quest.steps.map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Related Story Card IDs">
              <input
                value={commaList(quest.relatedCards)}
                onChange={(event) => dispatch({ type: "UPSERT_QUEST", quest: { ...quest, relatedCards: fromCommaList(event.target.value) } })}
              />
            </Field>
            <div className="row">
              <button type="button" onClick={() => dispatch({ type: "START_QUEST", questId: quest.id })}>
                Start
              </button>
              <button type="button" onClick={() => dispatch({ type: "PROGRESS_QUEST", questId: quest.id })}>
                Progress
              </button>
              <button type="button" onClick={() => dispatch({ type: "COMPLETE_QUEST", questId: quest.id })}>
                Complete
              </button>
              <button type="button" onClick={() => dispatch({ type: "FAIL_QUEST", questId: quest.id })}>
                Fail
              </button>
              <button type="button" onClick={() => dispatch({ type: "UPSERT_QUEST", quest: { ...quest, steps: [...quest.steps, newStep()] } })}>
                Add Step
              </button>
              <button type="button" className="danger" onClick={() => dispatch({ type: "DELETE_QUEST", questId: quest.id })}>
                Delete
              </button>
            </div>
            <div className="list">
              {quest.steps.map((step) => (
                <article key={step.id} className="panel">
                  <h3>{step.title}</h3>
                  <div className="grid two">
                    <Field label="Step Title">
                      <input value={step.title} onChange={(event) => updateStep(quest.id, step.id, { title: event.target.value })} />
                    </Field>
                    <Field label="Status">
                      <select
                        value={step.status}
                        onChange={(event) => updateStep(quest.id, step.id, { status: event.target.value as QuestStepStatus })}
                      >
                        <option value="pending">pending</option>
                        <option value="active">active</option>
                        <option value="completed">completed</option>
                        <option value="failed">failed</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Objective">
                    <textarea rows={2} value={step.objective} onChange={(event) => updateStep(quest.id, step.id, { objective: event.target.value })} />
                  </Field>
                  <Field label="Completion Condition">
                    <textarea
                      rows={3}
                      value={step.completionCondition}
                      onChange={(event) => updateStep(quest.id, step.id, { completionCondition: event.target.value })}
                    />
                  </Field>
                  <Field label="Context Text">
                    <textarea rows={3} value={step.contextText} onChange={(event) => updateStep(quest.id, step.id, { contextText: event.target.value })} />
                  </Field>
                  <Field label="onComplete Actions JSON">
                    <JsonTextarea
                      value={step.onCompleteActions}
                      rows={6}
                      onValidChange={(onCompleteActions) => updateStep(quest.id, step.id, { onCompleteActions })}
                    />
                  </Field>
                </article>
              ))}
            </div>
            <Field label="Steps JSON">
              <JsonTextarea
                value={quest.steps}
                rows={12}
                onValidChange={(steps) =>
                  dispatch({
                    type: "UPSERT_QUEST",
                    quest: {
                      ...quest,
                      steps: steps.map((step) => ({ ...step, status: step.status as QuestStepStatus })),
                    },
                  })
                }
              />
            </Field>
          </article>
        ))}
      </div>
    </section>
  );
}
