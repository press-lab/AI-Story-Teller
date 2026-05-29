import { normalizeAdventure } from "../state/defaults";
import type { Adventure, CloudSyncSettings, GitHubSaveSettings, GitHubSaveSlot, ISODateString } from "../types/adventure";
import { decodeBase64Utf8, encodeBase64Utf8, ensureRepo, githubRequest, resolveOwner } from "./githubSync";

export const defaultGitHubSaveSettings: GitHubSaveSettings = {
  autoSaveEnabled: false,
  autoSaveEveryNTurns: 5,
  savesBasePath: "sync/saves",
};

interface GitHubSaveFile {
  app: "ai-story-teller";
  version: 1;
  savedAt: ISODateString;
  saveType: "manual" | "auto";
  adventure: Adventure;
}

interface GitHubSaveIndex {
  app: "ai-story-teller";
  version: 1;
  updatedAt: ISODateString;
  slots: GitHubSaveSlot[];
}

interface GitHubContentResponse {
  sha: string;
  content: string;
}

function assertSettings(settings: CloudSyncSettings): void {
  if (!settings.token.trim()) throw new Error("GitHub save slots require a GitHub token.");
  if (!settings.repo.trim()) throw new Error("GitHub save slots require a repository name.");
  if (!settings.branch.trim()) throw new Error("GitHub save slots require a branch name.");
}

function sanitizeSave(adventure: Adventure): Adventure {
  const { apiKey: _apiKey, ...modelConfig } = adventure.modelConfig;
  return normalizeAdventure({ ...adventure, modelConfig });
}

function repoBase(cloudSettings: CloudSyncSettings, owner: string): string {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(cloudSettings.repo.trim())}/contents`;
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function indexFilePath(cloudSettings: CloudSyncSettings, saveSettings: GitHubSaveSettings, owner: string): string {
  return `${repoBase(cloudSettings, owner)}/${encodePath(saveSettings.savesBasePath)}/index.json`;
}

function saveFilePath(
  cloudSettings: CloudSyncSettings,
  saveSettings: GitHubSaveSettings,
  owner: string,
  adventureId: string,
  saveId: string,
): string {
  return `${repoBase(cloudSettings, owner)}/${encodePath(saveSettings.savesBasePath)}/${encodeURIComponent(adventureId)}/${encodeURIComponent(saveId)}.json`;
}

async function fetchIndex(
  cloudSettings: CloudSyncSettings,
  saveSettings: GitHubSaveSettings,
  owner: string,
): Promise<{ index: GitHubSaveIndex; sha?: string }> {
  const path = `${indexFilePath(cloudSettings, saveSettings, owner)}?ref=${encodeURIComponent(cloudSettings.branch.trim())}`;
  try {
    const remote = await githubRequest<GitHubContentResponse>(cloudSettings, path);
    const parsed = JSON.parse(decodeBase64Utf8(remote.content)) as GitHubSaveIndex;
    if (parsed.app !== "ai-story-teller") throw new Error("Not a valid AI Story Teller save index.");
    return { index: parsed, sha: remote.sha };
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) {
      return { index: { app: "ai-story-teller", version: 1, updatedAt: new Date().toISOString(), slots: [] } };
    }
    throw error;
  }
}

async function writeIndex(
  cloudSettings: CloudSyncSettings,
  saveSettings: GitHubSaveSettings,
  owner: string,
  index: GitHubSaveIndex,
  sha?: string,
): Promise<void> {
  await githubRequest(cloudSettings, indexFilePath(cloudSettings, saveSettings, owner), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Update AI Story Teller save index (${index.slots.length} saves)`,
      branch: cloudSettings.branch.trim(),
      content: encodeBase64Utf8(JSON.stringify(index, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });
}

export function shouldAutoSave(
  adventure: Adventure,
  saveSettings: GitHubSaveSettings,
  lastAutoSavedTurn: number,
): boolean {
  if (!saveSettings.autoSaveEnabled) return false;
  if (saveSettings.autoSaveEveryNTurns <= 0) return false;
  const currentTurn = adventure.activeState.turn;
  return currentTurn > lastAutoSavedTurn && currentTurn - lastAutoSavedTurn >= saveSettings.autoSaveEveryNTurns;
}

export async function listGitHubSaves(
  cloudSettings: CloudSyncSettings,
  saveSettings: GitHubSaveSettings,
): Promise<GitHubSaveSlot[]> {
  assertSettings(cloudSettings);
  const owner = await resolveOwner(cloudSettings);
  await ensureRepo(cloudSettings, owner);
  const { index } = await fetchIndex(cloudSettings, saveSettings, owner);
  return [...index.slots].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveToGitHub(
  cloudSettings: CloudSyncSettings,
  saveSettings: GitHubSaveSettings,
  adventure: Adventure,
  saveType: "manual" | "auto",
): Promise<GitHubSaveSlot> {
  assertSettings(cloudSettings);
  const owner = await resolveOwner(cloudSettings);
  await ensureRepo(cloudSettings, owner);

  const savedAt = new Date().toISOString();
  const saveId = `${savedAt.replace(/[:.]/g, "-")}-${saveType}`;
  const sanitized = sanitizeSave(adventure);
  const saveFile: GitHubSaveFile = { app: "ai-story-teller", version: 1, savedAt, saveType, adventure: sanitized };

  await githubRequest(cloudSettings, saveFilePath(cloudSettings, saveSettings, owner, adventure.id, saveId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Save "${adventure.title}" (${saveType}, turn ${adventure.activeState.turn})`,
      branch: cloudSettings.branch.trim(),
      content: encodeBase64Utf8(JSON.stringify(saveFile, null, 2)),
    }),
  });

  const slot: GitHubSaveSlot = {
    saveId,
    adventureId: adventure.id,
    title: adventure.title,
    savedAt,
    turnCount: adventure.activeState.turn,
    saveType,
  };

  const { index, sha } = await fetchIndex(cloudSettings, saveSettings, owner);
  const updatedIndex: GitHubSaveIndex = {
    ...index,
    updatedAt: savedAt,
    slots: [slot, ...index.slots.filter((s) => s.saveId !== slot.saveId)],
  };
  await writeIndex(cloudSettings, saveSettings, owner, updatedIndex, sha);

  return slot;
}

export async function loadGitHubSave(
  cloudSettings: CloudSyncSettings,
  saveSettings: GitHubSaveSettings,
  slot: GitHubSaveSlot,
): Promise<Adventure> {
  assertSettings(cloudSettings);
  const owner = await resolveOwner(cloudSettings);
  const path = `${saveFilePath(cloudSettings, saveSettings, owner, slot.adventureId, slot.saveId)}?ref=${encodeURIComponent(cloudSettings.branch.trim())}`;
  const remote = await githubRequest<GitHubContentResponse>(cloudSettings, path);
  const parsed = JSON.parse(decodeBase64Utf8(remote.content)) as GitHubSaveFile;
  if (parsed.app !== "ai-story-teller" || !parsed.adventure) {
    throw new Error("Not a valid AI Story Teller save file.");
  }
  return normalizeAdventure(parsed.adventure);
}
