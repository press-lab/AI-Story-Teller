import { buildContext } from "../contextBuilder/contextBuilder";
import type { AdventurePageProps } from "./pageTypes";
import type { ContextBuildResult } from "../types/adventure";

interface ContextPreviewPageProps extends AdventurePageProps {
  contextResult?: ContextBuildResult;
  onBuildContext: () => void;
}

export function ContextPreviewPage({ adventure, contextResult, onBuildContext }: ContextPreviewPageProps) {
  const result = contextResult ?? buildContext(adventure);
  return (
    <section className="page">
      <div className="toolbar">
        <button type="button" onClick={onBuildContext}>
          Rebuild Preview
        </button>
        <strong>Total estimate: {result.totalEstimatedTokens} tokens</strong>
      </div>

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
                {" "}(not in model context — review in Memory Inbox)
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
          <h3>Provider Payload Preview</h3>
          <p style={{ fontSize: "0.85em" }}>
            This is the exact JSON sent to the model. The system message must contain every non-empty section from
            Ordered Sections above. Recent messages follow as individual role messages.
          </p>
          <pre>{JSON.stringify(result.messages, null, 2)}</pre>

          <h3>Excluded Items</h3>
          <pre>{JSON.stringify(result.excludedItems, null, 2)}</pre>

          <h3>Context Decisions</h3>
          <pre>{JSON.stringify(result.decisions, null, 2)}</pre>
        </article>
      </div>
    </section>
  );
}

