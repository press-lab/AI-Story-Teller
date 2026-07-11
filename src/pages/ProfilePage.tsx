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
  onEditScenario?: (revisionId: string) => Promise<void>;
  onDeleteScenario?: (scenarioId: string) => Promise<void>;
  localScenarios?: LocalProfileScenarioSummary[];
  onStartLocalScenario?: (scenarioId: string) => Promise<void>;
  onDeleteLocalScenario?: (scenarioId: string) => Promise<void>;
  onViewOwnProfile?: () => void;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  adventureLibrary?: ReactNode;
  onOpenHelp?: () => void;
  onOpenExplore?: () => void;
}

const publicScenarioStartWarning = "This Scenario starts exactly as published. If you want a different player character, start the private Story and change its setup in Story Studio before taking the first turn.";

export interface LocalProfileScenarioSummary {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  thumbnailImage?: AdventureThumbnailImage;
}

function formatDate(iso?: string): string {
  if (!iso) return "Not yet";
  return new Date(iso).toLocaleString();
}

function currentScenePreview(adventure: Adventure): string {
  const latestAssistant = [...adventure.messages].reverse().find((message) => message.role === "assistant");
  const source = latestAssistant?.content || adventure.openingScene || "This Story is ready for its first turn.";
  const normalized = source.trim().replace(/\s+/g, " ");
  return normalized.length > 240 ? `${normalized.slice(0, 237).trim()}...` : normalized;
}

