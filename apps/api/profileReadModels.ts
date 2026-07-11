import type { AdventureThumbnailImage } from "../../src/types/adventure";
import { normalizeAdventureThumbnail } from "../../src/utils/adventureImages";
import type { BackendUser, LocalDbData, ProfileSocialVisibility, ScenarioDraft, ScenarioRevision, UserProfile } from "./apiTypes";
import { summarizeAdventure } from "./adventureStore";
import { findFriendship, profileSocialVisibility, scenarioLikeCount } from "./socialGraph";

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
  social: OwnProfileSocialSummary;
}

export interface SocialProfilePerson {
  userId: string;
  displayName: string;
}

export interface OwnProfileSocialSummary {
  visibility: ProfileSocialVisibility;
  followers: SocialProfilePerson[];
  following: SocialProfilePerson[];
  friends: SocialProfilePerson[];
  incomingFriendRequests: SocialProfilePerson[];
  outgoingFriendRequests: SocialProfilePerson[];
}

export type ViewerFriendshipStatus = "self" | "none" | "outgoing_pending" | "incoming_pending" | "friends";

export interface PublicProfileSocialSummary {
  visibility: ProfileSocialVisibility;
  followers?: SocialProfilePerson[];
  following?: SocialProfilePerson[];
  friends?: SocialProfilePerson[];
  viewer: {
    isFollowing: boolean;
    isFollowedBy: boolean;
    friendshipStatus: ViewerFriendshipStatus;
  };
}

export interface PublicProfileSummary {
  user: {
    id: string;
    displayName: string;
    createdAt: string;
  };
  profile: UserProfile;
  scenarios: ExploreScenarioSummary[];
  social: PublicProfileSocialSummary;
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
  likeCount: number;
  likedByViewer: boolean;
}

export function buildProfileSummary(data: LocalDbData, userId: string): BackendProfileSummary {
  const user = data.users.find((entry) => entry.id === userId);
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!user || !profile) throw new Error("Profile not found.");

  return {
    user,
    profile: { ...profile, socialVisibility: profileSocialVisibility(profile) },
    adventures: data.adventures
      .filter((entry) => entry.ownerUserId === userId)
      .map((entry) => summarizeAdventure(entry.adventure))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    scenarios: data.scenarioDrafts
      .filter((entry) => entry.ownerUserId === userId)
      .map((draft) => summarizeScenarioDraft(data, draft))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    social: buildOwnSocialSummary(data, userId),
  };
}

export function buildPublicProfileSummary(data: LocalDbData, userId: string, viewerUserId: string): PublicProfileSummary {
  const user = data.users.find((entry) => entry.id === userId);
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!user || !profile) throw new Error("Profile not found.");

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    profile: { ...profile, socialVisibility: profileSocialVisibility(profile) },
    scenarios: listExploreScenarios(data, viewerUserId).filter((scenario) => scenario.ownerUserId === userId),
    social: buildPublicSocialSummary(data, userId, viewerUserId),
  };
}

