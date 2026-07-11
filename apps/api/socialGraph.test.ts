import { describe, expect, it } from "vitest";
import type { BackendUser, LocalDbData, UserProfile } from "./apiTypes";
import { createEmptyDb } from "./dbShape";
import { buildProfileSummary, buildPublicProfileSummary, listExploreScenarios } from "./profileReadModels";
import {
  acceptFriendship,
  followUser,
  likeScenario,
  removeFriendship,
  requestFriendship,
  unlikeScenario,
  updateProfileSocialVisibility,
} from "./socialGraph";

const createdAt = "2026-07-10T00:00:00.000Z";

function addUser(data: LocalDbData, id: string, displayName: string): void {
  const user: BackendUser = {
    id,
    email: `${id}@example.com`,
    displayName,
    status: "active",
    emailVerified: true,
    createdAt,
    updatedAt: createdAt,
  };
  const profile: UserProfile = { userId: id, displayName, bio: "", createdAt, updatedAt: createdAt };
  data.users.push(user);
  data.profiles.push(profile);
}

function addPublishedScenario(data: LocalDbData, scenarioId = "scenario-one", ownerUserId = "creator"): void {
  data.scenarioDrafts.push({
    id: scenarioId,
    ownerUserId,
    title: "A Published World",
    description: "A reusable setup.",
    createdAt,
    updatedAt: createdAt,
  });
  data.scenarioRevisions.push({
    id: "revision-one",
    scenarioId,
    ownerUserId,
    version: 1,
    title: "A Published World",
    description: "A reusable setup.",
    content: {},
    status: "published",
    createdAt,
    publishedAt: createdAt,
  });
}

describe("social graph", () => {
  it("stores one like per person and exposes viewer-aware like totals", () => {
    const data = createEmptyDb();
    addUser(data, "creator", "Creator");
    addUser(data, "viewer", "Viewer");
    addPublishedScenario(data);

    expect(likeScenario(data, "viewer", "scenario-one")).toBe(likeScenario(data, "viewer", "scenario-one"));
    expect(data.scenarioLikes).toHaveLength(1);
    expect(listExploreScenarios(data, "viewer")[0]).toMatchObject({ likeCount: 1, likedByViewer: true });

    expect(unlikeScenario(data, "viewer", "scenario-one")).toBe(true);
    expect(listExploreScenarios(data, "viewer")[0]).toMatchObject({ likeCount: 0, likedByViewer: false });
  });

  it("supports follows, friend requests, acceptance, and removal without duplicate edges", () => {
    const data = createEmptyDb();
    addUser(data, "reynaud", "Reynaud");
    addUser(data, "margo", "Margo");

    expect(followUser(data, "reynaud", "margo")).toBe(followUser(data, "reynaud", "margo"));
    expect(data.userFollows).toHaveLength(1);
    requestFriendship(data, "reynaud", "margo");

    expect(buildPublicProfileSummary(data, "margo", "reynaud").social.viewer).toMatchObject({
      isFollowing: true,
      friendshipStatus: "outgoing_pending",
    });
    expect(buildProfileSummary(data, "margo").social.incomingFriendRequests).toEqual([
      { userId: "reynaud", displayName: "Reynaud" },
    ]);

    acceptFriendship(data, "margo", "reynaud");
    expect(buildPublicProfileSummary(data, "margo", "reynaud").social.viewer.friendshipStatus).toBe("friends");
    expect(removeFriendship(data, "reynaud", "margo")).toBe(true);
    expect(buildProfileSummary(data, "margo").social.friends).toEqual([]);
  });

  it("honors profile visibility without hiding relationship state from the viewer", () => {
    const data = createEmptyDb();
    addUser(data, "reynaud", "Reynaud");
    addUser(data, "margo", "Margo");
    followUser(data, "reynaud", "margo");
    updateProfileSocialVisibility(data, "margo", { followers: false, following: false, friends: false });

    const publicProfile = buildPublicProfileSummary(data, "margo", "reynaud");
    expect(publicProfile.social.visibility).toEqual({ followers: false, following: false, friends: false });
    expect(publicProfile.social.followers).toBeUndefined();
    expect(publicProfile.social.following).toBeUndefined();
    expect(publicProfile.social.friends).toBeUndefined();
    expect(publicProfile.social.viewer.isFollowing).toBe(true);
  });
});
