import { access } from "node:fs/promises";
import { loadApiConfig } from "./config";
import { countDbRecords, createEmptyDb } from "./dbShape";
import { LocalDb } from "./localDb";
import { PostgresDb, postgresSummary } from "./postgresDb";

const force = process.argv.includes("--force");
const config = loadApiConfig();

if (!config.databaseUrl) {
  console.error("AIST_DATABASE_URL or DATABASE_URL is required for Postgres import.");
  process.exit(1);
}

const source = new LocalDb(config.dataFile);
const target = new PostgresDb(config.databaseUrl);

try {
  const sourceExists = await fileExists(config.dataFile);
  const sourceData = sourceExists ? await source.read() : createEmptyDb();
  const existingTarget = await target.read({ includeAdventureSnapshots: true });
  const existingCount = countDbRecords(existingTarget);
  if (existingCount > 0 && !force) {
    console.error(`Postgres already contains ${postgresSummary(existingTarget)}.`);
    console.error("Re-run with --force only if you intentionally want to replace Postgres data from the JSON file.");
    process.exit(1);
  }
  await target.write(sourceData);
  const imported = await target.read({ includeAdventureSnapshots: true });
  console.log(`Imported ${postgresSummary(imported)} to Postgres.`);
  console.log(`Source JSON: ${config.dataFile}${sourceExists ? "" : " (missing; imported empty database)"}`);
} finally {
  await source.close();
  await target.close();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
