import type { ReactNode } from "react";
import type {
  BackendExploreScenarioSummary,
  BackendProfileSummary,
  BackendPublicProfileSummary,
  BackendSessionState,
} from "../runtime/backendApi";
import type { Adventure, AdventureThumbnailImage } from "../types/adventure";
import { AdventureThumbnailFrame } from "../components/AdventureThumbnail";
import { getAdventureThumbnail } from "../utils/adventureImages";

interface ProfilePageProps {
  backendMode: boolean;
  backendSession?: BackendSessionState | null;
  profile?: BackendProfileSummary;
  publicProfile?: BackendPublicProfileSummary;
  viewMode?: "own" | "public";
  status?: string;
  liveAdventure?: Adventure;
  onOpenAdventure?: (id: string) => Promise<void>;
  onEditAdventure?: (id: string) => Promise<void>;
  onDeleteAdventure?: (id: string) => Promise<void>;
  onPublishAdventure?: (id: string) => Promise<void>;
  onPublishScenarioRevision?: (revisionId: string) => Promise<void>;
  onUnpublishScenarioRevision?: (revisionId: string) => Promise<void>;
  onStartScenario?: (revisionId: string) => Promise<void>;
  onViewOwnProfile?: () => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  adventureLibrary?: ReactNode;
  onOpenHelp?: () => void;
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
  liveAdventure,
  onOpenAdventure,
  onEditAdventure,
  onDeleteAdventure,
  onPublishAdventure,
  onPublishScenarioRevision,
  onUnpublishScenarioRevision,
  onStartScenario,
  onViewOwnProfile,
  onOpenAdmin,
  onLogout,
  adventureLibrary,
  onOpenHelp,
}: ProfilePageProps) {
  if (!backendMode) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Home</p>
            <h2>Profile & Library</h2>
          </div>
        </header>
        <p className="notice">Account profiles are available in backend mode. Browser Local adventures remain below.</p>
        <NewUserGuide onOpenHelp={onOpenHelp} />
        {adventureLibrary}
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
  const liveAdventureThumbnail = liveAdventure ? getAdventureThumbnail(liveAdventure) : undefined;

  function sourceAdventureThumbnail(sourceAdventureId?: string): AdventureThumbnailImage | undefined {
    return liveAdventure?.id === sourceAdventureId ? liveAdventureThumbnail : undefined;
  }

  function profileAdventureThumbnail(adventureId: string, thumbnail?: AdventureThumbnailImage): AdventureThumbnailImage | undefined {
    return liveAdventure?.id === adventureId ? liveAdventureThumbnail ?? thumbnail : thumbnail;
  }

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
          <div className="toolbar">
            {onOpenAdmin && (
              <button type="button" onClick={onOpenAdmin}>
                Admin Console
              </button>
            )}
            <button type="button" onClick={onLogout} disabled={!onLogout}>
              Logout
            </button>
          </div>
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

      {!isPublicProfile && (
        <NewUserGuide onOpenHelp={onOpenHelp} />
      )}

      {!isPublicProfile && adventureLibrary}

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
                <AdventureThumbnailFrame
                  thumbnail={scenario.thumbnailImage ?? sourceAdventureThumbnail(scenario.sourceAdventureId)}
                  title={scenario.title}
                  className="library-card-cover"
                />
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
                        <>
                          <span className="status-pill">Published in Explore</span>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void onUnpublishScenarioRevision?.(scenario.latestRevision!.id)}
                            disabled={!onUnpublishScenarioRevision}
                          >
                            Unpublish
                          </button>
                        </>
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

      {!isPublicProfile && !adventureLibrary && (
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
                  <AdventureThumbnailFrame
                    thumbnail={profileAdventureThumbnail(adventure.id, adventure.thumbnailImage)}
                    title={adventure.title}
                    className="library-card-cover"
                  />
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
                        className="danger"
                        onClick={() => void onDeleteAdventure?.(adventure.id)}
                        disabled={!onDeleteAdventure}
                      >
                        Delete
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

function NewUserGuide({ onOpenHelp }: { onOpenHelp?: () => void }) {
  return (
    <details className="setup-panel profile-guide">
      <summary>New User Guide</summary>
      <div className="profile-guide-grid">
        <article>
          <p className="eyebrow">1. Start</p>
          <h3>Create or explore</h3>
          <p className="muted">
            Use New Adventure for your own setup, Import from AIST / AI Dungeon / GitHub JSON to continue an existing save,
            or Explore to copy a built-in or community scenario into your account.
          </p>
        </article>
        <article>
          <p className="eyebrow">2. Open adventure</p>
          <h3>Adventure, Play, Edit</h3>
          <p className="muted">
            Once an adventure is open, the top-left Adventure group appears. Adventure is the dashboard, Play is the turn
            screen, and Edit is where setup, Story Cards, Characters, Plot, automations, and imports live.
          </p>
        </article>
        <article>
          <p className="eyebrow">3. Build context</p>
          <h3>Memory is inspectable</h3>
          <p className="muted">
            Plot Essentials, Active Pressure, Story Cards, Characters, Author's Note, and recent messages are assembled
            into Context Preview. Nothing important should be hidden from review.
          </p>
        </article>
        <article>
          <p className="eyebrow">4. Share</p>
          <h3>Publish scenarios</h3>
          <p className="muted">
            Adventures are private playthroughs. Publishing creates a reusable scenario setup for Explore without sharing
            your private transcript. Shared scenarios do not substitute user variables yet.
          </p>
        </article>
      </div>
      <div className="toolbar">
        <button type="button" onClick={onOpenHelp} disabled={!onOpenHelp}>
          Open Docs
        </button>
      </div>
    </details>
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
      <AdventureThumbnailFrame
        thumbnail={scenario.thumbnailImage}
        title={scenario.title}
        className="library-card-cover"
      />
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
