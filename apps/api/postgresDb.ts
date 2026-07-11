import pg from "pg";
import {
  buildAdminConsole,
  buildAdminConsoleDetails,
  emptyUserUsageStats,
  type AdminConsoleData,
  type AdminConsoleDetailsData,
  type AdminUserUsageStats,
} from "./adminConsole";
import type { AdventureSnapshotSummary } from "./adventureStore";
import type { LocalDbData, PerformanceTraceRecord } from "./apiTypes";
import type { BackendDb, BackendReadOptions } from "./backendDb";
import type { ApiConfig } from "./config";
import {
  countDbRecords,
  createEmptyDb,
  dbCollectionKeys,
  normalizeDbData,
  recordIdForCollection,
  type DbCollectionKey,
} from "./dbShape";
import {
  buildProfileSummary,
  buildPublicProfileSummary,
  listExploreScenarios,
  type BackendProfileSummary,
  type ExploreScenarioSummary,
  type PublicProfileSummary,
} from "./profileReadModels";
import { MAX_PERFORMANCE_TRACES } from "./performanceTrace";
import { CURRENT_SQL_SCHEMA_VERSION } from "./sqlMigrations";
import type { Adventure } from "../../src/types/adventure";
import { normalizeAdventure, sanitizeAdventureForPersistence } from "../../src/state/defaults";
import { adventureServerRevision, StaleAdventureRevisionError, withAdventureServerRevision } from "./adventureRevision";
import { createId, nowIso } from "./ids";

const { Pool } = pg;
const ADVISORY_LOCK_KEY = 4_263_117;
const MAX_SNAPSHOTS_PER_ADVENTURE = 100;

export interface PostgresDbOptions {
  max?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  statementTimeoutMs?: number;
  lockTimeoutMs?: number;
  idleTransactionTimeoutMs?: number;
}

interface DbMetadata {
  schemaVersion: number;
  migrations: LocalDbData["migrations"];
}

interface ReadRowsOptions {
  orderByCreatedDesc?: boolean;
  limit?: number;
}

interface SnapshotSummaryRow {
  id: string;
  adventureId: string;
  source: AdventureSnapshotSummary["source"];
  title: string | null;
  createdAt: string;
  adventureUpdatedAt: string | null;
  turnCount: number | string | null;
  storyEntryCount: number | string | null;
}

interface ContextBuildSummaryRow {
  id: string;
  userId: string;
  adventureId: string;
  gate: string;
  createdAt: string;
  messageCount: number | string | null;
  sectionCount: number | string | null;
  totalEstimatedTokens: number | string | null;
  excludedItemCount: number | string | null;
  decisionCount: number | string | null;
}

interface UserUsageStatsRow {
  userId: string;
  usageLogCount: number | string | null;
  promptTokens: number | string | null;
  completionTokens: number | string | null;
  totalTokens: number | string | null;
  cacheReadTokens: number | string | null;
  cacheCreationTokens: number | string | null;
  totalDurationMs: number | string | null;
  lastUsedAt: string | null;
}

export class PostgresDb implements BackendDb {
  private readonly pool: pg.Pool;
  private initPromise: Promise<void> | undefined;

  constructor(connectionString: string, options: PostgresDbOptions = {}) {
    const sessionOptions = [
      options.statementTimeoutMs ? `-c statement_timeout=${Math.round(options.statementTimeoutMs)}` : "",
      options.lockTimeoutMs ? `-c lock_timeout=${Math.round(options.lockTimeoutMs)}` : "",
      options.idleTransactionTimeoutMs ? `-c idle_in_transaction_session_timeout=${Math.round(options.idleTransactionTimeoutMs)}` : "",
    ].filter(Boolean).join(" ");
    this.pool = new Pool({
      connectionString,
      max: options.max,
      connectionTimeoutMillis: options.connectionTimeoutMillis,
      idleTimeoutMillis: options.idleTimeoutMillis,
      options: sessionOptions || undefined,
    });
  }

  async readiness() {
    await this.init();
    const result = await this.pool.query<{ version: number }>("SELECT max(version)::int AS version FROM schema_migrations");
    return { database: "postgres" as const, schemaVersion: result.rows[0]?.version ?? 0 };
  }

  async resolveSessionByTokenHash(tokenHash: string) {
    await this.init();
    const result = await this.pool.query<{
      session: LocalDbData["sessions"][number];
      user: LocalDbData["users"][number];
      profile: LocalDbData["profiles"][number];
    }>(`
      SELECT session.data AS session, app_user.data AS "user", profile.data AS profile
      FROM aist_records session
      JOIN aist_records app_user
        ON app_user.collection = 'users' AND app_user.id = session.data->>'userId'
      JOIN aist_records profile
        ON profile.collection = 'profiles' AND profile.id = session.data->>'userId'
      WHERE session.collection = 'sessions'
        AND session.data->>'tokenHash' = $1
        AND NOT (session.data ? 'revokedAt')
        AND (session.data->>'expiresAt')::timestamptz > now()
      LIMIT 1
    `, [tokenHash]);
    return result.rows[0];
  }