function HomeStoryHero({
  story,
  onContinue,
  onEdit,
  onExplore,
}: {
  story?: Adventure;
  onContinue?: (id: string) => Promise<void>;
  onEdit?: (id: string) => Promise<void>;
  onExplore?: () => void;
}) {
  if (!story) {
    return (
      <section className="home-story-hero home-story-empty">
        <div>
          <p className="eyebrow">Your next Story</p>
          <h2>Find a world worth stepping into</h2>
          <p className="muted">Preview a reusable Scenario, then start a private Story that belongs to you.</p>
        </div>
        <button type="button" className="primary-action" onClick={onExplore} disabled={!onExplore}>Explore Scenarios</button>
      </section>
    );
  }

  return (
    <section className="home-story-hero">
      <AdventureThumbnailFrame
        thumbnail={getAdventureThumbnail(story)}
        title={story.title}
        className="home-story-cover"
      />
      <div className="home-story-content">
        <div>
          <p className="eyebrow">Continue your Story</p>
          <h2>{story.title}</h2>
          <p className="muted">Turn {story.activeState.turn} · Last modified {formatDate(story.updatedAt)}</p>
        </div>
        <p className="home-story-preview">{currentScenePreview(story)}</p>
        <div className="home-story-actions">
          <button type="button" className="primary-action" onClick={() => void onContinue?.(story.id)} disabled={!onContinue}>
            Continue Story
          </button>
          <button type="button" onClick={() => void onEdit?.(story.id)} disabled={!onEdit}>Open Story Studio</button>
        </div>
      </div>
    </section>
  );
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
  onEditScenario,
  onDeleteScenario,
  localScenarios = [],
  onStartLocalScenario,
  onDeleteLocalScenario,
  onViewOwnProfile,
  onOpenAdmin,
  onLogout,
  adventureLibrary,
  onOpenHelp,
  onOpenExplore,
}: ProfilePageProps) {
  if (!backendMode) {
    return (
      <section className="page library-page">
        <header className="library-header home-header">
          <div>
            <p className="eyebrow">Home</p>
            <h2>Welcome back</h2>
            <p className="muted">Continue where you left off or start something new.</p>
          </div>
        </header>
        <HomeStoryHero story={liveAdventure} onContinue={onOpenAdventure} onEdit={onEditAdventure} onExplore={onOpenExplore} />
        {adventureLibrary}
        <details className="setup-panel home-secondary-panel">
          <summary>Browser Local details</summary>
          <p className="muted">These Stories stay in this browser unless you back them up or transfer them. Account profiles are available in hosted mode.</p>
        </details>
        <NewUserGuide onOpenHelp={onOpenHelp} />
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
  const ownScenarioCount = (profile?.scenarios.length ?? 0) + localScenarios.length;

  function sourceAdventureThumbnail(sourceAdventureId?: string): AdventureThumbnailImage | undefined {
    return liveAdventure?.id === sourceAdventureId ? liveAdventureThumbnail : undefined;
  }

  function profileAdventureThumbnail(adventureId: string, thumbnail?: AdventureThumbnailImage): AdventureThumbnailImage | undefined {
    return liveAdventure?.id === adventureId ? liveAdventureThumbnail ?? thumbnail : thumbnail;
  }

  return (
    <section className="page library-page">
      <header className={`library-header${isPublicProfile ? "" : " home-header"}`}>
        <div>
          <p className="eyebrow">{isPublicProfile ? "Public Profile" : "Home"}</p>
          <h2>{isPublicProfile ? displayName : `Welcome back, ${displayName.split(" ")[0]}`}</h2>
          {isPublicProfile ? (
            <p className="muted">Joined {formatDate(publicProfile!.user.createdAt)}</p>
          ) : (
            <p className="muted">Continue where you left off or begin a new Story.</p>
          )}
          {isPublicProfile && bio && <p className="muted">{bio}</p>}
        </div>
        {isPublicProfile ? (
          <button type="button" onClick={onViewOwnProfile} disabled={!onViewOwnProfile}>
            Your Profile
          </button>
        ) : (
          <button type="button" onClick={onOpenExplore} disabled={!onOpenExplore}>Explore Scenarios</button>
        )}
      </header>

      {status && <p className="notice">{status}</p>}

      {!isPublicProfile && (
        <HomeStoryHero story={liveAdventure} onContinue={onOpenAdventure} onEdit={onEditAdventure} onExplore={onOpenExplore} />
      )}

      {isPublicProfile && (
        <div className="editor-stat-row" aria-label="Profile summary">
          <>
            <span>{publicProfile!.scenarios.length} published scenarios</span>
            <span>Public profile</span>
          </>
        </div>
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
                : "Scenarios are reusable setups. Start one to create a private Story; publish one to list it in Explore."}
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
        ) : (profile?.scenarios.length || localScenarios.length) ? (
          <div className="library-grid">
            {localScenarios.map((scenario) => (
              <article key={scenario.id} className="library-card">
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
                      <span>local device</span>
                      <span>not published</span>
                      <span>Updated {formatDate(scenario.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="library-card-actions">
                    <button
                      type="button"
                      className="primary-action"
                      aria-label={`Start Story from local Scenario ${scenario.title}`}
                      onClick={() => void onStartLocalScenario?.(scenario.id)}
                      disabled={!onStartLocalScenario}
                    >
                      Start Story
                    </button>
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Delete local scenario ${scenario.title}`}
                      onClick={() => void onDeleteLocalScenario?.(scenario.id)}
                      disabled={!onDeleteLocalScenario}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {profile?.scenarios.map((scenario) => (
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
                  <div className="library-card-actions">
                    {scenario.latestRevision ? (
                      <>
                        <button
                          type="button"
                          className="primary-action"
                          aria-label={`Start Story from ${scenario.title}`}
                          onClick={() => void onStartScenario?.(scenario.latestRevision!.id)}
                          disabled={!onStartScenario}
                        >
                          Start Story
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit scenario ${scenario.title}`}
                          onClick={() => void onEditScenario?.(scenario.latestRevision!.id)}
                          disabled={!onEditScenario}
                        >
                          Edit Scenario
                        </button>
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
                      </>
                    ) : (
                      <span className="status-pill">No revision</span>
                    )}
                    <button
                      type="button"
                      className="danger"
                      aria-label={`Delete scenario ${scenario.title}`}
                      onClick={() => void onDeleteScenario?.(scenario.id)}
                      disabled={!onDeleteScenario}
                    >
                      Delete
                    </button>
                  </div>
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

      {!isPublicProfile && (
        <>
          <NewUserGuide onOpenHelp={onOpenHelp} />
          <details className="setup-panel home-account-panel">
            <summary>Account &amp; profile</summary>
            <div className="home-account-content">
              <div>
                <strong>{displayName}</strong>
                <p className="muted">{ownEmail}</p>
                {bio && <p className="muted">{bio}</p>}
              </div>
              <div className="editor-stat-row" aria-label="Account library summary">
                <span>{profile?.adventures.length ?? 0} Stories</span>
                <span>{ownScenarioCount} Scenarios</span>
              </div>
              <div className="toolbar">
                {onOpenAdmin && <button type="button" onClick={onOpenAdmin}>Admin</button>}
                <button type="button" onClick={onLogout} disabled={!onLogout}>Sign out</button>
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function NewUserGuide({ onOpenHelp }: { onOpenHelp?: () => void }) {
  return (
    <details className="setup-panel profile-guide">
      <summary>Getting started</summary>
      <div className="profile-guide-grid">
        <article>
          <p className="eyebrow">1. Start</p>
          <h3>Create or explore</h3>
          <p className="muted">
            Use New Story for your own setup, restore an existing backup, or Explore a built-in or community Scenario.
          </p>
        </article>
        <article>
          <p className="eyebrow">2. Open a Story</p>
          <h3>Play or open Studio</h3>
          <p className="muted">
            Play is the reading and turn-taking screen. Story Studio is where you shape direction, Characters, World Blocks,
            Reference Cards, and Suggestions.
          </p>
        </article>
        <article>
          <p className="eyebrow">3. Stay in control</p>
          <h3>Review Suggestions</h3>
          <p className="muted">
            Suggested durable changes wait for review. Exact context sections and token details remain available in the
            Advanced Context Inspector when you need them.
          </p>
        </article>
        <article>
          <p className="eyebrow">4. Share</p>
          <h3>Publish scenarios</h3>
          <p className="muted">
            Adventures are private playthroughs. Publishing creates a reusable scenario setup for Explore without sharing
            your private transcript. Edit Scenario opens the reusable setup without starting a playable adventure; Save Scenario Revision writes a new draft before
            you publish. Shared scenarios do not substitute user variables yet.
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
            Start Story
          </button>
        </div>
      </div>
    </article>
  );
}
