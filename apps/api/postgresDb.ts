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

const { Pool } = pg;
const ADVISORY_LOCK_KEY = 4_263_117;

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

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
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

  async updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.lock(client);
      const data = await this.readWithClient(client);
      try {
        const result = await mutate(data);
        await this.writeWithClient(client, normalizeDbData(data));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await this.writeWithClient(client, normalizeDbData(data));
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
    this.initPromise ??= this.createSchema();
    await this.initPromise;
  }

  private async updateInTransaction<T>(
    run: (data: LocalDbData) => Promise<{ result: T; data: LocalDbData }>,
  ): Promise<T> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.lock(client);
      const data = await this.readWithClient(client);
      const { result, data: nextData } = await run(data);
      await this.writeWithClient(client, normalizeDbData(nextData));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }

  private async createSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS aist_meta (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS aist_records (
        collection text NOT NULL,
        id text NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (collection, id)
      );
    `);
    await this.pool.query("CREATE INDEX IF NOT EXISTS aist_records_collection_idx ON aist_records (collection);");
    await this.pool.query(`
      INSERT INTO aist_meta (key, value)
      VALUES ('metadata', $1::jsonb)
      ON CONFLICT (key) DO NOTHING;
    `, [JSON.stringify(metadataFromDb(createEmptyDb()))]);
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