export function listExploreScenarios(data: LocalDbData, viewerUserId?: string): ExploreScenarioSummary[] {
  return data.scenarioRevisions
    .filter((revision) => revision.status === "published" && revision.publishedAt)
    .map((revision) => {
      const profile = data.profiles.find((entry) => entry.userId === revision.ownerUserId);
      const draft = data.scenarioDrafts.find((entry) => entry.id === revision.scenarioId && entry.ownerUserId === revision.ownerUserId);
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
        thumbnailImage: scenarioThumbnail(revision) ?? sourceAdventureThumbnail(data, draft),
        likeCount: scenarioLikeCount(data, revision.scenarioId),
        likedByViewer: Boolean(viewerUserId && data.scenarioLikes.some(
          (entry) => entry.scenarioId === revision.scenarioId && entry.userId === viewerUserId,
        )),
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

function buildOwnSocialSummary(data: LocalDbData, userId: string): OwnProfileSocialSummary {
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!profile) throw new Error("Profile not found.");
  return {
    visibility: profileSocialVisibility(profile),
    followers: peopleForIds(data, data.userFollows.filter((entry) => entry.followedUserId === userId).map((entry) => entry.followerUserId)),
    following: peopleForIds(data, data.userFollows.filter((entry) => entry.followerUserId === userId).map((entry) => entry.followedUserId)),
    friends: peopleForIds(data, data.friendships
      .filter((entry) => entry.status === "accepted" && (entry.requesterUserId === userId || entry.addresseeUserId === userId))
      .map((entry) => entry.requesterUserId === userId ? entry.addresseeUserId : entry.requesterUserId)),
    incomingFriendRequests: peopleForIds(data, data.friendships
      .filter((entry) => entry.status === "pending" && entry.addresseeUserId === userId)
      .map((entry) => entry.requesterUserId)),
    outgoingFriendRequests: peopleForIds(data, data.friendships
      .filter((entry) => entry.status === "pending" && entry.requesterUserId === userId)
      .map((entry) => entry.addresseeUserId)),
  };
}

function buildPublicSocialSummary(data: LocalDbData, userId: string, viewerUserId: string): PublicProfileSocialSummary {
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!profile) throw new Error("Profile not found.");
  const visibility = profileSocialVisibility(profile);
  const friendship = findFriendship(data, viewerUserId, userId);
  let friendshipStatus: ViewerFriendshipStatus = "none";
  if (viewerUserId === userId) friendshipStatus = "self";
  else if (friendship?.status === "accepted") friendshipStatus = "friends";
  else if (friendship?.requesterUserId === viewerUserId) friendshipStatus = "outgoing_pending";
  else if (friendship) friendshipStatus = "incoming_pending";

  return {
    visibility,
    followers: visibility.followers
      ? peopleForIds(data, data.userFollows.filter((entry) => entry.followedUserId === userId).map((entry) => entry.followerUserId))
      : undefined,
    following: visibility.following
      ? peopleForIds(data, data.userFollows.filter((entry) => entry.followerUserId === userId).map((entry) => entry.followedUserId))
      : undefined,
    friends: visibility.friends
      ? peopleForIds(data, data.friendships
        .filter((entry) => entry.status === "accepted" && (entry.requesterUserId === userId || entry.addresseeUserId === userId))
        .map((entry) => entry.requesterUserId === userId ? entry.addresseeUserId : entry.requesterUserId))
      : undefined,
    viewer: {
      isFollowing: data.userFollows.some((entry) => entry.followerUserId === viewerUserId && entry.followedUserId === userId),
      isFollowedBy: data.userFollows.some((entry) => entry.followerUserId === userId && entry.followedUserId === viewerUserId),
      friendshipStatus,
    },
  };
}

function peopleForIds(data: LocalDbData, userIds: string[]): SocialProfilePerson[] {
  return [...new Set(userIds)]
    .map((userId) => {
      const user = data.users.find((entry) => entry.id === userId && entry.status === "active");
      const profile = data.profiles.find((entry) => entry.userId === userId);
      return user && profile ? { userId, displayName: profile.displayName || user.displayName } : undefined;
    })
    .filter((entry): entry is SocialProfilePerson => Boolean(entry))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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
  return normalizeAdventureThumbnail(direct) ?? normalizeAdventureThumbnail(metadataThumbnail);
}

function sourceAdventureThumbnail(data: LocalDbData, draft: ScenarioDraft | undefined): AdventureThumbnailImage | undefined {
  if (!draft?.sourceAdventureId) return undefined;
  const sourceAdventure = data.adventures.find(
    (entry) => entry.id === draft.sourceAdventureId && entry.ownerUserId === draft.ownerUserId,
  );
  return sourceAdventure ? summarizeAdventure(sourceAdventure.adventure).thumbnailImage : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
