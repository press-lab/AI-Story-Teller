import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";

const require = createRequire(import.meta.url);
const { loadApiConfig } = require("../dist-api/apps/api/config.js");
const { CURRENT_SQL_SCHEMA_VERSION } = require("../dist-api/apps/api/sqlMigrations.js");
const { Pool } = pg;

const config = loadApiConfig();
const sourceUrl = process.env.TEST_POSTGRES_ADMIN_URL
  ?? process.env.TEST_POSTGRES_URL
  ?? config.databaseDirectUrl
  ?? config.databaseUrl;
if (!sourceUrl) {
  throw new Error("Set TEST_POSTGRES_ADMIN_URL, TEST_POSTGRES_URL, DATABASE_DIRECT_URL, AIST_DATABASE_URL, or DATABASE_URL.");
}

await requireFile("dist-api/apps/api/hostedServer.js");
await requireFile("dist-api/apps/api/migrateSchema.js");
await requireFile("dist-api/apps/api/migrations/001_initial.sql");
await assertCompiledProductionCommands();

const suffix = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
const parityName = `aist_render_parity_${suffix}`;
const failureName = `aist_render_failure_${suffix}`;
const adminUrl = databaseUrl(sourceUrl, "postgres");
const parityUrl = databaseUrl(sourceUrl, parityName);
const failureUrl = databaseUrl(sourceUrl, failureName);
const admin = new Pool({ connectionString: adminUrl, max: 1 });

try {
  await createDatabase(admin, parityName);
  await createDatabase(admin, failureName);

  await runNpm("api:db:migrate", { DATABASE_DIRECT_URL: parityUrl });
  await runNpm("api:db:migrate", { DATABASE_DIRECT_URL: parityUrl });
  await assertSchemaVersion(parityUrl, CURRENT_SQL_SCHEMA_VERSION);
  if (process.env.AIST_PARITY_RUN_INTEGRATION_TESTS === "true") {
    await runNpm("api:test:postgres", { NODE_ENV: "test", TEST_POSTGRES_URL: parityUrl });
  }
  await runNpm("api:smoke", { DATABASE_URL: parityUrl, DATABASE_DIRECT_URL: "" });

  await seedFutureSchema(failureUrl, CURRENT_SQL_SCHEMA_VERSION + 1);
  let startAttempted = false;
  const migrationExit = await runNpm(
    "api:db:migrate",
    { DATABASE_DIRECT_URL: failureUrl },
    { expectFailure: true },
  );
  if (migrationExit === 0) {
    startAttempted = true;
    await runNpm("api:smoke", { DATABASE_URL: failureUrl, DATABASE_DIRECT_URL: "" });
  }
  if (migrationExit === 0 || startAttempted) {
    throw new Error("An incompatible migration did not gate production startup.");
  }

  console.log("Render deployment parity passed: compiled migration, idempotent migration, readiness, shutdown, pruning, and failure gate.");
} finally {
  await dropDatabase(admin, parityName);
  await dropDatabase(admin, failureName);
  await admin.end();
}

async function requireFile(path) {
  await access(path);
}

async function assertCompiledProductionCommands() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  if (packageJson.dependencies?.tsx) {
    throw new Error("tsx must not be a root production dependency.");
  }
  for (const name of ["api:db:migrate", "api:hosted"]) {
    const command = packageJson.scripts?.[name] ?? "";
    if (!command.startsWith("node dist-api/") || command.includes("tsx")) {
      throw new Error(`${name} must execute a compiled dist-api entrypoint with node.`);
    }
  }
}

function databaseUrl(source, databaseName) {
  const url = new URL(source);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function createDatabase(pool, name) {
  await pool.query(`CREATE DATABASE "${name}" TEMPLATE template0 ENCODING 'UTF8'`);
}

async function dropDatabase(pool, name) {
  await pool.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [name],
  ).catch(() => undefined);
  await pool.query(`DROP DATABASE IF EXISTS "${name}"`).catch(() => undefined);
}

async function assertSchemaVersion(connectionString, expected) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query("SELECT max(version)::int AS version FROM schema_migrations");
    if (result.rows[0]?.version !== expected) {
      throw new Error(`Compiled migration produced schema version ${result.rows[0]?.version}; expected ${expected}.`);
    }
  } finally {
    await pool.end();
  }
}

async function seedFutureSchema(connectionString, version) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      CREATE TABLE schema_migrations (
        version integer PRIMARY KEY,
        name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
      [version, "future_schema"],
    );
  } finally {
    await pool.end();
  }
}

function runNpm(script, extraEnv, { expectFailure = false } = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("api:deploy:parity must be invoked through npm run.");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, "run", script], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "production", ...extraEnv },
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      const exitCode = code ?? 1;
      if (exitCode === 0 || expectFailure) {
        resolve(exitCode);
        return;
      }
      reject(new Error(`npm run ${script} failed with code ${code} and signal ${signal}.`));
    });
  });
}
