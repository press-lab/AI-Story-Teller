import type { AdminConsoleData, AdminConsoleDetailsData } from "./adminConsole";
import type { AdventureSnapshotSummary } from "./adventureStore";
import type { AccountRestriction, BackendAdventureRecord, BackendUser, LocalDbData, PerformanceTraceRecord, SessionRecord, UserProfile } from "./apiTypes";
import type { ApiConfig } from "./config";
import type { BackendProfileSummary, ExploreScenarioSummary, PublicProfileSummary } from "./profileReadModels";
import type { Adventure } from "../../src/types/adventure";

export interface BackendReadOptions {
  includeAdventureSnapshots?: boolean;
}

export interface DatabaseReadiness {
  database: "postgres" | "local-json";
  schemaVersion: number;
}

export interface ResolvedSessionData {
  session: SessionRecord;
  user: BackendUser;
  profile: UserProfile;
}

export interface AdventureWorkspace {
  data: LocalDbData;
  baseRevision: number;
}

export interface IdempotencyResult {
  state: "claimed" | "pending" | "succeeded" | "failed";
  responseStatus?: number;
  responseBody?: unknown;
}

export interface BackendDb {
  read(options?: BackendReadOptions): Promise<LocalDbData>;
  write(data: LocalDbData): Promise<void>;
  update<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  updateAuth?<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  readiness(): Promise<DatabaseReadiness>;
  resolveSessionByTokenHash?(tokenHash: string): Promise<ResolvedSessionData | undefined>;
  revokeSessionByTokenHash?(tokenHash: string): Promise<boolean>;
  loadPasswordLoginWorkspace?(normalizedEmail: string): Promise<LocalDbData>;
  savePasswordLoginWorkspace?(userId: string, data: LocalDbData): Promise<void>;
  readAccountRestrictions?(userId: string): Promise<AccountRestriction[]>;
  listAdventureRecords?(ownerUserId: string): Promise<BackendAdventureRecord[]>;
  readAdventureRecord?(ownerUserId: string, adventureId: string): Promise<BackendAdventureRecord | undefined>;
  saveAdventureRecord?(ownerUserId: string, adventure: Adventure, source: "import" | "turn" | "manualSave" | "restore"): Promise<BackendAdventureRecord>;
  deleteAdventureRecord?(ownerUserId: string, adventureId: string): Promise<boolean>;
  loadAdventureWorkspace?(ownerUserId: string, adventureId: string): Promise<AdventureWorkspace>;
  saveAdventureWorkspace?(ownerUserId: string, adventureId: string, baseRevision: number, data: LocalDbData): Promise<void>;
  loadAccountWorkspace?(userId: string): Promise<LocalDbData>;
  saveAccountWorkspace?(userId: string, data: LocalDbData): Promise<void>;
  claimIdempotency?(userId: string, operation: string, key: string, requestHash: string, expiresAt: string): Promise<IdempotencyResult>;
  completeIdempotency?(userId: string, operation: string, key: string, state: "succeeded" | "failed", responseStatus: number, responseBody: unknown): Promise<void>;
  consumeRateLimit?(bucketKey: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  readProfileSummary?(userId: string): Promise<BackendProfileSummary>;
  readPublicProfileSummary?(userId: string): Promise<PublicProfileSummary>;
  readExploreScenarios?(): Promise<ExploreScenarioSummary[]>;
  readAdventureSnapshotSummaries?(ownerUserId: string, adventureId: string): Promise<AdventureSnapshotSummary[]>;
  readAdminConsoleSummary?(config: ApiConfig): Promise<AdminConsoleData>;
  readAdminConsoleDetails?(config: ApiConfig): Promise<AdminConsoleDetailsData>;
  recordPerformanceTrace?(record: PerformanceTraceRecord): Promise<void>;
  cleanupLifecycle?(): Promise<number>;
  close(): Promise<void>;
}
