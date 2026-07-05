import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LocalDbData } from "./apiTypes";
import { nowIso } from "./ids";

const CURRENT_SCHEMA_VERSION = 1;

export function createEmptyDb(): LocalDbData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migrations: [{ version: 1, name: "initial-local-json-schema", appliedAt: nowIso() }],
    users: [],
    profiles: [],
    authIdentities: [],
    passwordCredentials: [],
    inviteLinks: [],
    signupIntents: [],
    sessions: [],
    verificationTokens: [],
    oauthStates: [],
    adventures: [],
    adventureSnapshots: [],
    contextBuildEvents: [],
    policyDecisions: [],
    accountSafetyEvents: [],
    accountRestrictions: [],
    accountStatusHistory: [],
    scenarioDrafts: [],
    scenarioRevisions: [],
    shareLinks: [],
    usageLogs: [],
    adminActions: [],
    platformSettings: [],
  };
}

export class LocalDb {
  private readonly filePath: string;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  async read(): Promise<LocalDbData> {
    try {
      const text = await readFile(this.filePath, "utf8");
      return migrate(JSON.parse(text) as Partial<LocalDbData>);
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

  private async persist(data: LocalDbData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}

function migrate(raw: Partial<LocalDbData>): LocalDbData {
  const empty = createEmptyDb();
  const merged: LocalDbData = {
    ...empty,
    ...raw,
    schemaVersion: raw.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    migrations: Array.isArray(raw.migrations) && raw.migrations.length > 0 ? raw.migrations : empty.migrations,
    users: raw.users ?? [],
    profiles: raw.profiles ?? [],
    authIdentities: raw.authIdentities ?? [],
    passwordCredentials: raw.passwordCredentials ?? [],
    inviteLinks: raw.inviteLinks ?? [],
    signupIntents: raw.signupIntents ?? [],
    sessions: raw.sessions ?? [],
    verificationTokens: raw.verificationTokens ?? [],
    oauthStates: raw.oauthStates ?? [],
    adventures: raw.adventures ?? [],
    adventureSnapshots: raw.adventureSnapshots ?? [],
    contextBuildEvents: raw.contextBuildEvents ?? [],
    policyDecisions: raw.policyDecisions ?? [],
    accountSafetyEvents: raw.accountSafetyEvents ?? [],
    accountRestrictions: raw.accountRestrictions ?? [],
    accountStatusHistory: raw.accountStatusHistory ?? [],
    scenarioDrafts: raw.scenarioDrafts ?? [],
    scenarioRevisions: raw.scenarioRevisions ?? [],
    shareLinks: raw.shareLinks ?? [],
    usageLogs: raw.usageLogs ?? [],
    adminActions: raw.adminActions ?? [],
    platformSettings: raw.platformSettings ?? [],
  };
  if (merged.schemaVersion < CURRENT_SCHEMA_VERSION) {
    merged.schemaVersion = CURRENT_SCHEMA_VERSION;
    merged.migrations.push({ version: CURRENT_SCHEMA_VERSION, name: "auto-upgrade-local-json-schema", appliedAt: nowIso() });
  }
  return merged;
}
