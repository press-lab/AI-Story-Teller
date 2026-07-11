import type {
  Friendship,
  LocalDbData,
  ProfileSocialVisibility,
  ScenarioLike,
  UserFollow,
  UserProfile,
} from "./apiTypes";
import { ApiError } from "./apiError";
import { createId, nowIso } from "./ids";

export const DEFAULT_SOCIAL_VISIBILITY: ProfileSocialVisibility = {
  followers: true,
  following: true,
  friends: true,
};

export function profileSocialVisibility(profile: UserProfile): ProfileSocialVisibility {
  return {
    followers: profile.socialVisibility?.followers !== false,
    following: profile.socialVisibility?.following !== false,
    friends: profile.socialVisibility?.friends !== false,
  };
}

export function updateProfileSocialVisibility(
  data: LocalDbData,
  userId: string,
  input: Partial<ProfileSocialVisibility>,
): ProfileSocialVisibility {
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!profile) throw new ApiError(404, "profile_not_found", "Profile not found.");
  const current = profileSocialVisibility(profile);
  profile.socialVisibility = {
    followers: typeof input.followers === "boolean" ? input.followers : current.followers,
    following: typeof input.following === "boolean" ? input.following : current.following,
    friends: typeof input.friends === "boolean" ? input.friends : current.friends,
  };
  profile.updatedAt = nowIso();
  return profile.socialVisibility;
}

export function likeScenario(data: LocalDbData, userId: string, scenarioId: string): ScenarioLike {
  requireSocialUser(data, userId);
  const scenario = data.scenarioDrafts.find((entry) => entry.id === scenarioId);
  const isPublished = data.scenarioRevisions.some(
    (entry) => entry.scenarioId === scenarioId && entry.status === "published" && entry.publishedAt,
  );
  if (!scenario || !isPublished) {
    throw new ApiError(404, "published_scenario_not_found", "Published scenario not found.");
  }
  const existing = data.scenarioLikes.find((entry) => entry.scenarioId === scenarioId && entry.userId === userId);
  if (existing) return existing;
  const like: ScenarioLike = {
    id: createId("scenario_like"),
    scenarioId,
    userId,
    createdAt: nowIso(),
  };
  data.scenarioLikes.push(like);
  return like;
}

export function unlikeScenario(data: LocalDbData, userId: string, scenarioId: string): boolean {
  const before = data.scenarioLikes.length;
  data.scenarioLikes = data.scenarioLikes.filter(
    (entry) => !(entry.scenarioId === scenarioId && entry.userId === userId),
  );
  return data.scenarioLikes.length < before;
}

export function scenarioLikeCount(data: LocalDbData, scenarioId: string): number {
  return data.scenarioLikes.filter((entry) => entry.scenarioId === scenarioId).length;
}

export function followUser(data: LocalDbData, followerUserId: string, followedUserId: string): UserFollow {
  assertDifferentUsers(followerUserId, followedUserId, "follow");
  requireSocialUser(data, followerUserId);
  requireSocialUser(data, followedUserId);
  const existing = data.userFollows.find(
    (entry) => entry.followerUserId === followerUserId && entry.followedUserId === followedUserId,
  );
  if (existing) return existing;
  const follow: UserFollow = {
    id: createId("follow"),
    followerUserId,
    followedUserId,
    createdAt: nowIso(),
  };
  data.userFollows.push(follow);
  return follow;
}

export function unfollowUser(data: LocalDbData, followerUserId: string, followedUserId: string): boolean {
  const before = data.userFollows.length;
  data.userFollows = data.userFollows.filter(
    (entry) => !(entry.followerUserId === followerUserId && entry.followedUserId === followedUserId),
  );
  return data.userFollows.length < before;
}

export function requestFriendship(data: LocalDbData, requesterUserId: string, addresseeUserId: string): Friendship {
  assertDifferentUsers(requesterUserId, addresseeUserId, "friend");
  requireSocialUser(data, requesterUserId);
  requireSocialUser(data, addresseeUserId);
  const existing = findFriendship(data, requesterUserId, addresseeUserId);
  if (existing?.status === "accepted") {
    throw new ApiError(409, "already_friends", "You are already friends.");
  }
  if (existing?.requesterUserId === requesterUserId) return existing;
  if (existing) {
    throw new ApiError(409, "incoming_friend_request", "This person already sent you a friend request. Accept it from their profile.");
  }
  const now = nowIso();
  const friendship: Friendship = {
    id: createId("friendship"),
    requesterUserId,
    addresseeUserId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  data.friendships.push(friendship);
  return friendship;
}

export function acceptFriendship(data: LocalDbData, userId: string, requesterUserId: string): Friendship {
  const friendship = data.friendships.find(
    (entry) => entry.requesterUserId === requesterUserId && entry.addresseeUserId === userId,
  );
  if (!friendship) throw new ApiError(404, "friend_request_not_found", "Friend request not found.");
  if (friendship.status === "accepted") return friendship;
  const now = nowIso();
  friendship.status = "accepted";
  friendship.acceptedAt = now;
  friendship.updatedAt = now;
  return friendship;
}

export function removeFriendship(data: LocalDbData, userId: string, otherUserId: string): boolean {
  const before = data.friendships.length;
  data.friendships = data.friendships.filter(
    (entry) => !(
      (entry.requesterUserId === userId && entry.addresseeUserId === otherUserId)
      || (entry.requesterUserId === otherUserId && entry.addresseeUserId === userId)
    ),
  );
  return data.friendships.length < before;
}

export function findFriendship(data: LocalDbData, firstUserId: string, secondUserId: string): Friendship | undefined {
  return data.friendships.find(
    (entry) => (
      (entry.requesterUserId === firstUserId && entry.addresseeUserId === secondUserId)
      || (entry.requesterUserId === secondUserId && entry.addresseeUserId === firstUserId)
    ),
  );
}

function requireSocialUser(data: LocalDbData, userId: string): void {
  const user = data.users.find((entry) => entry.id === userId);
  const profile = data.profiles.find((entry) => entry.userId === userId);
  if (!user || !profile || user.status !== "active") {
    throw new ApiError(404, "profile_not_found", "Profile not found.");
  }
}

function assertDifferentUsers(firstUserId: string, secondUserId: string, action: string): void {
  if (firstUserId === secondUserId) {
    throw new ApiError(400, `cannot_${action}_self`, `You cannot ${action} yourself.`);
  }
}