  async revokeSessionByTokenHash(tokenHash: string) {
    await this.init();
    const result = await this.pool.query(`
      UPDATE aist_records
      SET data = jsonb_set(data, '{revokedAt}', to_jsonb(now()::text), true), updated_at = now()
      WHERE collection = 'sessions' AND data->>'tokenHash' = $1 AND NOT (data ? 'revokedAt')
    `, [tokenHash]);
    return (result.rowCount ?? 0) > 0;
  }

  async loadPasswordLoginWorkspace(normalizedEmail: string) {
    await this.init();
    const client = await this.pool.connect();
    try {
      const users = await this.readRows(
        client,
        "users",
        "AND lower(data->>'email') = $2",
        [normalizedEmail],
        { limit: 1 },
      );
      const user = users[0];
      if (!user) return createEmptyDb();
      return normalizeDbData({
        users,
        profiles: await this.readRows(client, "profiles", "AND data->>'userId' = $2", [user.id], { limit: 1 }),
        passwordCredentials: await this.readRows(client, "passwordCredentials", "AND data->>'userId' = $2", [user.id], { limit: 1 }),
      });
    } finally {
      client.release();
    }
  }

  async savePasswordLoginWorkspace(userId: string, data: LocalDbData) {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const user of data.users.filter((entry) => entry.id === userId)) await upsertRecord(client, "users", user.id, user);
      for (const profile of data.profiles.filter((entry) => entry.userId === userId)) await upsertRecord(client, "profiles", profile.userId, profile);
      for (const credential of data.passwordCredentials.filter((entry) => entry.userId === userId)) await upsertRecord(client, "passwordCredentials", credential.userId, credential);
      for (const session of data.sessions.filter((entry) => entry.userId === userId)) await upsertRecord(client, "sessions", session.id, session);
      await client.query("COMMIT");
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async readAccountRestrictions(userId: string) {
    await this.init();
    const client = await this.pool.connect();
    try {
      return await this.readRows(client, "accountRestrictions", "AND data->>'userId' = $2", [userId]);
    } finally {
      client.release();
    }
  }

  async listAdventureRecords(ownerUserId: string) {
    await this.init();
    const client = await this.pool.connect();
    try {
      const records = await this.readRows(client, "adventures", "AND data->>'ownerUserId' = $2", [ownerUserId]);
      return records.map(normalizeAdventureRecord);
    } finally {
      client.release();
    }
  }

  async readAdventureRecord(ownerUserId: string, adventureId: string) {
    await this.init();
    const result = await this.pool.query<{ data: LocalDbData["adventures"][number] }>(`
      SELECT data FROM aist_records
      WHERE collection = 'adventures' AND id = $1 AND data->>'ownerUserId' = $2
      LIMIT 1
    `, [adventureId, ownerUserId]);
    return result.rows[0] ? normalizeAdventureRecord(result.rows[0].data) : undefined;
  }

