import { describe, expect, it } from "vitest";
import { createEmptyDb, recordIdForCollection } from "./dbShape";
import { postgresSummary } from "./postgresDb";

describe("Postgres DB shape helpers", () => {
  it("uses stable domain IDs for records without a plain id field", () => {
    expect(recordIdForCollection("profiles", {
      userId: "user-1",
      displayName: "Player",
      bio: "",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z",
    })).toBe("user-1");
    expect(recordIdForCollection("passwordCredentials", {
      userId: "user-1",
      passwordHash: "hash",
      salt: "salt",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z",
    })).toBe("user-1");
  });

  it("summarizes collection-backed data for migration logs", () => {
    const data = createEmptyDb();
    data.users.push({
      id: "user-1",
      email: "player@example.com",
      displayName: "Player",
      status: "active",
      emailVerified: true,
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
    expect(postgresSummary(data)).toContain("1 record(s)");
  });
});
