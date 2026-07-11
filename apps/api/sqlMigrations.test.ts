import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadSqlMigrations } from "./sqlMigrations";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe("SQL migration catalog", () => {
  it("loads ordered versioned SQL migrations", async () => {
    const migrations = await loadSqlMigrations();
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5]);
    expect(migrations[0].sql).toContain("schema_migrations");
    expect(migrations[1].sql).toContain("aist_idempotency");
    expect(migrations[3].sql).toContain("aist_performance_created_idx");
  });

  it("rejects duplicate migration versions", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aist-migrations-"));
    await writeFile(join(tempDir, "001_first.sql"), "SELECT 1;", "utf8");
    await writeFile(join(tempDir, "001_second.sql"), "SELECT 2;", "utf8");
    await expect(loadSqlMigrations(tempDir)).rejects.toThrow(/unique/i);
  });
});
