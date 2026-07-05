import { useMemo, useState } from "react";
import { AdventureThumbnailFrame } from "../components/AdventureThumbnail";
import { buildContext } from "../contextBuilder/contextBuilder";
import type { AdventureSummary } from "../db/adventureDb";
import type { AdventureSyncConflictResolution } from "../runtime/adventureStore";
import { getAdventureThumbnail } from "../utils/adventureImages";
import { describeSyncConflictVersions } from "../utils/syncConflict";
import type { PlayRuntimeProps } from "./pageTypes";

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
            <p className="eyebrow">Current Adventure</p>
            <h2>{adventure.title}</h2>
            <p className="muted">
              Turn {adventure.activeState.turn} · {saveStatus}
            </p>
            {showSyncConflictActions && (
              <p className="muted sync-conflict-help">
                {syncConflictVersionText ? `${syncConflictVersionText} ` : ""}Choose which save should win: this device or the server.
              </p>
            )}
          </div>
          <div className="adventure-hero-actions">
            <button type="button" className="primary-action" onClick={() => onOpenTab?.("play")}>
              Continue
            </button>
            {onPullLatest && (
              <button type="button" disabled={pulling} onClick={handlePull}>
                {pulling ? "Updating…" : "Update"}
              </button>
            )}
            <button type="button" onClick={() => onOpenTab?.("edit")}>
              Edit
            </button>
            {showSyncConflictActions && (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={Boolean(resolvingConflict)}
                  onClick={() => void handleResolveSyncConflict("uploadLocal")}
                >
                  {resolvingConflict === "uploadLocal" ? "Uploading..." : "Upload Local Save"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(resolvingConflict)}
                  onClick={() => void handleResolveSyncConflict("downloadServer")}
                >
                  {resolvingConflict === "downloadServer" ? "Downloading..." : "Download Server Save"}
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
              Inspect
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
            <span>Story Cards</span>
            <strong>{activeCards.length}</strong>
          </div>
          <div className="adventure-stat">
            <span>Characters</span>
            <strong>{activeCharacters.length}</strong>
          </div>
          <div className="adventure-stat">
            <span>Context</span>
            <strong>{computedContext.totalEstimatedTokens} tokens</strong>
          </div>
          <div className="adventure-stat">
            <span>Memory</span>
            <strong>{pendingProposals.length} pending</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
