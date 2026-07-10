import type { LocalDbData } from "./apiTypes";
import { nowIso } from "./ids";

export const CURRENT_SCHEMA_VERSION = 1;

export const dbCollectionKeys = [
  "users",
  "profiles",
  "authIdentities",
  "passwordCredentials",
  "inviteLinks",
  "signupIntents",
  "sessions",
  "verificationTokens",
  "oauthStates",
  "oauthExchangeCodes",
  "adventures",
  "adventureSnapshots",
  "contextBuildEvents",
  "policyDecisions",
  "accountSafetyEvents",
  "accountRestrictions",
  "accountStatusHistory",
  "scenarioDrafts",
  "scenarioRevisions",
  "shareLinks",
  "usageLogs",
  "performanceTraces",
  "adminActions",
  "platformSettings",
] as const satisfies readonly (keyof LocalDbData)[];

export type DbCollectionKey = typeof dbCollectionKeys[number];
export type DbCollectionValue<K extends DbCollectionKey> = LocalDbData[K] extends Array<infer T> ? T : never;

export function createEmptyDb(): LocalDbData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migrations: [{ version: 1, name: "initial-backend-schema", appliedAt: nowIso() }],
    users: [],
    profiles: [],
    authIdentities: [],
    passwordCredentials: [],
    inviteLinks: [],
    signupIntents: [],
    sessions: [],
    verificationTokens: [],
    oauthStates: [],
    oauthExchangeCodes: [],
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
    performanceTraces: [],
    adminActions: [],
    platformSettings: [],
  };
}

export function normalizeDbData(raw: Partial<LocalDbData>): LocalDbData {
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
    oauthExchangeCodes: raw.oauthExchangeCodes ?? [],
    adventures: (raw.adventures ?? []).map((record) => ({ ...record, revision: record.revision ?? 0 })),
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
    performanceTraces: raw.performanceTraces ?? [],
    adminActions: raw.adminActions ?? [],
    platformSettings: raw.platformSettings ?? [],
  };
  if (merged.schemaVersion < CURRENT_SCHEMA_VERSION) {
    merged.schemaVersion = CURRENT_SCHEMA_VERSION;
    merged.migrations.push({ version: CURRENT_SCHEMA_VERSION, name: "auto-upgrade-backend-schema", appliedAt: nowIso() });
  }
  return merged;
}

export function recordIdForCollection<K extends DbCollectionKey>(collection: K, record: DbCollectionValue<K>): string {
  if (collection === "profiles") return String((record as { userId: string }).userId);
  if (collection === "passwordCredentials") return String((record as { userId: string }).userId);
  if (collection === "platformSettings") {
    const settings = record as { id?: string; key?: string };
    return String(settings.id ?? settings.key);
  }
  return String((record as { id: string }).id);
}

export function countDbRecords(data: LocalDbData): number {
  return dbCollectionKeys.reduce((sum, key) => sum + data[key].length, 0);
}
