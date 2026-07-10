import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;

export const CURRENT_SQL_SCHEMA_VERSION = 2;

export interface SqlMigration {
  version: number;
  name: string;
  sql: string;
}

export async function loadSqlMigrations(directory = resolve("apps/api/migrations")): Promise<SqlMigration[]> {
  const files = (await readdir(directory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(file))
    .sort();
  const migrations = await Promise.all(files.map(async (file) => ({
    version: Number.parseInt(file.slice(0, 3), 10),
    name: file.slice(4, -4),
    sql: await readFile(resolve(directory, file), "utf8"),
  })));
  const versions = migrations.map((migration) => migration.version);
  if (new Set(versions).size !== versions.length) throw new Error("SQL migration versions must be unique.");
  return migrations;
}

export async function runSqlMigrations(connectionString: string, directory?: string): Promise<number[]> {
  const pool = new Pool({ connectionString, max: 1 });
  const applied: number[] = [];
  try {
    const migrations = await loadSqlMigrations(directory);
    for (const migration of migrations) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version integer PRIMARY KEY,
            name text NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
          )
        `);
        const existing = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [migration.version]);
        if (existing.rowCount === 0) {
          await client.query(migration.sql);
          await client.query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
            [migration.version, migration.name],
          );
          applied.push(migration.version);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
    return applied;
  } finally {
    await pool.end();
  }
}
