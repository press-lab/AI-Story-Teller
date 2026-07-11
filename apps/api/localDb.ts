import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LocalDbData, PerformanceTraceRecord } from "./apiTypes";
import type { BackendDb, BackendReadOptions } from "./backendDb";
import { createEmptyDb, normalizeDbData } from "./dbShape";
import { appendPerformanceTrace } from "./performanceTrace";
import { saveBackendAdventure } from "./adventureStore";
import type { Adventure } from "../../src/types/adventure";

export { createEmptyDb };

export class LocalDb implements BackendDb {
  private readonly filePath: string;
  private writeChain: Promise<unknown> = Promise.resolve();
  private readonly idempotency = new Map<string, { requestHash: string; state: "pending" | "succeeded" | "failed"; responseStatus?: number; responseBody?: unknown; expiresAt: string }>();
  private readonly rateLimits = new Map<string, { count: number; expiresAt: number }>();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  async read(_options: BackendReadOptions = {}): Promise<LocalDbData> {
    try {
      const text = await readFile(this.filePath, "utf8");
      return normalizeDbData(JSON.parse(text) as Partial<LocalDbData>);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        return createEmptyDb();
      }
      throw error;
    }
  }

  async write(data: LocalDbData): Promise<void> {
    this.writeChain = this.writeChain.then(() => this.persist(data));
    await this.writeChain;
  }

  async update<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    const run = this.writeChain.then(async () => {
      const data = await this.read();
      const result = await mutate(data);
      await this.persist(data);
      return result;
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    const run = this.writeChain.then(async () => {
      const data = await this.read();
      try {
        const result = await mutate(data);
        await this.persist(data);
        return result;
      } catch (error) {
        await this.persist(data);
        throw error;
      }
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async readiness() {
    const data = await this.read();
    return { database: "local-json" as const, schemaVersion: data.schemaVersion };
  }

  async resolveSessionByTokenHash(tokenHash: string) {
    const data = await this.read();
    const session = data.sessions.find((entry) => entry.tokenHash === tokenHash && !entry.revokedAt && new Date(entry.expiresAt).getTime() > Date.now());
    if (!session) return undefined;
    const user = data.users.find((entry) => entry.id === session.userId);
    const profile = data.profiles.find((entry) => entry.userId === session.userId);
    return user && profile ? { session, user, profile } : undefined;
  }

  async revokeSessionByTokenHash(tokenHash: string) {
    return this.update((data) => {
      const session = data.sessions.find((entry) => entry.tokenHash === tokenHash && !entry.revokedAt);
      if (!session) return false;
      session.revokedAt = new Date().toISOString();
      return true;
    });
  }

  async readAccountRestrictions(userId: string) {
    return (await this.read()).accountRestrictions.filter((entry) => entry.userId === userId);
  }

  async listAdventureRecords(ownerUserId: string) {
    return (await this.read()).adventures.filter((entry) => entry.ownerUserId === ownerUserId);
  }

  async readAdventureRecord(ownerUserId: string, adventureId: string) {
    return (await this.read()).adventures.find((entry) => entry.ownerUserId === ownerUserId && entry.id === adventureId);
  }

  async saveAdventureRecord(ownerUserId: string, adventure: Adventure, source: "import" | "turn" | "manualSave" | "restore") {
    return this.update((data) => saveBackendAdventure(data, ownerUserId, adventure, source));
  }

  async deleteAdventureRecord(ownerUserId: string, adventureId: string) {
    return this.update((data) => {
      const before = data.adventures.length;
      data.adventures = data.adventures.filter((entry) => !(entry.ownerUserId === ownerUserId && entry.id === adventureId));
      data.adventureSnapshots = data.adventureSnapshots.filter((entry) => !(entry.userId === ownerUserId && entry.adventureId === adventureId));
      return data.adventures.length < before;
    });
  }

  async loadAdventureWorkspace(ownerUserId: string, adventureId: string) {
    const data = await this.read({ includeAdventureSnapshots: true });
    const record = data.adventures.find((entry) => entry.ownerUserId === ownerUserId && entry.id === adventureId);
    if (!record) throw new Error("Adventure not found.");
    return { data, baseRevision: record.revision };
  }

  async saveAdventureWorkspace(ownerUserId: string, adventureId: string, baseRevision: number, workspace: LocalDbData) {
    await this.update((current) => {
      const currentRecord = current.adventures.find((entry) => entry.ownerUserId === ownerUserId && entry.id === adventureId);
      if (!currentRecord) throw new Error("Adventure not found.");
      const nextRecord = workspace.adventures.find((entry) => entry.ownerUserId === ownerUserId && entry.id === adventureId);
      if (!nextRecord) throw new Error("Adventure operation removed its source adventure unexpectedly.");
      if (currentRecord.revision !== baseRevision && nextRecord.revision !== baseRevision) {
        throw new Error(`Adventure changed on the server. Expected revision ${baseRevision}, current revision ${currentRecord.revision}.`);
      }
      if (nextRecord.revision !== baseRevision) {
        if (currentRecord.revision !== baseRevision) {
          throw new Error(`Adventure changed on the server. Expected revision ${baseRevision}, current revision ${currentRecord.revision}.`);
        }
        current.adventures = current.adventures.map((entry) => entry === currentRecord ? nextRecord : entry);
      }
      current.adventureSnapshots = [
        ...current.adventureSnapshots.filter((entry) => !(entry.userId === ownerUserId && entry.adventureId === adventureId)),
        ...workspace.adventureSnapshots.filter((entry) => entry.userId === ownerUserId && entry.adventureId === adventureId),
      ];
      mergeWorkspaceEventCollections(current, workspace);
    });
  }

  async loadAccountWorkspace() {
    return this.read({ includeAdventureSnapshots: false });
  }

  async saveAccountWorkspace(_userId: string, workspace: LocalDbData) {
    await this.update((current) => mergeWorkspaceEventCollections(current, workspace));
  }

  async claimIdempotency(userId: string, operation: string, key: string, requestHash: string, expiresAt: string) {
    const mapKey = `${userId}:${operation}:${key}`;
    const existing = this.idempotency.get(mapKey);
    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      if (existing.requestHash !== requestHash) throw new Error("Idempotency key was already used with a different request body.");
      return { state: existing.state, responseStatus: existing.responseStatus, responseBody: existing.responseBody };
    }
    this.idempotency.set(mapKey, { requestHash, state: "pending", expiresAt });
    return { state: "claimed" as const };
  }

  async completeIdempotency(userId: string, operation: string, key: string, state: "succeeded" | "failed", responseStatus: number, responseBody: unknown) {
    const mapKey = `${userId}:${operation}:${key}`;
    const existing = this.idempotency.get(mapKey);
    if (existing) this.idempotency.set(mapKey, { ...existing, state, responseStatus, responseBody });
  }

  async consumeRateLimit(bucketKey: string, limit: number, windowMs: number) {
    const now = Date.now();
    const existing = this.rateLimits.get(bucketKey);
    const bucket = !existing || existing.expiresAt <= now ? { count: 0, expiresAt: now + windowMs } : existing;
    if (bucket.count >= limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)) };
    }
    bucket.count += 1;
    this.rateLimits.set(bucketKey, bucket);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  async recordPerformanceTrace(record: PerformanceTraceRecord): Promise<void> {
    const run = this.writeChain.then(async () => {
      const data = await this.read();
      appendPerformanceTrace(data, record);
      await this.persist(data);
    });
    this.writeChain = run.catch(() => undefined);
    await run;
  }

  private async persist(data: LocalDbData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async close(): Promise<void> {
    // Server responses can finish before non-blocking telemetry persistence.
    // Drain the serialized write queue so shutdown/tests do not remove the
    // backing directory while a final trace write is still in flight.
    await this.writeChain.catch(() => undefined);
  }
}

function mergeWorkspaceEventCollections(current: LocalDbData, workspace: LocalDbData): void {
  for (const collection of [
    "contextBuildEvents",
    "policyDecisions",
    "accountSafetyEvents",
    "accountRestrictions",
    "accountStatusHistory",
    "usageLogs",
    "performanceTraces",
  ] as const) {
    const target = current[collection] as Array<{ id: string }>;
    const incoming = workspace[collection] as Array<{ id: string }>;
    const byId = new Map(target.map((entry) => [entry.id, entry]));
    for (const entry of incoming) byId.set(entry.id, entry);
    target.splice(0, target.length, ...byId.values());
  }
}
