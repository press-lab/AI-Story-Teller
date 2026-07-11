import { useEffect, useMemo, useRef, useState } from "react";
import { AdventureThumbnailFrame } from "../components/AdventureThumbnail";
import type { PremadeAdventureDefinition, PremadeAdventureId } from "../dev/premadeAdventures";
import type { BackendExploreScenarioSummary, BackendSessionState } from "../runtime/backendApi";
import { getAdventureThumbnail } from "../utils/adventureImages";

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

type ExploreSourceFilter = "all" | "built-in" | "community";

type SelectedScenario =
  | { kind: "built-in"; id: PremadeAdventureId }
  | { kind: "community"; revisionId: string };

const scenarioStartWarning = "This Story begins with the published player character and opening exactly as shown. To play someone else, start the Story, then change its setup in Story Studio before taking your first turn.";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function includesSearch(values: Array<string | undefined>, query: string): boolean {
  if (!query) return true;
  return values.some((value) => value?.toLocaleLowerCase().includes(query));
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<ExploreSourceFilter>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedScenario, setSelectedScenario] = useState<SelectedScenario | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastDetailTriggerRef = useRef<HTMLButtonElement>(null);
  const canUseBackendScenarios = backendMode && Boolean(backendSession);
  const totalAvailable = scenarios.length + premadeAdventures.length;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  const builtInTags = useMemo(
    () => Array.from(new Set(premadeAdventures.flatMap((premade) => premade.tags))).sort((a, b) => a.localeCompare(b)),
    [premadeAdventures],
  );

  const premadeThumbnails = useMemo(
    () => new Map(premadeAdventures.map((premade) => [premade.id, getAdventureThumbnail(premade.createAdventure())])),
    [premadeAdventures],
  );

  const visiblePremades = premadeAdventures.filter((premade) => {
    if (sourceFilter === "community") return false;
    if (tagFilter !== "all" && !premade.tags.includes(tagFilter)) return false;
    return includesSearch([premade.title, premade.eyebrow, premade.summary, ...premade.tags], normalizedQuery);
  });

  const visibleCommunityScenarios = scenarios.filter((scenario) => {
    if (sourceFilter === "built-in" || tagFilter !== "all") return false;
    return includesSearch(
      [scenario.title, scenario.description, scenario.ownerDisplayName],
      normalizedQuery,
    );
  });

  const selectedPremade = selectedScenario?.kind === "built-in"
    ? premadeAdventures.find((premade) => premade.id === selectedScenario.id)
    : undefined;
  const selectedCommunityScenario = selectedScenario?.kind === "community"
    ? scenarios.find((scenario) => scenario.revisionId === selectedScenario.revisionId)
    : undefined;
  const selectedKey = selectedPremade
    ? `built-in:${selectedPremade.id}`
    : selectedCommunityScenario
      ? `community:${selectedCommunityScenario.revisionId}`
      : null;
  const canStartSelected = selectedPremade ? Boolean(onStartPremade) : Boolean(selectedCommunityScenario && onStartScenario);
  const resultCount = visiblePremades.length + visibleCommunityScenarios.length;

  useEffect(() => {
    if (selectedKey) {
      detailHeadingRef.current?.focus();
    } else {
      lastDetailTriggerRef.current?.focus();
    }
  }, [selectedKey]);

  function selectSource(source: ExploreSourceFilter) {
    setSourceFilter(source);
    if (source === "community") setTagFilter("all");
  }

  function selectTag(tag: string) {
    setTagFilter(tag);
    if (tag !== "all") setSourceFilter("built-in");
  }

  function showDetails(selection: SelectedScenario, trigger: HTMLButtonElement) {
    lastDetailTriggerRef.current = trigger;
    setSelectedScenario(selection);
  }

  function closeDetails() {
    setSelectedScenario(null);
  }

  async function startSelectedStory() {
    if (!selectedKey || startingKey) return;
    setStartingKey(selectedKey);
    try {
      if (selectedPremade) {
        await onStartPremade?.(selectedPremade.id);
      } else if (selectedCommunityScenario) {
        await onStartScenario?.(selectedCommunityScenario.revisionId);
      }
    } finally {
      setStartingKey(null);
    }
  }

  return (
    <section className="page library-page explore-page">
      <header className="library-header explore-header">
        <div>
          <p className="eyebrow">Scenarios</p>
          <h2>Explore</h2>
          <p className="muted explore-intro">
            Find a reusable Scenario you like, preview it, then make it your own private Story.
          </p>
        </div>
        <p className="muted explore-result-count" role="status" aria-live="polite">
          {resultCount === totalAvailable ? `${totalAvailable} available` : `${resultCount} of ${totalAvailable} shown`}
        </p>
      </header>

      <section className="explore-controls" aria-label="Find scenarios">
        <label className="field explore-search-field">
          <span>Search scenarios</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title, premise, tag, or creator"
          />
        </label>

        <fieldset className="explore-source-filter">
          <legend>Source</legend>
          <div className="toolbar explore-filter-options">
            <button
              type="button"
              className={sourceFilter === "all" ? "active" : ""}
              aria-pressed={sourceFilter === "all"}
              onClick={() => selectSource("all")}
            >
              All <span aria-hidden="true">{totalAvailable}</span>
            </button>
            <button
              type="button"
              className={sourceFilter === "built-in" ? "active" : ""}
              aria-pressed={sourceFilter === "built-in"}
              onClick={() => selectSource("built-in")}
            >
              Built in <span aria-hidden="true">{premadeAdventures.length}</span>
            </button>
            <button
              type="button"
              className={sourceFilter === "community" ? "active" : ""}
              aria-pressed={sourceFilter === "community"}
              onClick={() => selectSource("community")}
            >
              Community <span aria-hidden="true">{scenarios.length}</span>
            </button>
          </div>
        </fieldset>

        {builtInTags.length > 0 && (
          <label className="field explore-tag-filter">
            <span>Built-in tag</span>
            <select value={tagFilter} disabled={sourceFilter === "community"} onChange={(event) => selectTag(event.target.value)}>
              <option value="all">All tags</option>
              {builtInTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      {backendMode && !backendSession && (
        <p className="notice">Built-in Scenarios are ready to play. Sign in from Settings to browse Community Scenarios.</p>
      )}
      {status && <p className="notice" role="status" aria-live="polite">{status}</p>}

      {(selectedPremade || selectedCommunityScenario) && (
        <section
          id="explore-scenario-preview"
          className="explore-detail"
          aria-labelledby="explore-detail-title"
          aria-busy={startingKey === selectedKey}
        >
          <AdventureThumbnailFrame
            thumbnail={selectedPremade ? premadeThumbnails.get(selectedPremade.id) : selectedCommunityScenario?.thumbnailImage}
            title={selectedPremade?.title ?? selectedCommunityScenario?.title ?? "Scenario"}
            className="explore-detail-cover"
          />
          <div className="explore-detail-body">
            <header className="explore-detail-header">
              <div>
                <p className="eyebrow">{selectedPremade ? "Built-in Scenario" : "Community Scenario"}</p>
                <h3 id="explore-detail-title" ref={detailHeadingRef} tabIndex={-1}>
                  {selectedPremade?.title ?? selectedCommunityScenario?.title}
                </h3>
              </div>
              <button type="button" className="secondary-action" onClick={closeDetails}>
                Close preview
              </button>
            </header>

            <p className="explore-detail-description">
              {selectedPremade?.summary || selectedCommunityScenario?.description || "The creator has not added a premise yet."}
            </p>

            {selectedPremade && (
              <>
                <p className="muted">{selectedPremade.eyebrow}</p>
                <div className="explore-tag-list" aria-label="Scenario tags">
                  {selectedPremade.tags.map((tag) => <span key={tag} className="status-pill">{tag}</span>)}
                </div>
              </>
            )}

            {selectedCommunityScenario && (
              <div className="explore-detail-meta">
                <span>
                  By{" "}
                  <button
                    type="button"
                    className="profile-link-button"
                    aria-label={`Open ${selectedCommunityScenario.ownerDisplayName} profile`}
                    disabled={!onOpenProfile}
                    onClick={() => void onOpenProfile?.(selectedCommunityScenario.ownerUserId)}
                  >
                    {selectedCommunityScenario.ownerDisplayName}
                  </button>
                </span>
                <span>Version {selectedCommunityScenario.version}</span>
                <span>Published {formatDate(selectedCommunityScenario.publishedAt)}</span>
              </div>
            )}

            <div className="explore-private-story-copy">
              <strong>This creates a private Story for you.</strong>
              <span>Your turns and edits belong to that Story. The reusable Scenario stays unchanged.</span>
            </div>

            <details className="explore-start-details">
              <summary>Before you start</summary>
              <p className="muted">{scenarioStartWarning}</p>
            </details>

            <div className="library-card-actions explore-detail-actions">
              <button
                type="button"
                className="primary-action"
                disabled={!canStartSelected || Boolean(startingKey)}
                onClick={() => void startSelectedStory()}
              >
                {startingKey === selectedKey ? "Starting Story…" : "Start Story"}
              </button>
            </div>
          </div>
        </section>
      )}

      {visiblePremades.length > 0 && (
        <section className="explore-section" aria-labelledby="built-in-scenarios-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Built in</p>
              <h3 id="built-in-scenarios-heading">Built-in Scenarios</h3>
            </div>
          </div>
          <div className="library-grid explore-grid">
            {visiblePremades.map((premade) => {
              const isSelected = selectedPremade?.id === premade.id;
              return (
                <article key={premade.id} className={`library-card explore-card${isSelected ? " selected" : ""}`}>
                  <AdventureThumbnailFrame
                    thumbnail={premadeThumbnails.get(premade.id)}
                    title={premade.title}
                    className="library-card-cover explore-card-cover"
                  />
                  <div className="library-card-body">
                    <div>
                      <p className="eyebrow">{premade.eyebrow}</p>
                      <h3>{premade.title}</h3>
                      <p className="muted">{premade.summary}</p>
                      <div className="explore-tag-list" aria-label={`${premade.title} tags`}>
                        {premade.tags.map((tag) => <span key={tag} className="status-pill">{tag}</span>)}
                      </div>
                    </div>
                    <div className="library-card-actions">
                      <button
                        type="button"
                        aria-label={`${isSelected ? "Close details" : "View details"} for ${premade.title}`}
                        aria-expanded={isSelected}
                        aria-controls="explore-scenario-preview"
                        onClick={(event) => {
                          if (isSelected) closeDetails();
                          else showDetails({ kind: "built-in", id: premade.id }, event.currentTarget);
                        }}
                      >
                        {isSelected ? "Close details" : "View details"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {canUseBackendScenarios && visibleCommunityScenarios.length > 0 && (
        <section className="explore-section" aria-labelledby="community-scenarios-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Community</p>
              <h3 id="community-scenarios-heading">Community Scenarios</h3>
            </div>
          </div>
          <div className="library-grid explore-grid">
            {visibleCommunityScenarios.map((scenario) => {
              const isSelected = selectedCommunityScenario?.revisionId === scenario.revisionId;
              return (
                <article key={scenario.revisionId} className={`library-card explore-card${isSelected ? " selected" : ""}`}>
                  <AdventureThumbnailFrame
                    thumbnail={scenario.thumbnailImage}
                    title={scenario.title}
                    className="library-card-cover explore-card-cover"
                  />
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
                      <p className="muted">{scenario.description || "The creator has not added a premise yet."}</p>
                      <div className="editor-stat-row explore-card-meta">
                        <span>Version {scenario.version}</span>
                        <span>Published {formatDate(scenario.publishedAt)}</span>
                      </div>
                    </div>
                    <div className="library-card-actions">
                      <button
                        type="button"
                        aria-label={`${isSelected ? "Close details" : "View details"} for ${scenario.title}`}
                        aria-expanded={isSelected}
                        aria-controls="explore-scenario-preview"
                        onClick={(event) => {
                          if (isSelected) closeDetails();
                          else showDetails({ kind: "community", revisionId: scenario.revisionId }, event.currentTarget);
                        }}
                      >
                        {isSelected ? "Close details" : "View details"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {resultCount === 0 && totalAvailable > 0 && (
        <div className="empty-state explore-empty-state">
          <h3>No matching Scenarios</h3>
          <p className="muted">Try a different search, source, or built-in tag.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSourceFilter("all");
              setTagFilter("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {canUseBackendScenarios && scenarios.length === 0 && sourceFilter !== "built-in" && !normalizedQuery && (
        <p className="muted">No Community Scenarios have been published yet.</p>
      )}
      {!canUseBackendScenarios && premadeAdventures.length === 0 && (
        <p className="muted">No built-in Scenarios are available on this device.</p>
      )}
    </section>
  );
}
