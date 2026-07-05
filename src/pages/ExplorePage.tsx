import type { BackendExploreScenarioSummary, BackendSessionState } from "../runtime/backendApi";

interface ExplorePageProps {
  backendMode: boolean;
  backendSession?: BackendSessionState | null;
  scenarios: BackendExploreScenarioSummary[];
  status?: string;
  onRefresh: () => Promise<void>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ExplorePage({ backendMode, backendSession, scenarios, status, onRefresh }: ExplorePageProps) {
  if (!backendMode) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Scenarios</p>
            <h2>Explore</h2>
          </div>
        </header>
        <p className="notice">Explore is available in backend mode.</p>
      </section>
    );
  }

  if (!backendSession) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Scenarios</p>
            <h2>Explore</h2>
          </div>
        </header>
        <p className="notice">Sign in from Settings to explore published scenarios.</p>
      </section>
    );
  }

  return (
    <section className="page library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">Scenarios</p>
          <h2>Explore</h2>
          <p className="muted">{scenarios.length} available</p>
        </div>
        <button type="button" onClick={() => void onRefresh()}>
          Refresh
        </button>
      </header>

      {status && <p className="notice">{status}</p>}

      {scenarios.length ? (
        <div className="library-grid">
          {scenarios.map((scenario) => (
            <article key={scenario.revisionId} className="library-card">
              <div className="library-card-cover">
                <span>{scenario.title.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="library-card-body">
                <div>
                  <p className="eyebrow">By {scenario.ownerDisplayName}</p>
                  <h3>{scenario.title}</h3>
                  {scenario.description && <p className="muted">{scenario.description}</p>}
                  <div className="editor-stat-row">
                    <span>v{scenario.version}</span>
                    <span>{formatDate(scenario.publishedAt)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No published scenarios yet.</p>
      )}
    </section>
  );
}
