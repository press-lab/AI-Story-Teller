import { describe, expect, it } from "vitest";
import { createEmptyDb } from "./dbShape";
import { deleteUserData, pruneExpiredAndRetainedData } from "./dataLifecycle";

describe("data lifecycle", () => {
  it("prunes expired auth artifacts and old telemetry while retaining current records", () => {
    const data = createEmptyDb();
    data.sessions = [
      { id: "old", userId: "u", tokenHash: "a", createdAt: "2025-01-01T00:00:00.000Z", expiresAt: "2025-01-02T00:00:00.000Z" },
      { id: "current", userId: "u", tokenHash: "b", createdAt: "2026-07-09T00:00:00.000Z", expiresAt: "2026-07-20T00:00:00.000Z" },
    ];
    data.performanceTraces = [{
      id: "old-trace", traceId: "old", source: "device", phase: "http_round_trip", status: "ok", durationMs: 1,
      createdAt: "2025-01-01T00:00:00.000Z",
    }];
    pruneExpiredAndRetainedData(data, new Date("2026-07-10T00:00:00.000Z"));
    expect(data.sessions.map((entry) => entry.id)).toEqual(["current"]);
    expect(data.performanceTraces).toEqual([]);
  });

  it("physically deletes owned account content without deleting another user", () => {
    const data = createEmptyDb();
    data.users = [
      { id: "delete", email: "delete@example.com", displayName: "Delete", status: "active", emailVerified: true, createdAt: "x", updatedAt: "x" },
      { id: "keep", email: "keep@example.com", displayName: "Keep", status: "active", emailVerified: true, createdAt: "x", updatedAt: "x" },
    ];
    data.profiles = [
      { userId: "delete", displayName: "Delete", bio: "", createdAt: "x", updatedAt: "x" },
      { userId: "keep", displayName: "Keep", bio: "", createdAt: "x", updatedAt: "x" },
    ];
    data.scenarioDrafts = [{ id: "owned-scenario", ownerUserId: "delete", title: "Owned", description: "", createdAt: "x", updatedAt: "x" }];
    data.scenarioLikes = [
      { id: "like-by-delete", scenarioId: "someone-elses", userId: "delete", createdAt: "x" },
      { id: "like-on-delete", scenarioId: "owned-scenario", userId: "keep", createdAt: "x" },
    ];
    data.userFollows = [{ id: "follow", followerUserId: "keep", followedUserId: "delete", createdAt: "x" }];
    data.friendships = [{
      id: "friendship",
      requesterUserId: "delete",
      addresseeUserId: "keep",
      status: "accepted",
      createdAt: "x",
      updatedAt: "x",
    }];
    deleteUserData(data, "delete");
    expect(data.users.map((entry) => entry.id)).toEqual(["keep"]);
    expect(data.profiles.map((entry) => entry.userId)).toEqual(["keep"]);
    expect(data.scenarioLikes).toEqual([]);
    expect(data.userFollows).toEqual([]);
    expect(data.friendships).toEqual([]);
  });
});
