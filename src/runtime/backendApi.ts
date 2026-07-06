import type { AdventureSummary } from "../db/adventureDb";
import type { BrainAuditRecommendation } from "../memory/brainAudit";
import type { AuditRecommendation } from "../memory/storyCardAudit";
import type { Adventure, AdventureThumbnailImage, MemoryReconcileRequest, ProviderConfig, StoryCardAIBuilderRequest } from "../types/adventure";
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
  userId?: string;
  subjectType?: string;
  subjectId?: string;
  gate: string;
  action: string;
  matchedRuleIds?: string[];
  categories: string[];
  severity: number;
  manualReviewRequired?: boolean;
  rationale?: string;
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
  thumbnailImage?: AdventureThumbnailImage;
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

export interface BackendAdventureSnapshotSummary {
  id: string;
  adventureId: string;
  source: "import" | "turn" | "manualSave" | "restore";
  title: string;
  createdAt: string;
  adventureUpdatedAt: string;
  turnCount: number;
  storyEntryCount: number;
}

export interface BackendPublicProfileSummary {
  user: {
    id: string;
    displayName: string;
    createdAt: string;
  };
  profile: BackendProfile;
  scenarios: BackendExploreScenarioSummary[];
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
  thumbnailImage?: AdventureThumbnailImage;
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
    openRouterProviderSort?: "price" | "throughput" | "latency";
    openRouterDataCollection?: "allow" | "deny";
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

export interface BackendAdminConsoleData {
  detailsLoaded?: boolean;
  totals: {
    users: number;
    activeUsers: number;
    adventures: number;
    scenarioDrafts: number;
    publishedScenarioRevisions: number;
    openSafetyEvents: number;
    policyDecisions: number;
    usageLogs: number;
    performanceTraces: number;
  };
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    profileDisplayName: string;
    role: "user" | "admin";
    status: BackendUser["status"];
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    adventureCount: number;
    scenarioCount: number;
    publishedScenarioCount: number;
    safetyEventCount: number;
    openSafetyEventCount: number;
    currentRestriction: BackendRestriction & { contextTokenCap?: number };
  }>;
  invites: Array<{
    id: string;
    tokenHashPrefix: string;
    createdAt: string;
    expiresAt?: string;
    maxUses: number;
    useCount: number;
    createdByUserId?: string;
    note?: string;
    disabledAt?: string;
  }>;
  adventures: Array<AdventureSummary & { ownerUserId: string }>;
  scenarios: Array<{
    id: string;
    ownerUserId: string;
    title: string;
    description: string;
    revisionCount: number;
    publishedRevisionCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  scenarioRevisions: Array<{
    id: string;
    scenarioId: string;
    ownerUserId: string;
    version: number;
    title: string;
    status: string;
    createdAt: string;
    publishedAt?: string;
  }>;
  safetyEvents: BackendSafetyEvent[];
  restrictions: Array<BackendRestriction & { contextTokenCap?: number; reviewedAt?: string }>;
  policyDecisions: BackendPolicyDecision[];
  usageLogs: Array<{
    id: string;
    userId: string;
    adventureId: string;
    providerName: string;
    model: string;
    usage?: unknown;
    durationMs?: number;
    traceId?: string;
    createdAt: string;
  }>;
  performanceTraces: Array<{
    id: string;
    traceId: string;
    parentTraceId?: string;
    source: "device" | "server" | "database" | "ai" | "policy" | "sync";
    phase: string;
    route?: string;
    method?: string;
    userId?: string;
    adventureId?: string;
    providerName?: string;
    model?: string;
    status: "ok" | "error";
    statusCode?: number;
    durationMs: number;
    requestBytes?: number;
    responseBytes?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
    throttleWaitMs?: number;
    retryCount?: number;
    errorCategory?: string;
    errorMessage?: string;
    metadata?: Record<string, string | number | boolean | undefined>;
    createdAt: string;
  }>;
  contextBuilds: Array<{
    id: string;
    userId: string;
    adventureId: string;
    gate: string;
    createdAt: string;
    messageCount: number;
    sectionCount: number;
    totalEstimatedTokens: number;
    excludedItemCount: number;
    decisionCount: number;
  }>;
  adminActions: Array<{
    id: string;
    adminUserId?: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    createdAt: string;
  }>;
  platformSettings: BackendPlatformSettings;
}

export type BackendAdminConsoleDetailsData = Pick<
  BackendAdminConsoleData,
  "safetyEvents" | "restrictions" | "policyDecisions" | "usageLogs" | "performanceTraces" | "contextBuilds" | "adminActions"
> & { detailsLoaded: true };

function authHeaders(session?: BackendSessionState): Record<string, string> {
  return session?.sessionToken ? { Authorization: `Bearer ${session.sessionToken}` } : {};
}

export function createBackendInvite(config: RuntimeConfig, session: BackendSessionState, input: { note?: string; maxUses?: number; expiresInDays?: number }) {
  return apiJson<{ token: string; invite: unknown }>(config, "/admin/invites", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export function disableBackendInvite(config: RuntimeConfig, session: BackendSessionState, inviteId: string) {
  return apiJson<BackendAdminConsoleData>(config, `/admin/invites/${encodeURIComponent(inviteId)}/disable`, {
    method: "POST",
    headers: authHeaders(session),
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

export function loadBackendPublicProfile(config: RuntimeConfig, session: BackendSessionState, userId: string) {
  return apiJson<BackendPublicProfileSummary>(config, `/profiles/${encodeURIComponent(userId)}`, {
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

export function loadBackendAdminConsole(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendAdminConsoleData>(config, "/admin/console", {
    headers: authHeaders(session),
  });
}

export function loadBackendAdminConsoleDetails(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendAdminConsoleDetailsData>(config, "/admin/console/details", {
    headers: authHeaders(session),
  });
}

export function updateBackendAdminUserStatus(
  config: RuntimeConfig,
  session: BackendSessionState,
  userId: string,
  status: BackendUser["status"],
) {
  return apiJson<BackendAdminConsoleData>(config, `/admin/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ status }),
  });
}

export function createBackendAdminRestriction(
  config: RuntimeConfig,
  session: BackendSessionState,
  userId: string,
  input: {
    level: "none" | "watched" | "restricted" | "generation_hold" | "banned";
    reason: string;
    sharingDisabled?: boolean;
    generationDisabled?: boolean;
    contextTokenCap?: number;
  },
) {
  return apiJson<BackendAdminConsoleData>(config, `/admin/users/${encodeURIComponent(userId)}/restrictions`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export function updateBackendAdminSafetyEventStatus(
  config: RuntimeConfig,
  session: BackendSessionState,
  eventId: string,
  status: BackendSafetyEvent["status"],
) {
  return apiJson<BackendAdminConsoleData>(config, `/admin/account-safety-events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ status }),
  });
}

export function importBackendAdventure(config: RuntimeConfig, session: BackendSessionState, input: BackendImportRequest) {
  return apiJson<{ adventures: AdventureSummary[] }>(config, "/adventures/import", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export function listBackendAdventureSnapshots(config: RuntimeConfig, session: BackendSessionState, adventureId: string) {
  return apiJson<{ snapshots: BackendAdventureSnapshotSummary[] }>(
    config,
    `/adventures/${encodeURIComponent(adventureId)}/snapshots`,
    { headers: authHeaders(session) },
  );
}

export function restoreBackendAdventureSnapshot(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  snapshotId: string,
) {
  return apiJson<Adventure>(
    config,
    `/adventures/${encodeURIComponent(adventureId)}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
    {
      method: "POST",
      headers: authHeaders(session),
    },
  );
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

export function buildBackendStoryCardMemory(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  request: StoryCardAIBuilderRequest,
  providerOverride?: Partial<ProviderConfig>,
) {
  return apiJson<{ adventure: Adventure }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/story-card-builder`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ request, providerOverride }),
  });
}

export function suggestBackendStoryCardUpdates(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  providerOverride?: Partial<ProviderConfig>,
) {
  return apiJson<{ adventure: Adventure }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/story-card-updates`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ providerOverride }),
  });
}

export function reconcileBackendMemory(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  request: MemoryReconcileRequest,
  providerOverride?: Partial<ProviderConfig>,
) {
  return apiJson<{ adventure: Adventure }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/memory-reconcile`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ request, providerOverride }),
  });
}

export function auditBackendStoryCards(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  input: { nTurns: number; includeAI: boolean; providerOverride?: Partial<ProviderConfig> },
) {
  return apiJson<{ recommendations: AuditRecommendation[] }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/story-card-audit`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
  });
}

export function generateBackendBrain(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  name: string,
  providerOverride?: Partial<ProviderConfig>,
) {
  return apiJson<{ adventure: Adventure }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/generate-brain`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ name, providerOverride }),
  });
}

