import type { AdventurePageProps } from "./pageTypes";

interface SummaryPageProps extends AdventurePageProps {
  loading: boolean;
  onGenerateSummary: () => Promise<void>;
}

export function SummaryPage({ adventure, dispatch, loading, onGenerateSummary }: SummaryPageProps) {
  return (
    <section className="page">
      <article className="panel">
        <h3>Story Summary</h3>
        <p className="muted">
          The rolling summary is a compressed retelling of past events that gets sent to the model every turn —
          keeping older story context alive even after those messages scroll out of the Recent Messages window.
          The AI auto-generates it in the background every 20 turns (configurable in Settings).
          You can edit it freely or regenerate it manually from the full Chronicle.
        </p>
      </article>

      <div className="toolbar">
        <button type="button" disabled={loading} onClick={onGenerateSummary}>
          {loading ? "Generating..." : "Generate Summary From History"}
        </button>
        <span className="muted">Updated {new Date(adventure.rollingSummary.updatedAt).toLocaleString()}</span>
      </div>
      <textarea
        rows={18}
        value={adventure.rollingSummary.content}
        onChange={(event) => dispatch({ type: "UPDATE_ROLLING_SUMMARY", content: event.target.value })}
        placeholder="Rolling summary participates in context after quest state and before recent messages."
      />
    </section>
  );
}
