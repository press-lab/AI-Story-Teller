import { useState } from "react";
import { classifyMemory } from "../memory/classificationPolicy";
import type { MemoryAutoApproveSettings, MemoryProposal, MemoryProposalType } from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput, commaList, fromCommaList } from "./shared";

const proposalTypes: MemoryProposalType[] = ["storyCard", "brainUpdate", "plotEssentialsUpdate", "summaryUpdate", "ignore"];

export function MemoryInboxPage({ adventure, dispatch }: AdventurePageProps) {
  const proposals = [...adventure.activeState.memoryProposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [sourceText, setSourceText] = useState("");

  function updateProposal(proposal: MemoryProposal, patch: Partial<MemoryProposal>) {
    dispatch({ type: "UPDATE_MEMORY_PROPOSAL", proposalId: proposal.id, patch });
  }

  function createProposal() {
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
  }

  const autoApprove = adventure.memoryAutoApprove;

  function setAutoApprove(patch: Partial<MemoryAutoApproveSettings>) {
    dispatch({ type: "SET_MEMORY_AUTO_APPROVE", settings: { ...autoApprove, ...patch } });
  }

  return (
    <section className="page">
      <article className="panel">
        <h3>Memory Suggestions</h3>
        <p className="muted">
          Memory Suggestions holds AI-proposed changes to your story data — new Story Cards, Character Self updates,
          Plot Essentials rewrites, and Summary changes. The AI generates these automatically after turns or when
          you use <strong>Remember This</strong>. Review each proposal and <strong>Approve</strong> to apply it,
          <strong> Reject</strong> to dismiss it cleanly, or <strong>Ignore</strong> to remove it from view without applying.
          You can edit the content before approving.
        </p>
        <div className="auto-approve-toggles">
          <span className="auto-approve-label muted">Auto-approve:</span>
          <CheckboxField label="Summary" checked={autoApprove.summaryUpdate} onChange={(v) => setAutoApprove({ summaryUpdate: v })} />
          <CheckboxField label="Plot Essentials" checked={autoApprove.plotEssentialsUpdate} onChange={(v) => setAutoApprove({ plotEssentialsUpdate: v })} />
          <CheckboxField label="Story Cards" checked={autoApprove.storyCard} onChange={(v) => setAutoApprove({ storyCard: v })} />
          <CheckboxField label="Characters" checked={autoApprove.brainUpdate} onChange={(v) => setAutoApprove({ brainUpdate: v })} />
        </div>
      </article>

      <details className="panel">
        <summary>Create Suggestion</summary>
        <Field label="Source Text">
          <textarea
            rows={3}
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste narrative content to classify into a memory suggestion."
          />
        </Field>
        <button type="button" disabled={!sourceText.trim()} onClick={createProposal}>
          Create Suggestion
        </button>
      </details>

      <div className="list">
        {proposals.length === 0 && <p className="muted">No memory suggestions yet.</p>}
        {proposals.map((proposal) => (
          <article key={proposal.id} className="card">
            <div className="panel-heading">
              <div className="suggestion-meta">
                <p className="eyebrow">
                  {proposal.proposedType}
                  {proposal.status !== "pending" ? ` · ${proposal.status}` : ""}
                </p>
                <input
                  value={proposal.title}
                  onChange={(event) => updateProposal(proposal, { title: event.target.value })}
                />
              </div>
              <div className="row">
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
                  className="danger"
                  disabled={proposal.status !== "pending"}
                  onClick={() => dispatch({ type: "IGNORE_MEMORY_PROPOSAL", proposalId: proposal.id })}
                >
                  Ignore
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={proposal.content}
              onChange={(event) => updateProposal(proposal, { content: event.target.value })}
              placeholder="Proposed content..."
            />

            <details>
              <summary>Source &amp; Details</summary>
              <div className="grid two">
                <Field label="Source">
                  <textarea
                    rows={2}
                    value={proposal.sourceText}
                    onChange={(event) => updateProposal(proposal, { sourceText: event.target.value })}
                  />
                </Field>
                <Field label="Rationale">
                  <textarea
                    rows={2}
                    value={proposal.rationale}
                    onChange={(event) => updateProposal(proposal, { rationale: event.target.value })}
                  />
                </Field>
              </div>
              <div className="grid three">
                <Field label="Type">
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
                <Field label="Triggers">
                  <input
                    value={commaList(proposal.suggestedTriggers)}
                    onChange={(event) => updateProposal(proposal, { suggestedTriggers: fromCommaList(event.target.value) })}
                  />
                </Field>
                <Field label="Confidence">
                  <NumberInput
                    value={proposal.confidence}
                    min={0}
                    onChange={(value) => updateProposal(proposal, { confidence: Math.max(0, Math.min(1, value)) })}
                  />
                </Field>
              </div>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
