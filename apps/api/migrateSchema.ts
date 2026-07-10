import { loadApiConfig } from "./config";
import { runSqlMigrations } from "./sqlMigrations";

async function main(): Promise<void> {
  const config = loadApiConfig();
  const connectionString = config.databaseDirectUrl ?? config.databaseUrl;
  if (!connectionString) throw new Error("DATABASE_DIRECT_URL, AIST_DATABASE_URL, or DATABASE_URL is required for schema migration.");
  const applied = await runSqlMigrations(connectionString);
  console.log(applied.length > 0 ? `Applied SQL migration(s): ${applied.join(", ")}.` : "SQL schema is already current.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
