import type {
  BackendExploreScenarioSummary,
  BackendProfileSummary,
  BackendPublicProfileSummary,
  BackendSessionState,
} from "../runtime/backendApi";

interface ProfilePageProps {
  backendMode: boolean;
  backendSession?: BackendSessionState | null;
  profile?: BackendProfileSummary;
  publicProfile?: BackendPublicProfileSummary;
  viewMode?: "own" | "public";
  status?: string;
  onOpenAdventure?: (id: string) => Promise<void>;
  onEditAdventure?: (id: string) => Promise<void>;
  onPublishAdventure?: (id: string) => Promise<void>;
  onPublishScenarioRevision?: (revisionId: string) => Promise<void>;
  onStartScenario?: (revisionId: string) => Promise<void>;
  onViewOwnProfile?: () => void;
  onLogout?: () => void;
}

const publicScenarioStartWarning = "This scenario will start exactly as published. AI Story Teller does not substitute user variables yet. If you do not want to play the premade player character, edit the new adventure after it opens before continuing play.";

function formatDate(iso?: string): string {
  if (!iso) return "Not yet";
  return new Date(iso).toLocaleString();
}

export function ProfilePage({
  backendMode,
  backendSession,
  profile,
  publicProfile,
  viewMode = "own",
  status,
  onOpenAdventure,
  onEditAdventure,
  onPublishAdventure,
  onPublishScenarioRevision,
  onStartScenario,
  onViewOwnProfile,
  onLogout,
}: ProfilePageProps) {
  if (!backendMode) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Account</p>
            <h2>Profile</h2>
          </div>
        </header>
        <p className="notice">Profiles are available in backend mode.</p>
      </section>
    );
  }

  if (!backendSession) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Account</p>
            <h2>Profile</h2>
          </div>
        </header>
        <p className="notice">Sign in from Settings to view this profile.</p>
      </section>
    );
  }

  const isPublicProfile = viewMode === "public";

  if (isPublicProfile && !publicProfile) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Public Profile</p>
            <h2>Profile</h2>
          </div>
          <button type="button" onClick={onViewOwnProfile} disabled={!onViewOwnProfile}>
            Your Profile
          </button>
        </header>
        {status ? <p className="notice">{status}</p> : <p className="notice">Loading profile...</p>}
      </section>
    );
  }

  const displayName = isPublicProfile
    ? publicProfile!.profile.displayName
    : profile?.profile.displayName || backendSession.profile.displayName || backendSession.user.displayName;
  const ownEmail = profile?.user.email || backendSession.user.email;
  const bio = isPublicProfile ? publicProfile!.profile.bio : profile?.profile.bio;

  return (
    <section className="page library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">{isPublicProfile ? "Public Profile" : "Account"}</p>
          <h2>{displayName}</h2>
          {isPublicProfile ? (
            <p className="muted">Joined {formatDate(publicProfile!.user.createdAt)}</p>
          ) : (
            <p className="muted">{ownEmail}</p>
          )}
          {bio && <p className="muted">{bio}</p>}
        </div>
        {isPublicProfile ? (
          <button type="button" onClick={onViewOwnProfile} disabled={!onViewOwnProfile}>
            Your Profile
          </button>
        ) : (
          <button type="button" onClick={onLogout} disabled={!onLogout}>
            Logout
          </button>
        )}
      </header>

      {status && <p className="notice">{status}</p>}

      <div className="editor-stat-row" aria-label="Profile summary">
        {isPublicProfile ? (
          <>
            <span>{publicProfile!.scenarios.length} published scenarios</span>
            <span>Public profile</span>
          </>
        ) : (
          <>
            <span>{profile?.adventures.length ?? 0} adventures</span>
            <span>{profile?.scenarios.length ?? 0} scenarios</span>
            <span>{backendSession.user.status}</span>
          </>
        )}
      </div>

      <section className="profile-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Shareable</p>
            <h3>Scenarios</h3>
            <p className="muted">
              {isPublicProfile
                ? "Published scenarios from this creator. Starting one copies the setup, not their private transcripts."
                : "Published scenarios appear in Explore. They copy setup, not private transcripts."}
            </p>
          </div>
        </div>
        {isPublicProfile ? (
          <>
            <p className="notice">{publicScenarioStartWarning}</p>
            {publicProfile!.scenarios.length ? (
              <div className="library-grid">
                {publicProfile!.scenarios.map((scenario) => (
                  <PublicScenarioCard
                    key={scenario.revisionId}
                    scenario={scenario}
                    onStartScenario={onStartScenario}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No published scenarios yet.</p>
            )}
          </>
        ) : profile?.scenarios.length ? (
          <div className="library-grid">
            {profile.scenarios.map((scenario) => (
              <article key={scenario.id} className="library-card">
                <div className="library-card-body">
                  <div>
                    <h3>{scenario.title}</h3>
                    {scenario.description && <p className="muted">{scenario.description}</p>}
                    <div className="editor-stat-row">
                      <span>{scenario.revisionCount} revisions</span>
                      <span>{scenario.publishedRevisionCount} published</span>
                      {scenario.latestRevision && (
                        <span>
                          v{scenario.latestRevision.version} {scenario.latestRevision.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {scenario.latestRevision && (
                    <div className="library-card-actions">
                      {scenario.latestRevision.status === "draft" && (
                        <button
                          type="button"
                          className="primary-action"
                          onClick={() => void onPublishScenarioRevision?.(scenario.latestRevision!.id)}
                          disabled={!onPublishScenarioRevision}
                        >
                          Publish Latest
                        </button>
                      )}
                      {scenario.latestRevision.status === "published" && (
                        <span className="status-pill">Published in Explore</span>
                      )}
                      {scenario.latestRevision.status === "quarantined" && (
                        <span className="status-pill">Needs review</span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No created scenarios yet. Publish an adventure below to create one.</p>
        )}
      </section>

      {!isPublicProfile && (
        <section className="profile-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Personal</p>
              <h3>Adventures</h3>
              <p className="muted">
                Adventures are your private playthroughs. Open to play, edit setup, or publish the reusable setup as a scenario.
              </p>
            </div>
          </div>
          {profile?.adventures.length ? (
            <div className="library-grid">
              {profile.adventures.map((adventure) => (
                <article key={adventure.id} className="library-card">
                  <div className="library-card-body">
                    <div>
                      <h3>{adventure.title}</h3>
                      <p className="muted">Updated {formatDate(adventure.updatedAt)}</p>
                      <div className="editor-stat-row">
                        <span>{adventure.turnCount} turns</span>
                        <span>{adventure.storyEntryCount} story entries</span>
                      </div>
                    </div>
                    <div className="library-card-actions">
                      <button type="button" onClick={() => void onOpenAdventure?.(adventure.id)} disabled={!onOpenAdventure}>
                        Open
                      </button>
                      <button type="button" onClick={() => void onEditAdventure?.(adventure.id)} disabled={!onEditAdventure}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="primary-action"
                        onClick={() => void onPublishAdventure?.(adventure.id)}
                        disabled={!onPublishAdventure}
                      >
                        Publish Scenario
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No backend adventures yet.</p>
          )}
        </section>
      )}
    </section>
  );
}

function PublicScenarioCard({
  scenario,
  onStartScenario,
}: {
  scenario: BackendExploreScenarioSummary;
  onStartScenario?: (revisionId: string) => Promise<void>;
}) {
  return (
    <article className="library-card">
      <div className="library-card-body">
        <div>
          <h3>{scenario.title}</h3>
          {scenario.description && <p className="muted">{scenario.description}</p>}
          <div className="editor-stat-row">
            <span>v{scenario.version}</span>
            <span>Published {formatDate(scenario.publishedAt)}</span>
          </div>
        </div>
        <div className="library-card-actions">
          <button
            type="button"
            className="primary-action"
            onClick={() => void onStartScenario?.(scenario.revisionId)}
            disabled={!onStartScenario}
          >
            Start Adventure
          </button>
        </div>
      </div>
    </article>
  );
}
