import { useState } from "react";
import { classifyMemory } from "../memory/classificationPolicy";
import type { MemoryProposal, MemoryProposalType } from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import type { AdventurePageProps } from "./pageTypes";
import { Field, NumberInput, commaList, fromCommaList } from "./shared";

const proposalTypes: MemoryProposalType[] = ["storyCard", "brainUpdate", "plotEssentialsUpdate", "summaryUpdate", "ignore"];

export function MemoryInboxPage({ adventure, dispatch }: AdventurePageProps) {
  const proposals = [...adventure.activeState.memoryProposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [sourceText, setSourceText] = useState("");

  function updateProposal(proposal: MemoryProposal, patch: Partial<MemoryProposal>) {
    dispatch({ type: "UPDATE_MEMORY_PROPOSAL", proposalId: proposal.id, patch });
  }

  return (
    <section className="page">
      <article className="panel">
        <h3>Memory Inbox</h3>
        <p className="muted">
          AI-suggested durable memories stay here until approved. Rejected and ignored proposals never become active context.
        </p>
        <Field label="Classify Source Text">
          <textarea
            rows={4}
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste a detail from the Chronicle to create an inspectable memory proposal."
          />
        </Field>
        <button
          type="button"
          disabled={!sourceText.trim()}
          onClick={() => {
            const classified = classifyMemory(sourceText, {
              existingBrainNames: adventure.brains.map((brain) => brain.characterName),
              existingStoryCards: adventure.storyCards.map((card) => ({ id: card.id, title: card.title, keys: card.keys })),
            });
            const timestamp = nowIso();
            dispatch({
              type: "ADD_MEMORY_PROPOSAL",
              proposal: {
                id: createId("proposal"),
                sourceTurnId: adventure.messages.at(-1)?.id ?? "manual",
                sourceText,
                proposedType: classified.proposedType,
                title: classified.title,
                content: classified.content,
                suggestedTriggers: classified.suggestedTriggers,
                confidence: classified.confidence,
                rationale: classified.rationale,
                status: "pending",
                targetId: classified.targetId,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            });
            setSourceText("");
          }}
        >
          Create Proposal
        </button>
      </article>

      <div className="list">
        {proposals.length === 0 && <p className="muted">No memory proposals yet.</p>}
        {proposals.map((proposal) => (
          <article key={proposal.id} className="card editor-card">
            <div className="grid four">
              <Field label="Status">
                <input readOnly value={proposal.status} />
              </Field>
              <Field label="Proposed Type">
                <select
                  value={proposal.proposedType}
                  onChange={(event) => updateProposal(proposal, { proposedType: event.target.value as MemoryProposalType })}
                  disabled={proposal.status !== "pending"}
                >
                  {proposalTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Confidence">
                <NumberInput
                  value={proposal.confidence}
                  min={0}
                  onChange={(value) => updateProposal(proposal, { confidence: Math.max(0, Math.min(1, value)) })}
                />
              </Field>
              <Field label="Source Turn">
                <input readOnly value={proposal.sourceTurnId} />
              </Field>
            </div>

            <Field label="Title">
              <input value={proposal.title} onChange={(event) => updateProposal(proposal, { title: event.target.value })} />
            </Field>
            <Field label="Source Text">
              <textarea rows={3} value={proposal.sourceText} onChange={(event) => updateProposal(proposal, { sourceText: event.target.value })} />
            </Field>
            <Field label="Proposed Content">
              <textarea rows={5} value={proposal.content} onChange={(event) => updateProposal(proposal, { content: event.target.value })} />
            </Field>
            <Field label="Suggested Triggers">
              <input
                value={commaList(proposal.suggestedTriggers)}
                onChange={(event) => updateProposal(proposal, { suggestedTriggers: fromCommaList(event.target.value) })}
              />
            </Field>
            <Field label="Rationale">
              <textarea rows={3} value={proposal.rationale} onChange={(event) => updateProposal(proposal, { rationale: event.target.value })} />
            </Field>

            <div className="toolbar">
              <button
                type="button"
                disabled={proposal.status !== "pending"}
                onClick={() => dispatch({ type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposal.id })}
              >
                Approve
              </button>
              <button
                type="button"
                disabled={proposal.status !== "pending"}
                onClick={() => dispatch({ type: "REJECT_MEMORY_PROPOSAL", proposalId: proposal.id })}
              >
                Reject
              </button>
              <button
                type="button"
                disabled={proposal.status !== "pending"}
                onClick={() => dispatch({ type: "IGNORE_MEMORY_PROPOSAL", proposalId: proposal.id })}
              >
                Ignore
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
