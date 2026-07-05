import type { AdventureSummary } from "../db/adventureDb";

function timestampValue(iso?: string): number | undefined {
  if (!iso) return undefined;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : undefined;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return "unknown";
  const value = timestampValue(iso);
  return value === undefined ? "unknown" : new Date(value).toLocaleString();
}

export function describeSyncConflictVersions(summary?: Pick<AdventureSummary, "updatedAt" | "localBackupUpdatedAt" | "lastServerUpdatedAt">): string | undefined {
  if (!summary) return undefined;
  const localUpdatedAt = summary.localBackupUpdatedAt ?? summary.updatedAt;
  const serverUpdatedAt = summary.lastServerUpdatedAt;
  const localValue = timestampValue(localUpdatedAt);
  const serverValue = timestampValue(serverUpdatedAt);
  if (localValue === undefined && serverValue === undefined) return undefined;

  const localLabel = `local ${formatTimestamp(localUpdatedAt)}`;
  const serverLabel = `server ${formatTimestamp(serverUpdatedAt)}`;

  if (serverValue === undefined) {
    return `Local save timestamp available; server timestamp is unknown (${localLabel}).`;
  }
  if (localValue === undefined) {
    return `Server save timestamp available; local timestamp is unknown (${serverLabel}).`;
  }
  if (localValue > serverValue) {
    return `Local save is ahead (${localLabel}; ${serverLabel}).`;
  }
  if (serverValue > localValue) {
    return `Server save is ahead (${serverLabel}; ${localLabel}).`;
  }
  return `Local and server saves have the same timestamp (${localLabel}).`;
}
