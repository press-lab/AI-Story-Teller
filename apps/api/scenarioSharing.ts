import type { Adventure } from "../../src/types/adventure";
import { createDefaultAdventure, normalizeAdventure } from "../../src/state/defaults";
import { normalizeAdventureThumbnail } from "../../src/utils/adventureImages";
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
  const revisionTitle = input.title?.trim() || scenario.title;
  const revisionDescription = input.description !== undefined ? input.description.trim() : scenario.description;
  const version = data.scenarioRevisions.filter((entry) => entry.scenarioId === scenarioId).length + 1;
  const revision: ScenarioRevision = {
    id: createId("scenario_rev"),
    scenarioId,
    ownerUserId: userId,
    version,
    title: revisionTitle,
    description: revisionDescription,
    content: input.content,
    status: "draft",
    createdAt: nowIso(),
  };
  data.scenarioRevisions.push(revision);
  scenario.title = revisionTitle;
  scenario.description = revisionDescription;
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

export function unpublishScenarioRevision(
  data: LocalDbData,
  userId: string,
  revisionId: string,
): { revision: ScenarioRevision; disabledShareLinkCount: number } {
  const revision = data.scenarioRevisions.find((entry) => entry.id === revisionId && entry.ownerUserId === userId);
  if (!revision) throw new Error("Scenario revision not found.");
  if (revision.status !== "published") throw new Error("Scenario revision is not published.");

  revision.status = "draft";
  delete revision.publishedAt;
  let disabledShareLinkCount = 0;
  const now = nowIso();
  for (const link of data.shareLinks) {
    if (link.ownerUserId === userId && link.targetType === "scenarioRevision" && link.targetId === revisionId && !link.disabledAt) {
      link.disabledAt = now;
      disabledShareLinkCount += 1;
    }
  }
  const scenario = data.scenarioDrafts.find((entry) => entry.id === revision.scenarioId && entry.ownerUserId === userId);
  if (scenario) scenario.updatedAt = now;
  return { revision, disabledShareLinkCount };
}

export function deleteScenarioDraft(
  data: LocalDbData,
  userId: string,
  scenarioId: string,
): { scenarioId: string; deletedRevisionCount: number; deletedShareLinkCount: number } {
  const draftIndex = data.scenarioDrafts.findIndex((entry) => entry.id === scenarioId && entry.ownerUserId === userId);
  if (draftIndex < 0) throw new Error("Scenario draft not found.");

  const revisionIds = new Set(
    data.scenarioRevisions
      .filter((entry) => entry.scenarioId === scenarioId && entry.ownerUserId === userId)
      .map((entry) => entry.id),
  );
  data.scenarioDrafts.splice(draftIndex, 1);
  data.scenarioRevisions = data.scenarioRevisions.filter(
    (entry) => !(entry.scenarioId === scenarioId && entry.ownerUserId === userId),
  );

  const shareLinkCountBefore = data.shareLinks.length;
  data.shareLinks = data.shareLinks.filter(
    (link) => !(link.ownerUserId === userId && link.targetType === "scenarioRevision" && revisionIds.has(link.targetId)),
  );

  return {
    scenarioId,
    deletedRevisionCount: revisionIds.size,
    deletedShareLinkCount: shareLinkCountBefore - data.shareLinks.length,
  };
}

export function createAdventureFromScenarioRevision(
  data: LocalDbData,
  userId: string,
  revisionId: string,
): Adventure {
  const revision = data.scenarioRevisions.find((entry) => entry.id === revisionId);
  if (!revision || (revision.status !== "published" && revision.ownerUserId !== userId)) {
    throw new Error("Published scenario revision not found.");
  }

  const content = asScenarioContent(revision.content);
  const base = createDefaultAdventure(revision.title);
  const openingScene = typeof content.openingScene === "string" ? content.openingScene : base.openingScene;
  const metadata = isRecord(content.metadata) ? { ...content.metadata } : {};
  const thumbnailImage =
    normalizeAdventureThumbnail(content.thumbnailImage)
    ?? (isRecord(content.metadata) ? normalizeAdventureThumbnail(content.metadata.thumbnailImage) : undefined);
  if (thumbnailImage) metadata.thumbnailImage = thumbnailImage;
  Object.assign(metadata, {
    sourceScenarioId: revision.scenarioId,
    sourceScenarioRevisionId: revision.id,
    sourceScenarioOwnerUserId: revision.ownerUserId,
    sourceScenarioVersion: revision.version,
    sourceScenarioTitle: revision.title,
    startedFromExplore: revision.status === "published",
    startedFromProfileScenario: revision.ownerUserId === userId,
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
