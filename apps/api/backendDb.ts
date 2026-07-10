import type { AdminConsoleData, AdminConsoleDetailsData } from "./adminConsole";
import type { AdventureSnapshotSummary } from "./adventureStore";
import type { LocalDbData, PerformanceTraceRecord } from "./apiTypes";
import type { ApiConfig } from "./config";
import type { BackendProfileSummary, ExploreScenarioSummary, PublicProfileSummary } from "./profileReadModels";

export interface BackendReadOptions {
  includeAdventureSnapshots?: boolean;
}

export interface DatabaseReadiness {
  database: "postgres" | "local-json";
  schemaVersion: number;
}

export interface BackendDb {
  read(options?: BackendReadOptions): Promise<LocalDbData>;
  write(data: LocalDbData): Promise<void>;
  update<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  readiness(): Promise<DatabaseReadiness>;
  readProfileSummary?(userId: string): Promise<BackendProfileSummary>;
  readPublicProfileSummary?(userId: string): Promise<PublicProfileSummary>;
  readExploreScenarios?(): Promise<ExploreScenarioSummary[]>;
  readAdventureSnapshotSummaries?(ownerUserId: string, adventureId: string): Promise<AdventureSnapshotSummary[]>;
  readAdminConsoleSummary?(config: ApiConfig): Promise<AdminConsoleData>;
  readAdminConsoleDetails?(config: ApiConfig): Promise<AdminConsoleDetailsData>;
  recordPerformanceTrace?(record: PerformanceTraceRecord): Promise<void>;
  close(): Promise<void>;
}
