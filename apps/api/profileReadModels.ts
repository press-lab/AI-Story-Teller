import type { AdventureThumbnailImage } from "../../src/types/adventure";
import type { BackendUser, LocalDbData, ScenarioDraft, ScenarioRevision, UserProfile } from "./apiTypes";
import { summarizeAdventure } from "./adventureStore";

type BackendAdventureSummary = ReturnType<typeof summarizeAdventure>;

export interface ProfileScenarioSummary {
  id: string;
  title: string;
  description: string;
  sourceAdventureId?: string;
  createdAt: string;
  updatedAt: string;
  thumbnailImage?: AdventureThumbnailImage;
  revisionCount: number;
  publishedRevisionCount: number;
  latestRevision?: {
    id: string;
    version: number;
    status: ScenarioRevision["status"];
    createdAt: string;
    publishedAt?: string;
  };
}

export interface BackendProfileSummary {
  user: BackendUser;
  profile: UserProfile;
  adventures: BackendAdventureSummary[];
  scenarios: ProfileScenarioSummary[];
}

export interface PublicProfileSummary {
  user: {
    id: string;
    displayName: string;
    createdAt: string;
  };
  profile: UserProfile;
  scenarios: ExploreScenarioSummary[];
}

export interface ExploreScenarioSummary {
  scenarioId: string;
  revisionId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  title: string;
  description: string;
  version: number;
  createdAt: string;
  publishedAt: string;
  thumbnailImage?: AdventureThumbnailImage;
}

export function buildProfileSummary(data: LocalDbData, userId: string): BackendProfileSummary {
  const user = data.users.find((entry) => entry.id === userId);
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!user || !profile) throw new Error("Profile not found.");

  return {
    user,
    profile,
    adventures: data.adventures
      .filter((entry) => entry.ownerUserId === userId)
      .map((entry) => summarizeAdventure(entry.adventure))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    scenarios: data.scenarioDrafts
      .filter((entry) => entry.ownerUserId === userId)
      .map((draft) => summarizeScenarioDraft(data, draft))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export function buildPublicProfileSummary(data: LocalDbData, userId: string): PublicProfileSummary {
  const user = data.users.find((entry) => entry.id === userId);
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!user || !profile) throw new Error("Profile not found.");

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    profile,
    scenarios: listExploreScenarios(data).filter((scenario) => scenario.ownerUserId === userId),
  };
}

export function listExploreScenarios(data: LocalDbData): ExploreScenarioSummary[] {
  return data.scenarioRevisions
    .filter((revision) => revision.status === "published" && revision.publishedAt)
    .map((revision) => {
      const profile = data.profiles.find((entry) => entry.userId === revision.ownerUserId);
      return {
        scenarioId: revision.scenarioId,
        revisionId: revision.id,
        ownerUserId: revision.ownerUserId,
        ownerDisplayName: profile?.displayName || "Unknown creator",
        title: revision.title,
        description: revision.description,
        version: revision.version,
        createdAt: revision.createdAt,
        publishedAt: revision.publishedAt!,
        thumbnailImage: scenarioThumbnail(revision),
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function summarizeScenarioDraft(data: LocalDbData, draft: ScenarioDraft): ProfileScenarioSummary {
  const revisions = data.scenarioRevisions
    .filter((entry) => entry.scenarioId === draft.id && entry.ownerUserId === draft.ownerUserId)
    .sort((a, b) => b.version - a.version);
  const latestRevision = revisions[0];
  const sourceAdventure = draft.sourceAdventureId
    ? data.adventures.find((entry) => entry.id === draft.sourceAdventureId && entry.ownerUserId === draft.ownerUserId)
    : undefined;
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    sourceAdventureId: draft.sourceAdventureId,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    thumbnailImage:
      (latestRevision ? scenarioThumbnail(latestRevision) : undefined)
      ?? (sourceAdventure ? summarizeAdventure(sourceAdventure.adventure).thumbnailImage : undefined),
    revisionCount: revisions.length,
    publishedRevisionCount: revisions.filter((revision) => revision.status === "published").length,
    latestRevision: latestRevision
      ? {
          id: latestRevision.id,
          version: latestRevision.version,
          status: latestRevision.status,
          createdAt: latestRevision.createdAt,
          publishedAt: latestRevision.publishedAt,
        }
      : undefined,
  };
}

function scenarioThumbnail(revision: ScenarioRevision): AdventureThumbnailImage | undefined {
  if (!isRecord(revision.content)) return undefined;
  const direct = revision.content.thumbnailImage;
  const metadataThumbnail = isRecord(revision.content.metadata) ? revision.content.metadata.thumbnailImage : undefined;
  return toThumbnailImage(direct) ?? toThumbnailImage(metadataThumbnail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toThumbnailImage(value: unknown): AdventureThumbnailImage | undefined {
  if (!isRecord(value)) return undefined;
  const dataUrl = value.dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return undefined;
  return {
    dataUrl,
    name: typeof value.name === "string" ? value.name : undefined,
    altText: typeof value.altText === "string" ? value.altText : undefined,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}
