import pg from "pg";
import type { LocalDbData } from "./apiTypes";
import type { BackendDb } from "./backendDb";
import {
  countDbRecords,
  createEmptyDb,
  dbCollectionKeys,
  normalizeDbData,
  recordIdForCollection,
  type DbCollectionKey,
} from "./dbShape";

const { Pool } = pg;
const ADVISORY_LOCK_KEY = 4_263_117;

interface DbMetadata {
  schemaVersion: number;
  migrations: LocalDbData["migrations"];
}

export class PostgresDb implements BackendDb {
  private readonly pool: pg.Pool;
  private initPromise: Promise<void> | undefined;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async read(): Promise<LocalDbData> {
    await this.init();
    const client = await this.pool.connect();
    try {
      return await this.readWithClient(client);
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

  private async readWithClient(client: pg.PoolClient): Promise<LocalDbData> {
    const empty = createEmptyDb();
    const metaResult = await client.query<{ value: DbMetadata }>("SELECT value FROM aist_meta WHERE key = 'metadata'");
    const metadata = metaResult.rows[0]?.value ?? metadataFromDb(empty);
    const data = normalizeDbData({
      schemaVersion: metadata.schemaVersion,
      migrations: metadata.migrations,
    });
    const records = await client.query<{ collection: DbCollectionKey; data: unknown }>(
      "SELECT collection, data FROM aist_records ORDER BY collection, id",
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
