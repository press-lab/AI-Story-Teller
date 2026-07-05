import type { ApiConfig } from "./config";
import type { BackendDb } from "./backendDb";
import { LocalDb } from "./localDb";
import { PostgresDb } from "./postgresDb";

export function createBackendDb(config: ApiConfig): BackendDb {
  return config.databaseUrl ? new PostgresDb(config.databaseUrl) : new LocalDb(config.dataFile);
}