  async saveAdventureRecord(ownerUserId: string, adventure: Adventure, source: "import" | "turn" | "manualSave" | "restore") {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existingResult = await client.query<{ data: LocalDbData["adventures"][number] }>(`
        SELECT data FROM aist_records
        WHERE collection = 'adventures' AND id = $1
        FOR UPDATE
      `, [adventure.id]);
      const existing = existingResult.rows[0]?.data ? normalizeAdventureRecord(existingResult.rows[0].data) : undefined;
      if (existing && existing.ownerUserId !== ownerUserId) throw new Error("Adventure not found.");
      const expectedRevision = adventureServerRevision(adventure);
      const currentRevision = existing?.revision ?? 0;
      if (existing && expectedRevision !== undefined && expectedRevision !== currentRevision) {
        throw new StaleAdventureRevisionError(expectedRevision, currentRevision);
      }
      const revision = currentRevision + 1;
      const now = nowIso();
      const cleanAdventure = withAdventureServerRevision(
        normalizeAdventure(sanitizeAdventureForPersistence(adventure)),
        revision,
      );
      const record: LocalDbData["adventures"][number] = {
        id: cleanAdventure.id,
        ownerUserId,
        adventure: cleanAdventure,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        revision,
      };
      await client.query(`
        INSERT INTO aist_records (collection, id, data, updated_at)
        VALUES ('adventures', $1, $2::jsonb, now())
        ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = now()
      `, [record.id, JSON.stringify(record)]);
      const snapshot = {
        id: createId("snapshot"),
        adventureId: record.id,
        userId: ownerUserId,
        source,
        adventure: cleanAdventure,
        createdAt: now,
      };
      await client.query(`
        INSERT INTO aist_records (collection, id, data, updated_at)
        VALUES ('adventureSnapshots', $1, $2::jsonb, now())
      `, [snapshot.id, JSON.stringify(snapshot)]);
      await client.query(`
        DELETE FROM aist_records
        WHERE collection = 'adventureSnapshots'
          AND data->>'userId' = $1
          AND data->>'adventureId' = $2
          AND id NOT IN (
            SELECT id FROM aist_records
            WHERE collection = 'adventureSnapshots'
              AND data->>'userId' = $1
              AND data->>'adventureId' = $2
            ORDER BY data->>'createdAt' DESC, id DESC
            LIMIT $3
          )
      `, [ownerUserId, record.id, MAX_SNAPSHOTS_PER_ADVENTURE]);
      await client.query("COMMIT");
      return record;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteAdventureRecord(ownerUserId: string, adventureId: string) {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const deleted = await client.query(
        "DELETE FROM aist_records WHERE collection = 'adventures' AND id = $1 AND data->>'ownerUserId' = $2",
        [adventureId, ownerUserId],
      );
      if ((deleted.rowCount ?? 0) > 0) {
        await client.query(
          "DELETE FROM aist_records WHERE collection = 'adventureSnapshots' AND data->>'userId' = $1 AND data->>'adventureId' = $2",
          [ownerUserId, adventureId],
        );
      }
      await client.query("COMMIT");
      return (deleted.rowCount ?? 0) > 0;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async loadAdventureWorkspace(ownerUserId: string, adventureId: string) {
    await this.init();
    const client = await this.pool.connect();
    try {
      const adventureRows = await this.readRows(
        client,
        "adventures",
        "AND id = $2 AND data->>'ownerUserId' = $3",
        [adventureId, ownerUserId],
        { limit: 1 },
      );
      const adventure = adventureRows[0] ? normalizeAdventureRecord(adventureRows[0]) : undefined;
      if (!adventure) throw new Error("Adventure not found.");
      const data = normalizeDbData({
        users: await this.readRows(client, "users", "AND id = $2", [ownerUserId]),
        profiles: await this.readRows(client, "profiles", "AND id = $2", [ownerUserId]),
        adventures: [adventure],
        adventureSnapshots: await this.readRows(
          client,
          "adventureSnapshots",
          "AND data->>'userId' = $2 AND data->>'adventureId' = $3",
          [ownerUserId, adventureId],
          { orderByCreatedDesc: true, limit: MAX_SNAPSHOTS_PER_ADVENTURE },
        ),
        accountSafetyEvents: await this.readRows(
          client,
          "accountSafetyEvents",
          "AND data->>'userId' = $2 AND data->>'status' = 'open' AND COALESCE((data->>'severity')::int, 0) >= 4",
          [ownerUserId],
          { orderByCreatedDesc: true, limit: 3 },
        ),
        accountRestrictions: await this.readRows(
          client,
          "accountRestrictions",
          "AND data->>'userId' = $2",
          [ownerUserId],
          { orderByCreatedDesc: true, limit: 1 },
        ),
        platformSettings: await this.readRows(client, "platformSettings"),
      });
      return { data, baseRevision: adventure.revision };
    } finally {
      client.release();
    }
  }

  async saveAdventureWorkspace(ownerUserId: string, adventureId: string, baseRevision: number, data: LocalDbData) {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query<{ data: LocalDbData["adventures"][number] }>(`
        SELECT data FROM aist_records
        WHERE collection = 'adventures' AND id = $1 AND data->>'ownerUserId' = $2
        FOR UPDATE
      `, [adventureId, ownerUserId]);
      const current = currentResult.rows[0]?.data ? normalizeAdventureRecord(currentResult.rows[0].data) : undefined;
      if (!current) throw new Error("Adventure not found.");
      const next = data.adventures.find((entry) => entry.id === adventureId && entry.ownerUserId === ownerUserId);
      if (!next) throw new Error("Adventure operation removed its source adventure unexpectedly.");
      if (current.revision !== baseRevision && next.revision !== baseRevision) {
        throw new StaleAdventureRevisionError(baseRevision, current.revision);
      }
      if (next.revision !== baseRevision) {
        if (current.revision !== baseRevision) throw new StaleAdventureRevisionError(baseRevision, current.revision);
        await upsertRecord(client, "adventures", next.id, next);
      }
      const existingSnapshots = await this.readRows(
        client,
        "adventureSnapshots",
        "AND data->>'userId' = $2 AND data->>'adventureId' = $3",
        [ownerUserId, adventureId],
        { orderByCreatedDesc: true, limit: MAX_SNAPSHOTS_PER_ADVENTURE },
      );
      const existingSnapshotsById = new Map(existingSnapshots.map((snapshot) => [snapshot.id, snapshot]));
      for (const snapshot of data.adventureSnapshots.filter((entry) => entry.userId === ownerUserId && entry.adventureId === adventureId)) {
        if (JSON.stringify(existingSnapshotsById.get(snapshot.id)) === JSON.stringify(snapshot)) continue;
        await upsertRecord(client, "adventureSnapshots", snapshot.id, snapshot);
      }
      for (const collection of [
        "contextBuildEvents",
        "policyDecisions",
        "accountSafetyEvents",
        "accountRestrictions",
        "accountStatusHistory",
        "usageLogs",
        "performanceTraces",
      ] as const) {
        for (const record of data[collection]) {
          await upsertRecord(client, collection, recordIdForCollection(collection, record as never), record);
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async loadAccountWorkspace(userId: string) {
    await this.init();
    const client = await this.pool.connect();
    try {
      return normalizeDbData({
        users: await this.readRows(client, "users", "AND id = $2", [userId]),
        profiles: await this.readRows(client, "profiles", "AND id = $2", [userId]),
        accountSafetyEvents: await this.readRows(
          client,
          "accountSafetyEvents",
          "AND data->>'userId' = $2 AND data->>'status' = 'open' AND COALESCE((data->>'severity')::int, 0) >= 4",
          [userId],
          { orderByCreatedDesc: true, limit: 3 },
        ),
        accountRestrictions: await this.readRows(
          client,
          "accountRestrictions",
          "AND data->>'userId' = $2",
          [userId],
          { orderByCreatedDesc: true, limit: 1 },
        ),
        platformSettings: await this.readRows(client, "platformSettings"),
      });
    } finally {
      client.release();
    }
  }

  async saveAccountWorkspace(_userId: string, data: LocalDbData) {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const collection of [
        "policyDecisions",
        "accountSafetyEvents",
        "accountRestrictions",
        "accountStatusHistory",
        "usageLogs",
        "performanceTraces",
      ] as const) {
        for (const record of data[collection]) {
          await upsertRecord(client, collection, recordIdForCollection(collection, record as never), record);
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async claimIdempotency(userId: string, operation: string, key: string, requestHash: string, expiresAt: string) {
    await this.init();
    await this.pool.query("DELETE FROM aist_idempotency WHERE expires_at <= now()");
    const inserted = await this.pool.query(`
      INSERT INTO aist_idempotency (user_id, operation, idempotency_key, request_hash, state, expires_at)
      VALUES ($1, $2, $3, $4, 'pending', $5::timestamptz)
      ON CONFLICT DO NOTHING
      RETURNING state
    `, [userId, operation, key, requestHash, expiresAt]);
    if ((inserted.rowCount ?? 0) > 0) return { state: "claimed" as const };
    const existing = await this.pool.query<{
      requestHash: string;
      state: "pending" | "succeeded" | "failed";
      responseStatus: number | null;
      responseBody: unknown;
    }>(`
      SELECT request_hash AS "requestHash", state, response_status AS "responseStatus", response_body AS "responseBody"
      FROM aist_idempotency
      WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3
    `, [userId, operation, key]);
    const row = existing.rows[0];
    if (!row) throw new Error("Idempotency claim disappeared unexpectedly.");
    if (row.requestHash !== requestHash) throw new Error("Idempotency key was already used with a different request body.");
    return {
      state: row.state,
      responseStatus: row.responseStatus ?? undefined,
      responseBody: row.responseBody,
    };
  }

  async completeIdempotency(userId: string, operation: string, key: string, state: "succeeded" | "failed", responseStatus: number, responseBody: unknown) {
    await this.init();
    await this.pool.query(`
      UPDATE aist_idempotency
      SET state = $4, response_status = $5, response_body = $6::jsonb, updated_at = now()
      WHERE user_id = $1 AND operation = $2 AND idempotency_key = $3
    `, [userId, operation, key, state, responseStatus, JSON.stringify(responseBody)]);
  }

  async consumeRateLimit(bucketKey: string, limit: number, windowMs: number) {
    await this.init();
    const now = Date.now();
    const windowStartedAt = new Date(Math.floor(now / windowMs) * windowMs).toISOString();
    const expiresAt = new Date(Math.floor(now / windowMs) * windowMs + windowMs).toISOString();
    const result = await this.pool.query<{ requestCount: number }>(`
      INSERT INTO aist_rate_limits (bucket_key, window_started_at, request_count, expires_at)
      VALUES ($1, $2::timestamptz, 1, $3::timestamptz)
      ON CONFLICT (bucket_key, window_started_at) DO UPDATE
        SET request_count = aist_rate_limits.request_count + 1
        WHERE aist_rate_limits.request_count < $4
      RETURNING request_count AS "requestCount"
    `, [bucketKey, windowStartedAt, expiresAt, limit]);
    await this.pool.query("DELETE FROM aist_rate_limits WHERE expires_at <= now()");
    return {
      allowed: (result.rowCount ?? 0) > 0,
      retryAfterSeconds: Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)),
    };
  }

  async read(options: BackendReadOptions = {}): Promise<LocalDbData> {
    await this.init();
    const client = await this.pool.connect();
    try {
      return await this.readWithClient(client, {
        includeAdventureSnapshots: options.includeAdventureSnapshots === true,
      });
    } finally {
      client.release();
    }
  }

  async write(data: LocalDbData): Promise<void> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.lock(client);
      await this.writeWithClient(client, normalizeDbData(data));
      await client.query("COMMIT");
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async update<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    return this.updateInTransaction(async (data) => {
      const result = await mutate(data);
      return { result, data };
    });
  }

  async updateAuth<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    return this.updateInTransaction(async (data) => {
      const result = await mutate(data);
      return { result, data };
    }, true);
  }

  async updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const data = await this.readWithClient(client);
      const before = structuredClone(data);
      try {
        const result = await mutate(data);
        await this.writeDiffWithClient(client, before, normalizeDbData(data));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await this.writeDiffWithClient(client, before, normalizeDbData(data));
        await client.query("COMMIT");
        throw error;
      }
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async recordPerformanceTrace(record: PerformanceTraceRecord): Promise<void> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query(
        `
        INSERT INTO aist_records (collection, id, data, updated_at)
        VALUES ('performanceTraces', $1, $2::jsonb, now())
        ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = now();
        `,
        [record.id, JSON.stringify(record)],
      );
      await client.query(
        `
        DELETE FROM aist_records
        WHERE collection = 'performanceTraces'
          AND id NOT IN (
            SELECT id
            FROM aist_records
            WHERE collection = 'performanceTraces'
            ORDER BY data->>'createdAt' DESC, id DESC
            LIMIT $1
          );
        `,
        [MAX_PERFORMANCE_TRACES],
      );
    } finally {
      client.release();
    }
  }

  async cleanupLifecycle(): Promise<number> {
    await this.init();
    const records = await this.pool.query(`
      DELETE FROM aist_records
      WHERE
        (collection = 'sessions' AND (
          (data->>'expiresAt')::timestamptz < now() - interval '7 days'
          OR (data ? 'revokedAt' AND (data->>'revokedAt')::timestamptz < now() - interval '7 days')
        ))
        OR (collection = 'verificationTokens' AND (data->>'expiresAt')::timestamptz < now() - interval '7 days')
        OR (collection IN ('oauthStates', 'oauthExchangeCodes') AND (data->>'expiresAt')::timestamptz < now() - interval '1 day')
        OR (collection IN ('performanceTraces', 'contextBuildEvents') AND (data->>'createdAt')::timestamptz < now() - interval '30 days')
        OR (collection IN ('policyDecisions', 'accountSafetyEvents', 'usageLogs') AND (data->>'createdAt')::timestamptz < now() - interval '365 days')
        OR (collection = 'adminActions' AND (data->>'createdAt')::timestamptz < now() - interval '730 days')
    `);
    const idempotency = await this.pool.query("DELETE FROM aist_idempotency WHERE expires_at < now()");
    const rateLimits = await this.pool.query("DELETE FROM aist_rate_limits WHERE expires_at < now()");
    return (records.rowCount ?? 0) + (idempotency.rowCount ?? 0) + (rateLimits.rowCount ?? 0);
  }

  async readProfileSummary(userId: string): Promise<BackendProfileSummary> {
    await this.init();
    const client = await this.pool.connect();
    try {
      const data = normalizeDbData({
        users: await this.readRows(client, "users", "AND id = $2", [userId]),
        profiles: await this.readRows(client, "profiles", "AND id = $2", [userId]),
        adventures: await this.readRows(client, "adventures", "AND data->>'ownerUserId' = $2", [userId]),
        scenarioDrafts: await this.readRows(client, "scenarioDrafts", "AND data->>'ownerUserId' = $2", [userId]),
        scenarioRevisions: await this.readRows(client, "scenarioRevisions", "AND data->>'ownerUserId' = $2", [userId]),
      });
      return buildProfileSummary(data, userId);
    } finally {
      client.release();
    }
  }

  async readPublicProfileSummary(userId: string): Promise<PublicProfileSummary> {
    await this.init();
    const client = await this.pool.connect();
    try {
      const data = normalizeDbData({
        users: await this.readRows(client, "users", "AND id = $2", [userId]),
        profiles: await this.readRows(client, "profiles", "AND id = $2", [userId]),
        adventures: await this.readRows(client, "adventures", "AND data->>'ownerUserId' = $2", [userId]),
        scenarioDrafts: await this.readRows(client, "scenarioDrafts", "AND data->>'ownerUserId' = $2", [userId]),
        scenarioRevisions: await this.readRows(
          client,
          "scenarioRevisions",
          "AND data->>'ownerUserId' = $2 AND data->>'status' = 'published' AND data ? 'publishedAt'",
          [userId],
        ),
      });
      return buildPublicProfileSummary(data, userId);
    } finally {
      client.release();
    }
  }

  async readExploreScenarios(): Promise<ExploreScenarioSummary[]> {
    await this.init();
    const client = await this.pool.connect();
    try {
      const data = normalizeDbData({
        profiles: await this.readRows(client, "profiles"),
        adventures: await this.readRows(client, "adventures"),
        scenarioDrafts: await this.readRows(client, "scenarioDrafts"),
        scenarioRevisions: await this.readRows(
          client,
          "scenarioRevisions",
          "AND data->>'status' = 'published' AND data ? 'publishedAt'",
        ),
      });
      return listExploreScenarios(data);
    } finally {
      client.release();
    }
  }

  async readAdventureSnapshotSummaries(ownerUserId: string, adventureId: string): Promise<AdventureSnapshotSummary[]> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await this.assertOwnsAdventure(client, ownerUserId, adventureId);
      const result = await client.query<SnapshotSummaryRow>(
        `
        SELECT
          data->>'id' AS id,
          data->>'adventureId' AS "adventureId",
          data->>'source' AS source,
          data #>> '{adventure,title}' AS title,
          data->>'createdAt' AS "createdAt",
          data #>> '{adventure,updatedAt}' AS "adventureUpdatedAt",
          COALESCE((data #>> '{adventure,activeState,turn}')::int, 0) AS "turnCount",
          (
            SELECT count(*)::int
            FROM jsonb_array_elements(COALESCE(data #> '{adventure,messages}', '[]'::jsonb)) AS message(value)
            WHERE message.value->>'role' IN ('user', 'assistant')
          ) AS "storyEntryCount"
        FROM aist_records
        WHERE collection = 'adventureSnapshots'
          AND data->>'userId' = $1
          AND data->>'adventureId' = $2
        ORDER BY data->>'createdAt' DESC, id DESC;
        `,
        [ownerUserId, adventureId],
      );
      return result.rows.map((row) => ({
        id: row.id,
        adventureId: row.adventureId,
        source: row.source,
        title: row.title ?? "Untitled Adventure",
        createdAt: row.createdAt,
        adventureUpdatedAt: row.adventureUpdatedAt ?? row.createdAt,
        turnCount: toInt(row.turnCount),
        storyEntryCount: toInt(row.storyEntryCount),
      }));
    } finally {
      client.release();
    }
  }

  async readAdminConsoleSummary(config: ApiConfig): Promise<AdminConsoleData> {
    await this.init();
    const client = await this.pool.connect();
    try {
      const data = normalizeDbData({
        users: await this.readRows(client, "users"),
        profiles: await this.readRows(client, "profiles"),
        inviteLinks: await this.readRows(client, "inviteLinks"),
        adventures: await this.readRows(client, "adventures"),
        accountSafetyEvents: await this.readRows(client, "accountSafetyEvents"),
        accountRestrictions: await this.readRows(client, "accountRestrictions"),
        scenarioDrafts: await this.readRows(client, "scenarioDrafts"),
        scenarioRevisions: await this.readRows(client, "scenarioRevisions"),
        platformSettings: await this.readRows(client, "platformSettings"),
      });
      const consoleData = buildAdminConsole(data, config, { includeDetails: false });
      consoleData.totals.policyDecisions = await this.countRows(client, "policyDecisions");
      consoleData.totals.usageLogs = await this.countRows(client, "usageLogs");
      consoleData.totals.performanceTraces = await this.countRows(client, "performanceTraces");
      const usageStatsByUser = await this.readUsageStatsByUser(client);
      consoleData.users = consoleData.users.map((user) => ({
        ...user,
        usageStats: { ...emptyUserUsageStats(), ...usageStatsByUser.get(user.id) },
      }));
      return consoleData;
    } finally {
      client.release();
    }
  }

  async readAdminConsoleDetails(_config: ApiConfig): Promise<AdminConsoleDetailsData> {
    await this.init();
    const client = await this.pool.connect();
    try {
      const data = normalizeDbData({
        accountSafetyEvents: await this.readRows(client, "accountSafetyEvents", "", [], { orderByCreatedDesc: true, limit: 50 }),
        accountRestrictions: await this.readRows(client, "accountRestrictions", "", [], { orderByCreatedDesc: true, limit: 30 }),
        policyDecisions: await this.readRows(client, "policyDecisions", "", [], { orderByCreatedDesc: true, limit: 40 }),
        usageLogs: await this.readRows(client, "usageLogs", "", [], { orderByCreatedDesc: true, limit: 12 }),
        performanceTraces: await this.readRows(client, "performanceTraces", "", [], { orderByCreatedDesc: true, limit: 50 }),
        adminActions: await this.readRows(client, "adminActions", "", [], { orderByCreatedDesc: true, limit: 40 }),
      });
      return {
        ...buildAdminConsoleDetails(data),
        contextBuilds: await this.readContextBuildSummaries(client, 12),
      };
    } finally {
      client.release();
    }
  }

  async init(): Promise<void> {
    this.initPromise ??= this.assertSchemaCompatible();
    await this.initPromise;
  }

  private async updateInTransaction<T>(
    run: (data: LocalDbData) => Promise<{ result: T; data: LocalDbData }>,
    serializeAuth = false,
  ): Promise<T> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (serializeAuth) await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY + 1]);
      const data = await this.readWithClient(client);
      const before = structuredClone(data);
      const { result, data: nextData } = await run(data);
      await this.writeDiffWithClient(client, before, normalizeDbData(nextData));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  private async assertSchemaCompatible(): Promise<void> {
    try {
      const result = await this.pool.query<{ version: number }>("SELECT max(version)::int AS version FROM schema_migrations");
      const version = result.rows[0]?.version ?? 0;
      if (version !== CURRENT_SQL_SCHEMA_VERSION) {
        throw new Error(`Postgres schema version ${version} is incompatible; expected ${CURRENT_SQL_SCHEMA_VERSION}. Run npm run api:db:migrate.`);
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        throw new Error("Postgres schema is missing. Run npm run api:db:migrate before starting the API.");
      }
      throw error;
    }
  }

  private async readWithClient(
    client: pg.PoolClient,
    options: { includeAdventureSnapshots?: boolean } = { includeAdventureSnapshots: true },
  ): Promise<LocalDbData> {
    const empty = createEmptyDb();
    const metaResult = await client.query<{ value: DbMetadata }>("SELECT value FROM aist_meta WHERE key = 'metadata'");
    const metadata = metaResult.rows[0]?.value ?? metadataFromDb(empty);
    const data = normalizeDbData({
      schemaVersion: metadata.schemaVersion,
      migrations: metadata.migrations,
    });
    const params: unknown[] = [];
    const where = options.includeAdventureSnapshots ? "" : "WHERE collection <> $1";
    if (!options.includeAdventureSnapshots) params.push("adventureSnapshots");
    const records = await client.query<{ collection: DbCollectionKey; data: unknown }>(
      `SELECT collection, data FROM aist_records ${where} ORDER BY collection, id`,
      params,
    );
    for (const row of records.rows) {
      if (!isCollectionKey(row.collection)) continue;
      (data[row.collection] as unknown[]).push(row.data);
    }
    return normalizeDbData(data);
  }

  private async writeWithClient(client: pg.PoolClient, data: LocalDbData): Promise<void> {
    await client.query(
      `
      INSERT INTO aist_meta (key, value, updated_at)
      VALUES ('metadata', $1::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
      `,
      [JSON.stringify(metadataFromDb(data))],
    );
    for (const collection of dbCollectionKeys) {
      await client.query("DELETE FROM aist_records WHERE collection = $1", [collection]);
      for (const record of data[collection]) {
        await client.query(
          `
          INSERT INTO aist_records (collection, id, data, updated_at)
          VALUES ($1, $2, $3::jsonb, now());
          `,
          [collection, recordIdForCollection(collection, record as never), JSON.stringify(record)],
        );
      }
    }
  }

  private async writeDiffWithClient(client: pg.PoolClient, before: LocalDbData, after: LocalDbData): Promise<void> {
    if (JSON.stringify(metadataFromDb(before)) !== JSON.stringify(metadataFromDb(after))) {
      await client.query(
        `
        INSERT INTO aist_meta (key, value, updated_at)
        VALUES ('metadata', $1::jsonb, now())
        ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
        `,
        [JSON.stringify(metadataFromDb(after))],
      );
    }
    for (const collection of dbCollectionKeys) {
      const beforeById = new Map(before[collection].map((record) => [
        recordIdForCollection(collection, record as never),
        record,
      ]));
      const afterById = new Map(after[collection].map((record) => [
        recordIdForCollection(collection, record as never),
        record,
      ]));
      for (const [id, record] of afterById) {
        if (JSON.stringify(beforeById.get(id)) === JSON.stringify(record)) continue;
        await upsertRecord(client, collection, id, record);
      }
      const removedIds = [...beforeById.keys()].filter((id) => !afterById.has(id));
      if (removedIds.length > 0) {
        await client.query(
          "DELETE FROM aist_records WHERE collection = $1 AND id = ANY($2::text[])",
          [collection, removedIds],
        );
      }
    }
  }

  private async lock(client: pg.PoolClient): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_KEY]);
  }

  private async readRows<K extends DbCollectionKey>(
    client: pg.PoolClient,
    collection: K,
    filterSql = "",
    filterParams: unknown[] = [],
    options: ReadRowsOptions = {},
  ): Promise<LocalDbData[K]> {
    const values: unknown[] = [collection, ...filterParams];
    const orderSql = options.orderByCreatedDesc ? "ORDER BY data->>'createdAt' DESC, id DESC" : "ORDER BY id";
    const limitSql = typeof options.limit === "number" ? `LIMIT $${values.push(options.limit)}` : "";
    const result = await client.query<{ data: unknown }>(
      `SELECT data FROM aist_records WHERE collection = $1 ${filterSql} ${orderSql} ${limitSql}`,
      values,
    );
    return result.rows.map((row) => row.data) as LocalDbData[K];
  }

  private async countRows(
    client: pg.PoolClient,
    collection: DbCollectionKey,
    filterSql = "",
    filterParams: unknown[] = [],
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM aist_records WHERE collection = $1 ${filterSql}`,
      [collection, ...filterParams],
    );
    return toInt(result.rows[0]?.count);
  }

  private async assertOwnsAdventure(client: pg.PoolClient, ownerUserId: string, adventureId: string): Promise<void> {
    const result = await client.query(
      `
      SELECT 1
      FROM aist_records
      WHERE collection = 'adventures'
        AND id = $1
        AND data->>'ownerUserId' = $2
      LIMIT 1;
      `,
      [adventureId, ownerUserId],
    );
    if (result.rowCount === 0) throw new Error("Adventure not found.");
  }

  private async readContextBuildSummaries(
    client: pg.PoolClient,
    limit: number,
  ): Promise<AdminConsoleDetailsData["contextBuilds"]> {
    const result = await client.query<ContextBuildSummaryRow>(
      `
      SELECT
        data->>'id' AS id,
        data->>'userId' AS "userId",
        data->>'adventureId' AS "adventureId",
        data->>'gate' AS gate,
        data->>'createdAt' AS "createdAt",
        COALESCE(jsonb_array_length(COALESCE(data #> '{context,messages}', '[]'::jsonb)), 0) AS "messageCount",
        COALESCE((
          SELECT count(*)::int
          FROM jsonb_array_elements(COALESCE(data #> '{context,sections}', '[]'::jsonb)) AS section(value)
          WHERE jsonb_array_length(COALESCE(section.value->'items', '[]'::jsonb)) > 0
        ), 0) AS "sectionCount",
        COALESCE((data #>> '{context,totalEstimatedTokens}')::int, 0) AS "totalEstimatedTokens",
        COALESCE(jsonb_array_length(COALESCE(data #> '{context,excludedItems}', '[]'::jsonb)), 0) AS "excludedItemCount",
        COALESCE(jsonb_array_length(COALESCE(data #> '{context,decisions}', '[]'::jsonb)), 0) AS "decisionCount"
      FROM aist_records
      WHERE collection = 'contextBuildEvents'
      ORDER BY data->>'createdAt' DESC, id DESC
      LIMIT $1;
      `,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      adventureId: row.adventureId,
      gate: row.gate,
      createdAt: row.createdAt,
      messageCount: toInt(row.messageCount),
      sectionCount: toInt(row.sectionCount),
      totalEstimatedTokens: toInt(row.totalEstimatedTokens),
      excludedItemCount: toInt(row.excludedItemCount),
      decisionCount: toInt(row.decisionCount),
      }));
  }

  private async readUsageStatsByUser(client: pg.PoolClient): Promise<Map<string, AdminUserUsageStats>> {
    const result = await client.query<UserUsageStatsRow>(
      `
      SELECT
        data->>'userId' AS "userId",
        count(*)::text AS "usageLogCount",
        COALESCE(sum(NULLIF(data #>> '{usage,promptTokens}', '')::numeric), 0)::text AS "promptTokens",
        COALESCE(sum(NULLIF(data #>> '{usage,completionTokens}', '')::numeric), 0)::text AS "completionTokens",
        COALESCE(sum(COALESCE(
          NULLIF(data #>> '{usage,totalTokens}', '')::numeric,
          (NULLIF(data #>> '{usage,promptTokens}', '')::numeric + NULLIF(data #>> '{usage,completionTokens}', '')::numeric),
          0
        )), 0)::text AS "totalTokens",
        COALESCE(sum(NULLIF(data #>> '{usage,cacheReadTokens}', '')::numeric), 0)::text AS "cacheReadTokens",
        COALESCE(sum(NULLIF(data #>> '{usage,cacheCreationTokens}', '')::numeric), 0)::text AS "cacheCreationTokens",
        COALESCE(sum(NULLIF(data->>'durationMs', '')::numeric), 0)::text AS "totalDurationMs",
        max(data->>'createdAt') AS "lastUsedAt"
      FROM aist_records
      WHERE collection = 'usageLogs'
      GROUP BY data->>'userId';
      `,
    );
    return new Map(result.rows.map((row) => [row.userId, {
      usageLogCount: toInt(row.usageLogCount),
      promptTokens: toInt(row.promptTokens),
      completionTokens: toInt(row.completionTokens),
      totalTokens: toInt(row.totalTokens),
      cacheReadTokens: toInt(row.cacheReadTokens),
      cacheCreationTokens: toInt(row.cacheCreationTokens),
      totalDurationMs: toInt(row.totalDurationMs),
      lastUsedAt: row.lastUsedAt ?? undefined,
    }]));
  }
}

export function postgresSummary(data: LocalDbData): string {
  return `${countDbRecords(data)} record(s) across ${dbCollectionKeys.length} collection(s)`;
}

function metadataFromDb(data: LocalDbData): DbMetadata {
  return {
    schemaVersion: data.schemaVersion,
    migrations: data.migrations,
  };
}

function isCollectionKey(value: string): value is DbCollectionKey {
  return (dbCollectionKeys as readonly string[]).includes(value);
}

async function rollbackQuietly(client: pg.PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The original error is more useful than rollback cleanup noise.
  }
}

function toInt(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isMissingRelationError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "42P01");
}

function normalizeAdventureRecord(record: LocalDbData["adventures"][number]): LocalDbData["adventures"][number] {
  const revision = record.revision ?? 0;
  return {
    ...record,
    revision,
    adventure: withAdventureServerRevision(normalizeAdventure(record.adventure), revision),
  };
}

async function upsertRecord(
  client: pg.PoolClient,
  collection: DbCollectionKey,
  id: string,
  record: unknown,
): Promise<void> {
  await client.query(`
    INSERT INTO aist_records (collection, id, data, updated_at)
    VALUES ($1, $2, $3::jsonb, now())
    ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = now()
  `, [collection, id, JSON.stringify(record)]);
}
