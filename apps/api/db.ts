import type { ApiConfig } from "./config";
import type { BackendDb } from "./backendDb";
import { LocalDb } from "./localDb";
import { PostgresDb } from "./postgresDb";

export function createBackendDb(config: ApiConfig): BackendDb {
  return config.databaseUrl ? new PostgresDb(config.databaseUrl, {
    max: config.databasePoolMax,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    statementTimeoutMs: config.databaseStatementTimeoutMs,
    lockTimeoutMs: config.databaseLockTimeoutMs,
    idleTransactionTimeoutMs: config.databaseIdleTransactionTimeoutMs,
  }) : new LocalDb(config.dataFile);
}