export function updateBackendBrain(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  brainId: string,
  providerOverride?: Partial<ProviderConfig>,
) {
  return apiJson<{ adventure: Adventure }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/update-brain`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ brainId, providerOverride }),
  });
}

export function auditBackendBrains(
  config: RuntimeConfig,
  session: BackendSessionState,
  adventureId: string,
  input: { nTurns: number; includeAI: boolean; providerOverride?: Partial<ProviderConfig> },
) {
  return apiJson<{ recommendations: BrainAuditRecommendation[] }>(config, `/adventures/${encodeURIComponent(adventureId)}/ai/brain-audit`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(input),
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

export function unpublishBackendScenarioRevision(config: RuntimeConfig, session: BackendSessionState, revisionId: string) {
  return apiJson<{ revision: { status: string }; disabledShareLinkCount: number }>(
    config,
    `/scenario-revisions/${encodeURIComponent(revisionId)}/unpublish`,
    {
      method: "POST",
      headers: authHeaders(session),
    },
  );
}

export function forkBackendScenarioRevision(config: RuntimeConfig, session: BackendSessionState, revisionId: string) {
  return apiJson<Adventure>(config, `/scenario-revisions/${encodeURIComponent(revisionId)}/fork`, {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function loadBackendSafetyAudit(config: RuntimeConfig, session?: BackendSessionState) {
  return apiJson<{
    events: BackendSafetyEvent[];
    restrictions: BackendRestriction[];
    policyDecisions: BackendPolicyDecision[];
  }>(config, "/admin/account-safety-events", {
    headers: authHeaders(session),
  });
}
