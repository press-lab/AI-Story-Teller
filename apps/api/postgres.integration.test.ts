import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEmptyDb } from "./dbShape";
import { buildPostgresPoolConfig, buildPostgresTransactionTimeoutQuery, PostgresDb } from "./postgresDb";
import { CURRENT_SQL_SCHEMA_VERSION, runSqlMigrations } from "./sqlMigrations";
import { createDefaultAdventure } from "../../src/state/defaults";
import { createInvite, signupWithPassword } from "./auth";

const connectionString = process.env.TEST_POSTGRES_URL;
const suite = connectionString ? describe : describe.skip;
const { Pool } = pg;

suite("Postgres production integration", () => {
  let db: PostgresDb;

  beforeAll(async () => {
    await runSqlMigrations(connectionString!);
    db = new PostgresDb(connectionString!, { max: 2, statementTimeoutMs: 5_000, lockTimeoutMs: 2_000 });
  });

  afterAll(async () => {
    await db?.close();
  });

  it("applies migrations repeatedly and reports compatible readiness", async () => {
    expect(await runSqlMigrations(connectionString!)).toEqual([]);
    expect(await db.readiness()).toEqual({ database: "postgres", schemaVersion: CURRENT_SQL_SCHEMA_VERSION });
  });

  it("round-trips the transition record store after migration", async () => {
    const data = createEmptyDb();
    data.users.push({
      id: "integration-user",
      email: "integration@example.com",
      displayName: "Integration",
      status: "active",
      emailVerified: true,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    });
    await db.write(data);
    expect((await db.read()).users).toEqual([expect.objectContaining({ id: "integration-user" })]);
  });

  it("keeps runtime DDL out of readiness checks", async () => {
    const pool = new Pool({ connectionString });
    try {
      const before = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM schema_migrations");
      await db.readiness();
      const after = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM schema_migrations");
      expect(after.rows[0].count).toBe(before.rows[0].count);
    } finally {
      await pool.end();
    }
  });

  it("applies server timeouts only for the current pooled transaction", async () => {
    const options = {
      max: 1,
      statementTimeoutMs: 5_000,
      lockTimeoutMs: 2_000,
      idleTransactionTimeoutMs: 3_000,
    };
    const transactionTimeouts = buildPostgresTransactionTimeoutQuery(options)!;
    const pool = new Pool(buildPostgresPoolConfig(connectionString!, options));
    const client = await pool.connect();
    try {
      const baseline = await client.query(`
        SELECT
          current_setting('statement_timeout') AS statement_timeout,
          current_setting('lock_timeout') AS lock_timeout,
          current_setting('idle_in_transaction_session_timeout') AS idle_timeout
      `);
      await client.query("BEGIN");
      await client.query(transactionTimeouts.text, transactionTimeouts.values);
      const active = await client.query(`
        SELECT
          current_setting('statement_timeout') AS statement_timeout,
          current_setting('lock_timeout') AS lock_timeout,
          current_setting('idle_in_transaction_session_timeout') AS idle_timeout
      `);
      expect(active.rows[0]).toEqual({
        statement_timeout: "5s",
        lock_timeout: "2s",
        idle_timeout: "3s",
      });
      await client.query("COMMIT");
      const reset = await client.query(`
        SELECT
          current_setting('statement_timeout') AS statement_timeout,
          current_setting('lock_timeout') AS lock_timeout,
          current_setting('idle_in_transaction_session_timeout') AS idle_timeout
      `);
      expect(reset.rows[0]).toEqual(baseline.rows[0]);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      await pool.end();
    }
  });

  it("shares rate limits and idempotency claims across API instances", async () => {
    const second = new PostgresDb(connectionString!, { max: 2, statementTimeoutMs: 5_000, lockTimeoutMs: 2_000 });
    const suffix = Date.now().toString(36);
    try {
      expect((await db.consumeRateLimit(`integration-rate-${suffix}`, 1, 60_000)).allowed).toBe(true);
      expect((await second.consumeRateLimit(`integration-rate-${suffix}`, 1, 60_000)).allowed).toBe(false);

      expect((await db.claimIdempotency("integration-user", "turn", `key-${suffix}`, "hash-a", new Date(Date.now() + 60_000).toISOString())).state).toBe("claimed");
      await db.completeIdempotency("integration-user", "turn", `key-${suffix}`, "succeeded", 200, { ok: true });
      expect(await second.claimIdempotency("integration-user", "turn", `key-${suffix}`, "hash-a", new Date(Date.now() + 60_000).toISOString()))
        .toMatchObject({ state: "succeeded", responseStatus: 200, responseBody: { ok: true } });
    } finally {
      await second.close();
    }
  });

  it("atomically consumes a one-use trusted invite across API instances", async () => {
    const second = new PostgresDb(connectionString!, { max: 2, statementTimeoutMs: 5_000, lockTimeoutMs: 2_000 });
    const suffix = Date.now().toString(36);
    const email = `trusted-invite-${suffix}@example.com`;
    try {
      const created = await db.updateAuth((data) => createInvite(data, { maxUses: 1 }));
      const signupInput = {
        inviteToken: created.token,
        email,
        password: "correct horse battery staple",
      };
      const results = await Promise.allSettled([
        db.updateAuth((data) => signupWithPassword(data, signupInput, { requireEmailVerification: false })),
        second.updateAuth((data) => signupWithPassword(data, signupInput, { requireEmailVerification: false })),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

      const data = await db.read();
      expect(data.users.filter((user) => user.email === email)).toHaveLength(1);
      const invite = data.inviteLinks.find((entry) => entry.id === created.invite.id);
      expect(invite?.useCount).toBe(1);
    } finally {
      await second.close();
    }
  });

  it("allows only one writer to commit a shared adventure revision", async () => {
    const adventure = createDefaultAdventure("Concurrent Revision");
    adventure.id = `integration-adventure-${Date.now().toString(36)}`;
    const inserted = await db.saveAdventureRecord("integration-user", adventure, "import");
    const first = { ...inserted.adventure, title: "Writer One" };
    const second = { ...inserted.adventure, title: "Writer Two" };
    const results = await Promise.allSettled([
      db.saveAdventureRecord("integration-user", first, "manualSave"),
      db.saveAdventureRecord("integration-user", second, "manualSave"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
