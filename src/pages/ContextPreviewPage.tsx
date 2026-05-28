import { buildContext } from "../contextBuilder/contextBuilder";
import type { AdventurePageProps } from "./pageTypes";
import type { ContextBuildResult, ContextItem, ContextSection } from "../types/adventure";

interface DuplicateWarning {
  a: ContextItem;
  b: ContextItem;
  overlap: number;
}

function detectDuplicateContent(sections: ContextSection[]): DuplicateWarning[] {
  const items = sections.flatMap((s) =>
    s.items.filter((entry) => entry.content.trim().length > 80 && entry.sourceType !== "system"),
  );
  const warnings: DuplicateWarning[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const wordsA = new Set(items[i].content.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
      const wordsB = new Set(items[j].content.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
      if (wordsA.size < 10 || wordsB.size < 10) continue;
      const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
      const overlap = intersection / Math.min(wordsA.size, wordsB.size);
      if (overlap > 0.5) warnings.push({ a: items[i], b: items[j], overlap });
    }
  }
  return warnings;
}

interface ContextPreviewPageProps extends AdventurePageProps {
  contextResult?: ContextBuildResult;
  onBuildContext: () => void;
}

export function ContextPreviewPage({ adventure, contextResult, onBuildContext }: ContextPreviewPageProps) {
  const result = contextResult ?? buildContext(adventure);
  const duplicates = detectDuplicateContent(result.sections);

  const totalActualIn = adventure.messages.reduce((sum, m) => sum + (m.usage?.promptTokens ?? 0), 0);
  const totalActualOut = adventure.messages.reduce((sum, m) => sum + (m.usage?.completionTokens ?? 0), 0);
  const hasActualUsage = totalActualIn > 0 || totalActualOut > 0;

  return (
    <section className="page">
      <div className="toolbar">
        <button type="button" onClick={onBuildContext}>
          Rebuild Preview
        </button>
        <strong>Total estimate: {result.totalEstimatedTokens} tokens</strong>
        {hasActualUsage && (
          <span className="muted">Session: ↑{totalActualIn.toLocaleString()} ↓{totalActualOut.toLocaleString()} tokens</span>
        )}
      </div>
      {duplicates.length > 0 && (
        <details className="panel" style={{ borderLeft: "3px solid var(--color-warning, #f0a)" }}>
          <summary>Duplicate Content Warnings ({duplicates.length})</summary>
          <p className="muted" style={{ margin: "0.25rem 0" }}>
            These items share significant word overlap (&gt;50%). Consolidating duplicates reduces token usage and prevents contradictions.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {duplicates.map(({ a, b, overlap }, idx) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>
                <strong>{a.title}</strong> ↔ <strong>{b.title}</strong>
                <span className="muted"> — {Math.round(overlap * 100)}% word overlap</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="muted" style={{ margin: 0 }}>
        Everything the model sees — assembled from Story Cards, World Blocks, Brains, summary, and recent messages.
        Sections with no items are collapsed and excluded from the provider payload.
        Use this to verify what's actually being sent, diagnose missing context, and check token budgets.
      </p>

      <div className="grid two">
        <article className="panel">
          <h3>Ordered Sections (A-K)</h3>
          {result.sections.map((section) => (
            <details key={section.id} open={section.items.length > 0}>
              <summary>
                {section.label} · {section.tokenEstimate} tokens · {section.items.length} items
              </summary>
              {section.items.length > 0 ? (
                <table style={{ width: "100%", fontSize: "0.85em", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Title</th>
                      <th>Tokens</th>
                      <th>Priority</th>
                      <th>Protected</th>
                      <th>Pinned</th>
                      <th>Policy</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.title}</td>
                        <td style={{ textAlign: "center" }}>{entry.tokenEstimate}</td>
                        <td style={{ textAlign: "center" }}>{entry.priority}</td>
                        <td style={{ textAlign: "center" }}>{entry.protected ? "✓" : ""}</td>
                        <td style={{ textAlign: "center" }}>{entry.pinned ? "✓" : ""}</td>
                        <td>{entry.inclusionPolicy}</td>
                        <td>{entry.generatedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <em style={{ padding: "0.25rem 0.5rem", display: "block" }}>(empty — not in payload)</em>
              )}
              {section.content && <pre style={{ marginTop: "0.5rem" }}>{section.content}</pre>}
            </details>
          ))}

          {result.pendingProposals.length > 0 && (
            <details open>
              <summary>
                Memory Proposals / Pending Updates · {result.pendingProposals.length} pending
                {" "}(not in model context — review in Memory Suggestions)
              </summary>
              {result.pendingProposals.map((proposal) => (
                <details key={proposal.id} style={{ marginLeft: "1rem" }}>
                  <summary>
                    [{proposal.proposedType}] {proposal.title} — confidence {Math.round(proposal.confidence * 100)}%
                  </summary>
                  <p><strong>Rationale:</strong> {proposal.rationale}</p>
                  <p><strong>Source text:</strong> {proposal.sourceText}</p>
                  <pre>{proposal.content}</pre>
                  {proposal.suggestedTriggers.length > 0 && (
                    <p><strong>Suggested triggers:</strong> {proposal.suggestedTriggers.join(", ")}</p>
                  )}
                </details>
              ))}
            </details>
          )}
        </article>

        <article className="panel">
          <details>
            <summary>Provider Payload Preview</summary>
            <p style={{ fontSize: "0.85em", marginTop: "0.5rem" }}>
              The exact JSON sent to the model. The system message contains every non-empty section above.
              Recent messages follow as individual role/content pairs.
            </p>
            <pre>{JSON.stringify(result.messages, null, 2)}</pre>
          </details>

          <details style={{ marginTop: "10px" }}>
            <summary>Excluded Items ({result.excludedItems.length})</summary>
            {result.excludedItems.length === 0
              ? <em style={{ padding: "0.25rem 0.5rem", display: "block" }}>(none excluded)</em>
              : <pre>{JSON.stringify(result.excludedItems, null, 2)}</pre>
            }
          </details>

          <details style={{ marginTop: "10px" }}>
            <summary>Context Decisions ({result.decisions.length})</summary>
            {result.decisions.length === 0
              ? <em style={{ padding: "0.25rem 0.5rem", display: "block" }}>(no decisions logged)</em>
              : <pre>{JSON.stringify(result.decisions, null, 2)}</pre>
            }
          </details>
        </article>
      </div>
    </section>
  );
}

