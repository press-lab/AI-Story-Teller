import type { BackendExploreScenarioSummary, BackendSessionState } from "../runtime/backendApi";
import type { PremadeAdventureDefinition, PremadeAdventureId } from "../dev/premadeAdventures";

interface ExplorePageProps {
  backendMode: boolean;
  backendSession?: BackendSessionState | null;
  scenarios: BackendExploreScenarioSummary[];
  premadeAdventures?: PremadeAdventureDefinition[];
  status?: string;
  onStartScenario?: (revisionId: string) => Promise<void>;
  onStartPremade?: (premadeId: PremadeAdventureId) => Promise<void>;
  onOpenProfile?: (userId: string) => Promise<void>;
}

const scenarioStartWarning = "This scenario will start exactly as published. AI Story Teller does not substitute user variables yet. If you do not want to play the premade player character, edit the new adventure after it opens before continuing play.";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ExplorePage({
  backendMode,
  backendSession,
  scenarios,
  premadeAdventures = [],
  status,
  onStartScenario,
  onStartPremade,
  onOpenProfile,
}: ExplorePageProps) {
  const canUseBackendScenarios = backendMode && Boolean(backendSession);
  const totalAvailable = scenarios.length + premadeAdventures.length;

  return (
    <section className="page library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">Scenarios</p>
          <h2>Explore</h2>
          <p className="muted">{totalAvailable} available</p>
        </div>
      </header>

      <p className="notice explore-variable-warning">{scenarioStartWarning}</p>
      {backendMode && !backendSession && <p className="notice">Sign in from Settings to start published backend scenarios.</p>}
      {status && <p className="notice">{status}</p>}

      {premadeAdventures.length > 0 && (
        <section className="explore-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Built In</p>
              <h3>Premade Scenarios</h3>
            </div>
          </div>
          <div className="library-grid">
            {premadeAdventures.map((premade) => (
              <article key={premade.id} className="library-card">
                <div className="library-card-cover">
                  <span>{premade.title.slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="library-card-body">
                  <div>
                    <p className="eyebrow">{premade.eyebrow}</p>
                    <h3>{premade.title}</h3>
                    <p className="muted">{premade.summary}</p>
                    <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                      {premade.tags.map((tag) => (
                        <span key={tag} className="status-pill">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="library-card-actions">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={!onStartPremade}
                      onClick={() => void onStartPremade?.(premade.id)}
                    >
                      Start Adventure
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {canUseBackendScenarios && scenarios.length ? (
        <section className="explore-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Community</p>
              <h3>Published Scenarios</h3>
            </div>
          </div>
          <div className="library-grid">
            {scenarios.map((scenario) => (
              <article key={scenario.revisionId} className="library-card">
                <div className="library-card-cover">
                  <span>{scenario.title.slice(0, 1).toUpperCase()}</span>
                </div>
                <div className="library-card-body">
                  <div>
                    <p className="eyebrow">
                      By{" "}
                      <button
                        type="button"
                        className="profile-link-button"
                        aria-label={`Open ${scenario.ownerDisplayName} profile`}
                        disabled={!onOpenProfile}
                        onClick={() => void onOpenProfile?.(scenario.ownerUserId)}
                      >
                        {scenario.ownerDisplayName}
                      </button>
                    </p>
                    <h3>{scenario.title}</h3>
                    {scenario.description && <p className="muted">{scenario.description}</p>}
                    <div className="editor-stat-row">
                      <span>v{scenario.version}</span>
                      <span>{formatDate(scenario.publishedAt)}</span>
                    </div>
                  </div>
                  <div className="library-card-actions">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={!onStartScenario}
                      onClick={() => void onStartScenario?.(scenario.revisionId)}
                    >
                      Start Adventure
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : canUseBackendScenarios ? (
        <p className="muted">No published community scenarios yet.</p>
      ) : (
        <p className="muted">Community scenarios are available after backend sign-in.</p>
      )}
    </section>
  );
}
