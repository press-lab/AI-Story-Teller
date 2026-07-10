import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEmptyDb } from "./dbShape";
import { PostgresDb } from "./postgresDb";
import { CURRENT_SQL_SCHEMA_VERSION, runSqlMigrations } from "./sqlMigrations";

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
});
