import type { AdventurePageProps } from "./pageTypes";

interface SummaryPageProps extends AdventurePageProps {
  loading: boolean;
  onGenerateSummary: () => Promise<void>;
}

export function SummaryPage({ adventure, dispatch, loading, onGenerateSummary }: SummaryPageProps) {
  return (
    <section className="page">
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
