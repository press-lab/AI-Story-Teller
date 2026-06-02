import { useState } from "react";
import { classifyMemory } from "../memory/classificationPolicy";
import type { MemoryAutoApproveSettings, MemoryProposal, MemoryProposalType } from "../types/adventure";
import { createId, nowIso } from "../utils/id";
import type { AdventurePageProps } from "./pageTypes";
import { CheckboxField, Field, NumberInput, commaList, fromCommaList } from "./shared";

const proposalTypes: MemoryProposalType[] = ["storyCard", "brainUpdate", "plotEssentialsUpdate", "summaryUpdate", "ignore"];

interface MemoryInboxPageProps extends AdventurePageProps {
  onRegenerateProposal?: (proposalId: string) => Promise<void>;
}

export function MemoryInboxPage({ adventure, dispatch, onRegenerateProposal }: MemoryInboxPageProps) {
  const allProposals = [...adventure.activeState.memoryProposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = allProposals.filter((p) => p.status === "pending");
  const resolved = allProposals.filter((p) => p.status !== "pending");
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
          {" "}<strong>Every approved proposal becomes permanent context</strong> — the model reads it every turn and writes toward it.
          Be especially careful with Character Self and Summary updates: approving emotional escalation or relationship milestones
          unchecked is how characters drift. Edit proposals before approving, or reject ones that pull the story somewhere you don't want.
        </p>
        <div className="auto-approve-toggles">
          <span className="auto-approve-label muted">Auto-approve:</span>
          <CheckboxField label="Summary" checked={autoApprove.summaryUpdate} onChange={(v) => setAutoApprove({ summaryUpdate: v })} />
          <CheckboxField label="Plot Essentials" checked={autoApprove.plotEssentialsUpdate} onChange={(v) => setAutoApprove({ plotEssentialsUpdate: v })} />
          <CheckboxField label="Active Pressure" checked={autoApprove.plotPressureUpdate} onChange={(v) => setAutoApprove({ plotPressureUpdate: v })} />
          <CheckboxField label="Momentum" checked={autoApprove.plotMomentumUpdate} onChange={(v) => setAutoApprove({ plotMomentumUpdate: v })} />
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
        {pending.length === 0 && <p className="muted">No pending memory suggestions.</p>}
        {pending.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} dispatch={dispatch} onUpdate={updateProposal} onRegenerate={onRegenerateProposal} />
        ))}
      </div>

      {resolved.length > 0 && (
        <details className="panel memory-history-panel">
          <summary>History ({resolved.length})</summary>
          <div className="list" style={{ marginTop: "0.75rem" }}>
            {resolved.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} dispatch={dispatch} onUpdate={updateProposal} onRegenerate={onRegenerateProposal} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

interface ProposalCardProps {
  proposal: MemoryProposal;
  dispatch: AdventurePageProps["dispatch"];
  onUpdate: (proposal: MemoryProposal, patch: Partial<MemoryProposal>) => void;
  onRegenerate?: (proposalId: string) => Promise<void>;
}

function ProposalCard({ proposal, dispatch, onUpdate, onRegenerate }: ProposalCardProps) {
  const isPending = proposal.status === "pending";
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    if (!onRegenerate || regenerating) return;
    setRegenerating(true);
    try { await onRegenerate(proposal.id); } finally { setRegenerating(false); }
  }

  return (
    <article key={proposal.id} className={`card proposal-card proposal-${proposal.status}`}>
      <div className="panel-heading">
        <div className="suggestion-meta">
          <p className="eyebrow">
            {proposal.proposedType}
            {proposal.status !== "pending" ? ` · ${proposal.status}` : ""}
          </p>
          <input
            value={proposal.title}
            onChange={(event) => onUpdate(proposal, { title: event.target.value })}
            disabled={!isPending}
          />
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() => dispatch({ type: "APPROVE_MEMORY_PROPOSAL", proposalId: proposal.id })}
          >
            Approve
          </button>
          {isPending && (
            <>
              {onRegenerate && (
                <button type="button" disabled={regenerating} onClick={handleRegenerate}>
                  {regenerating ? "…" : "Regenerate"}
                </button>
              )}
              <button
                type="button"
                onClick={() => dispatch({ type: "REJECT_MEMORY_PROPOSAL", proposalId: proposal.id })}
              >
                Reject
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => dispatch({ type: "IGNORE_MEMORY_PROPOSAL", proposalId: proposal.id })}
              >
                Ignore
              </button>
            </>
          )}
        </div>
      </div>

      <textarea
        rows={5}
        value={proposal.content}
        onChange={(event) => onUpdate(proposal, { content: event.target.value })}
        placeholder="Proposed content..."
        disabled={proposal.status === "approved"}
      />

      <details>
        <summary>Source &amp; Details</summary>
        <div className="grid two">
          <Field label="Source">
            <textarea
              rows={2}
              value={proposal.sourceText}
              onChange={(event) => onUpdate(proposal, { sourceText: event.target.value })}
            />
          </Field>
          <Field label="Rationale">
            <textarea
              rows={2}
              value={proposal.rationale}
              onChange={(event) => onUpdate(proposal, { rationale: event.target.value })}
            />
          </Field>
        </div>
        <div className="grid three">
          <Field label="Type">
            <select
              value={proposal.proposedType}
              onChange={(event) => onUpdate(proposal, { proposedType: event.target.value as MemoryProposalType })}
              disabled={!isPending}
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
              onChange={(event) => onUpdate(proposal, { suggestedTriggers: fromCommaList(event.target.value) })}
            />
          </Field>
          <Field label="Confidence">
            <NumberInput
              value={proposal.confidence}
              min={0}
              onChange={(value) => onUpdate(proposal, { confidence: Math.max(0, Math.min(1, value)) })}
            />
          </Field>
        </div>
      </details>
    </article>
  );
}
