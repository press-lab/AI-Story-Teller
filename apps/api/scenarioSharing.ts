import type { Adventure } from "../../src/types/adventure";
import { createDefaultAdventure, normalizeAdventure } from "../../src/state/defaults";
import type { LocalDbData, ScenarioDraft, ScenarioRevision, ShareLink } from "./apiTypes";
import type { ApiConfig } from "./config";
import { assertCanShare } from "./accountSafety";
import { assertPolicyAllowed, recordPolicyDecision } from "./policy";
import { createId, hashToken, nowIso, randomToken } from "./ids";

export function createScenarioDraft(
  data: LocalDbData,
  userId: string,
  input: { title: string; description?: string; sourceAdventureId?: string },
  config: ApiConfig,
): ScenarioDraft {
  assertCanShare(data, userId);
  const policyText = `${input.title}\n\n${input.description ?? ""}`;
  const decision = recordPolicyDecision(data, {
    gate: "share",
    text: policyText,
    userId,
    subjectType: "scenarioDraft",
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(decision);
  const now = nowIso();
  const draft: ScenarioDraft = {
    id: createId("scenario"),
    ownerUserId: userId,
    title: input.title.trim() || "Untitled Scenario",
    description: input.description?.trim() ?? "",
    sourceAdventureId: input.sourceAdventureId,
    createdAt: now,
    updatedAt: now,
  };
  data.scenarioDrafts.push(draft);
  return draft;
}

export function createScenarioRevision(
  data: LocalDbData,
  userId: string,
  scenarioId: string,
  input: { title?: string; description?: string; content: unknown },
  config: ApiConfig,
): ScenarioRevision {
  assertCanShare(data, userId);
  const scenario = data.scenarioDrafts.find((entry) => entry.id === scenarioId && entry.ownerUserId === userId);
  if (!scenario) throw new Error("Scenario draft not found.");
  const policyText = `${input.title ?? scenario.title}\n\n${input.description ?? scenario.description}\n\n${JSON.stringify(input.content)}`;
  const decision = recordPolicyDecision(data, {
    gate: "share",
    text: policyText,
    userId,
    subjectType: "scenarioRevision",
    subjectId: scenarioId,
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(decision);
  const version = data.scenarioRevisions.filter((entry) => entry.scenarioId === scenarioId).length + 1;
  const revision: ScenarioRevision = {
    id: createId("scenario_rev"),
    scenarioId,
    ownerUserId: userId,
    version,
    title: input.title?.trim() || scenario.title,
    description: input.description?.trim() ?? scenario.description,
    content: input.content,
    status: "draft",
    createdAt: nowIso(),
  };
  data.scenarioRevisions.push(revision);
  scenario.updatedAt = nowIso();
  return revision;
}

export function publishScenarioRevision(
  data: LocalDbData,
  userId: string,
  revisionId: string,
  config: ApiConfig,
): { revision: ScenarioRevision; shareLink: ShareLink; token: string } {
  assertCanShare(data, userId);
  const revision = data.scenarioRevisions.find((entry) => entry.id === revisionId && entry.ownerUserId === userId);
  if (!revision) throw new Error("Scenario revision not found.");
  const decision = recordPolicyDecision(data, {
    gate: "share",
    text: `${revision.title}\n\n${revision.description}\n\n${JSON.stringify(revision.content)}`,
    userId,
    subjectType: "scenarioRevision",
    subjectId: revisionId,
    policyMode: config.policyMode,
  });
  assertPolicyAllowed(decision);
  revision.status = "published";
  revision.publishedAt = nowIso();
  const token = randomToken(24);
  const shareLink: ShareLink = {
    id: createId("share"),
    ownerUserId: userId,
    targetType: "scenarioRevision",
    targetId: revision.id,
    tokenHash: hashToken(token),
    createdAt: nowIso(),
  };
  data.shareLinks.push(shareLink);
  return { revision, shareLink, token };
}

export function createAdventureFromScenarioRevision(
  data: LocalDbData,
  userId: string,
  revisionId: string,
): Adventure {
  const revision = data.scenarioRevisions.find((entry) => entry.id === revisionId && entry.status === "published");
  if (!revision) throw new Error("Published scenario revision not found.");

  const content = asScenarioContent(revision.content);
  const base = createDefaultAdventure(revision.title);
  const openingScene = typeof content.openingScene === "string" ? content.openingScene : base.openingScene;
  const metadata = isRecord(content.metadata) ? { ...content.metadata } : {};
  const thumbnailImage = isRecord(content.thumbnailImage) ? content.thumbnailImage : undefined;
  if (thumbnailImage) metadata.thumbnailImage = thumbnailImage;
  Object.assign(metadata, {
    sourceScenarioId: revision.scenarioId,
    sourceScenarioRevisionId: revision.id,
    sourceScenarioOwnerUserId: revision.ownerUserId,
    sourceScenarioVersion: revision.version,
    sourceScenarioTitle: revision.title,
    startedFromExplore: true,
    userVariablesSupported: false,
    playerEditsRecommended: true,
    startedByUserId: userId,
  });

  return normalizeAdventure({
    ...base,
    title: revision.title,
    openingScene,
    metadata,
    components: Array.isArray(content.components) ? content.components as Adventure["components"] : base.components,
    storyCards: Array.isArray(content.storyCards) ? content.storyCards as Adventure["storyCards"] : base.storyCards,
    brains: Array.isArray(content.brains) ? content.brains as Adventure["brains"] : base.brains,
    triggerRules: Array.isArray(content.triggerRules) ? content.triggerRules as Adventure["triggerRules"] : base.triggerRules,
  });
}

function asScenarioContent(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
