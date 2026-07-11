import { useMemo, useState } from "react";
import { AdventureThumbnailFrame } from "../components/AdventureThumbnail";
import { buildContext } from "../contextBuilder/contextBuilder";
import type { AdventureSummary } from "../db/adventureDb";
import type { AdventureSyncConflictResolution } from "../runtime/adventureStore";
import { getAdventureThumbnail } from "../utils/adventureImages";
import { describeSyncConflictVersions } from "../utils/syncConflict";
import type { PlayRuntimeProps } from "./pageTypes";
import { classifyContextHealth } from "../ui/contextHealth";

function scenePreview(adventure: PlayRuntimeProps["adventure"]): string {
  const latestAssistant = [...adventure.messages].reverse().find((message) => message.role === "assistant");
  return latestAssistant?.content || adventure.openingScene || "No scene text yet.";
}

function previewText(text: string, maxLength = 900): string {
  const normalized = text.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

interface DashboardPageProps extends PlayRuntimeProps {
  hasSyncConflict?: boolean;
  syncConflictSummary?: AdventureSummary;
  onResolveSyncConflict?: (resolution: AdventureSyncConflictResolution) => Promise<void>;
}

export function DashboardPage({
  adventure,
  dispatch,
  contextResult,
  saveStatus,
  onBuildContext,
  onOpenContext,
  onOpenTab,
  onPullLatest,
  hasSyncConflict,
  syncConflictSummary,
  onResolveSyncConflict,
}: DashboardPageProps) {
  const [pulling, setPulling] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState<AdventureSyncConflictResolution | undefined>();

  async function handlePull() {
    if (!onPullLatest) return;
    setPulling(true);
    try { await onPullLatest(); } finally { setPulling(false); }
  }

  async function handleResolveSyncConflict(resolution: AdventureSyncConflictResolution) {
    if (!onResolveSyncConflict) return;
    setResolvingConflict(resolution);
    try { await onResolveSyncConflict(resolution); } finally { setResolvingConflict(undefined); }
  }

  const computedContext = useMemo(() => contextResult ?? buildContext(adventure), [adventure, contextResult]);
  const contextHealth = classifyContextHealth(computedContext, adventure.tokenBudgetSettings.maxContextTokens);
  const pendingProposals = adventure.activeState.memoryProposals.filter((proposal) => proposal.status === "pending");
  const activeCards = adventure.storyCards.filter((card) => card.active);
  const activeCharacters = adventure.brains.filter((brain) => brain.active);
  const thumbnail = getAdventureThumbnail(adventure);
  const showSyncConflictActions = Boolean(hasSyncConflict && onResolveSyncConflict);
  const syncConflictVersionText = describeSyncConflictVersions(syncConflictSummary);

  return (
    <section className="page adventure-detail-page">
      <article className="adventure-hero-card">
        <AdventureThumbnailFrame thumbnail={thumbnail} title={adventure.title} className="adventure-cover" />
        <div className="adventure-hero-body">
          <div>
            <p className="eyebrow">Current Story</p>
            <h2>{adventure.title}</h2>
            <p className="muted">
              Turn {adventure.activeState.turn} · {saveStatus === "saved" ? "Saved" : saveStatus}
            </p>
            {showSyncConflictActions && (
              <div className="sync-conflict-help" role="alert">
                <strong>Two versions of this Story changed.</strong>
                <span>{syncConflictVersionText ? `${syncConflictVersionText} ` : ""}Both versions are preserved until you choose which one to continue with.</span>
              </div>
            )}
          </div>
          <div className="adventure-hero-actions">
            <button type="button" className="primary-action" onClick={() => onOpenTab?.("play")}>
              Continue Story
            </button>
            {onPullLatest && (
              <button type="button" disabled={pulling} onClick={handlePull}>
                {pulling ? "Updating…" : "Update"}
              </button>
            )}
            <button type="button" onClick={() => onOpenTab?.("edit")}>
              Open Story Studio
            </button>
            {showSyncConflictActions && (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={Boolean(resolvingConflict)}
                  onClick={() => void handleResolveSyncConflict("uploadLocal")}
                >
                  {resolvingConflict === "uploadLocal" ? "Saving..." : "Keep this device's version"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(resolvingConflict)}
                  onClick={() => void handleResolveSyncConflict("downloadServer")}
                >
                  {resolvingConflict === "downloadServer" ? "Loading..." : "Use the server version"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                onBuildContext();
                onOpenContext();
              }}
            >
              Context details
            </button>
          </div>
        </div>
      </article>

      <div className="adventure-detail-grid">
        <article className="adventure-prose-panel">
          <p className="eyebrow">Latest Scene</p>
          <p>{previewText(scenePreview(adventure))}</p>
        </article>

        <aside className="adventure-stats-panel">
          <div className="adventure-stat">
            <span>World &amp; Lore</span>
            <strong>{activeCards.length} active</strong>
          </div>
          <div className="adventure-stat">
            <span>Characters</span>
            <strong>{activeCharacters.length} active</strong>
          </div>
          <div className="adventure-stat">
            <span>Story context</span>
            <strong className={`context-health context-health-${contextHealth.status}`}>{contextHealth.label}</strong>
          </div>
          <div className="adventure-stat">
            <span>Suggestions</span>
            <strong>{pendingProposals.length ? `${pendingProposals.length} to review` : "All caught up"}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
