import type { AdventureSummary } from "../db/adventureDb";
import type { Adventure } from "../types/adventure";
import { apiJson } from "./adventureStore";
import type { RuntimeConfig } from "./runtimeConfig";

export interface BackendUser {
  id: string;
  email: string;
  displayName: string;
  role?: "user" | "admin";
  status: "pending_verification" | "active" | "disabled";
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackendProfile {
  userId: string;
  displayName: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendSessionState {
  sessionToken: string;
  user: BackendUser;
  profile: BackendProfile;
  expiresAt?: string;
}

export interface BackendImportRequest {
  sourceType: "aist" | "aid" | "githubSave";
  text?: string;
  json?: unknown;
  title?: string;
  storyCardsText?: string;
  componentsText?: string;
}

export interface BackendPolicyDecision {
  id: string;
  gate: string;
  action: string;
  categories: string[];
  severity: number;
  createdAt: string;
}

export interface BackendSafetyEvent {
  id: string;
  userId: string;
  category: string;
  severity: number;
  gate: string;
  status: string;
  createdAt: string;
}

export interface BackendRestriction {
  id: string;
  userId: string;
  level: string;
  reason: string;
  sharingDisabled: boolean;
  generationDisabled: boolean;
  createdAt: string;
}

export interface BackendProfileScenarioSummary {
  id: string;
  title: string;
  description: string;
  sourceAdventureId?: string;
  createdAt: string;
  updatedAt: string;
  revisionCount: number;
  publishedRevisionCount: number;
  latestRevision?: {
    id: string;
    version: number;
    status: "draft" | "published" | "quarantined";
    createdAt: string;
    publishedAt?: string;
  };
}

export interface BackendProfileSummary {
  user: BackendUser;
  profile: BackendProfile;
  adventures: AdventureSummary[];
  scenarios: BackendProfileScenarioSummary[];
}

export interface BackendExploreScenarioSummary {
  scenarioId: string;
  revisionId: string;
  ownerUserId: string;
  ownerDisplayName: string;
  title: string;
  description: string;
  version: number;
  createdAt: string;
  publishedAt: string;
}

export interface BackendPlatformSettings {
  provider: {
    name: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    promptCaching?: boolean;
  };
  background: {
    semanticEvaluationEnabled: boolean;
    semanticEvalEveryNTurns: number;
    memoryDetectionEnabled: boolean;
    memoryDetectionEveryNTurns: number;
  };
  features: {
    scenarioPublishingEnabled: boolean;
    developerToolsVisibleToAdmins: boolean;
  };
  updatedAt?: string;
  updatedByUserId?: string;
}

function authHeaders(session?: BackendSessionState): Record<string, string> {
  return session?.sessionToken ? { Authorization: `Bearer ${session.sessionToken}` } : {};
}

export function createBackendInvite(config: RuntimeConfig, input: { note?: string; maxUses?: number; expiresInDays?: number }) {
  return apiJson<{ token: string; invite: unknown }>(config, "/admin/invites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signupBackendPassword(
  config: RuntimeConfig,
  input: { inviteToken: string; email: string; password: string; displayName?: string },
) {
  return apiJson<{ user: BackendUser; profile: BackendProfile; verificationToken: string }>(config, "/auth/signup/password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyBackendEmail(config: RuntimeConfig, token: string) {
  return apiJson<BackendSessionState>(config, "/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function loginBackendPassword(config: RuntimeConfig, input: { email: string; password: string }) {
  return apiJson<BackendSessionState>(config, "/auth/login/password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signupBackendLocalGoogle(
  config: RuntimeConfig,
  input: { inviteToken: string; email: string; googleSubject: string; displayName?: string },
) {
  return apiJson<BackendSessionState>(config, "/auth/google/local", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startBackendGoogleOAuth(
  config: RuntimeConfig,
  input: { inviteToken?: string; returnTo?: string },
) {
  return apiJson<{ authUrl: string; expiresAt: string }>(config, "/auth/google/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loadBackendSession(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendSessionState & { restriction?: BackendRestriction }>(config, "/auth/session", {
    headers: authHeaders(session),
  });
}

export function loadBackendProfile(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendProfileSummary>(config, "/profile/me", {
    headers: authHeaders(session),
  });
}

export function loadBackendExploreScenarios(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<{ scenarios: BackendExploreScenarioSummary[] }>(config, "/explore/scenarios", {
    headers: authHeaders(session),
  });
}

export function loadBackendPlatformSettings(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendPlatformSettings>(config, "/admin/platform-settings", {
    headers: authHeaders(session),
  });
}

export function saveBackendPlatformSettings(
  config: RuntimeConfig,
  session: BackendSessionState,
  settings: Partial<BackendPlatformSettings>,
) {
  return apiJson<BackendPlatformSettings>(config, "/admin/platform-settings", {
    method: "PUT",
    headers: authHeaders(session),
    body: JSON.stringify(settings),
  });
}

export function importBackendAdventure(config: RuntimeConfig, session: BackendSessionState, input: BackendImportRequest) {
  return apiJson<{ adventures: AdventureSummary[] }>(config, "/adventures/import", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export async function importAndOpenBackendAdventure(
  config: RuntimeConfig,
  session: BackendSessionState,
  input: BackendImportRequest,
): Promise<Adventure> {
  const imported = await importBackendAdventure(config, session, input);
  const first = imported.adventures[0];
  if (!first) throw new Error("Backend import did not return an adventure.");
  return apiJson<Adventure>(config, `/adventures/${encodeURIComponent(first.id)}`, {
    headers: authHeaders(session),
  });
}

export function createBackendScenario(
  config: RuntimeConfig,
  session: BackendSessionState,
  input: { title: string; description?: string; sourceAdventureId?: string },
) {
  return apiJson<{ id: string; title: string }>(config, "/scenarios", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export function createBackendScenarioRevision(
  config: RuntimeConfig,
  session: BackendSessionState,
  scenarioId: string,
  input: { title?: string; description?: string; content: unknown },
) {
  return apiJson<{ id: string; version: number }>(config, `/scenarios/${encodeURIComponent(scenarioId)}/revisions`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export function publishBackendScenarioRevision(config: RuntimeConfig, session: BackendSessionState, revisionId: string) {
  return apiJson<{ token: string; revision: { status: string } }>(config, `/scenario-revisions/${encodeURIComponent(revisionId)}/publish`, {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function loadBackendSafetyAudit(config: RuntimeConfig) {
  return apiJson<{
    events: BackendSafetyEvent[];
    restrictions: BackendRestriction[];
    policyDecisions: BackendPolicyDecision[];
  }>(config, "/admin/account-safety-events");
}
