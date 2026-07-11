import { describe, expect, it } from "vitest";
import { createEmptyDb, recordIdForCollection } from "./dbShape";
import { buildPostgresPoolConfig, buildPostgresTransactionTimeoutQuery, postgresSummary } from "./postgresDb";

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

  it("keeps pooled connection timeouts out of Postgres startup parameters", () => {
    const poolConfig = buildPostgresPoolConfig("postgres://example.invalid/storymode", {
      statementTimeoutMs: 30_000,
      lockTimeoutMs: 5_000,
      idleTransactionTimeoutMs: 15_000,
    });

    expect(poolConfig).not.toHaveProperty("options");
    expect(poolConfig).not.toHaveProperty("statement_timeout");
    expect(poolConfig).not.toHaveProperty("lock_timeout");
    expect(poolConfig).not.toHaveProperty("idle_in_transaction_session_timeout");
    expect(poolConfig.onConnect).toBeUndefined();
    expect(poolConfig.query_timeout).toBe(35_000);
  });

  it("builds transaction-local server timeout settings for pooled connections", () => {
    expect(buildPostgresTransactionTimeoutQuery({
      statementTimeoutMs: 30_000,
      lockTimeoutMs: 5_000,
      idleTransactionTimeoutMs: 15_000,
    })).toEqual({
      text: "SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true), set_config('idle_in_transaction_session_timeout', $3, true)",
      values: ["30000", "5000", "15000"],
    });
  });

  it("omits transaction-local setup when no database timeouts are configured", () => {
    expect(buildPostgresTransactionTimeoutQuery()).toBeUndefined();
  });
});
