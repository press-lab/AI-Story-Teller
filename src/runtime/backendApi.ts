import type { AdventureSummary } from "../db/adventureDb";
import type { AdventureGenPreferences, AdventureGenResult } from "../ai/adventureGen";
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
  socialVisibility?: BackendSocialVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface BackendSessionState {
  sessionToken: string;
  user: BackendUser;
  profile: BackendProfile;
  expiresAt?: string;
}

export interface BackendCapabilities {
  passwordLogin: boolean;
  passwordSignup: boolean;
  inviteRequired: boolean;
  passwordReset: boolean;
  emailVerificationDelivery: boolean;
  googleOAuth: boolean;
}

export interface BackendSocialVisibility {
  followers: boolean;
  following: boolean;
  friends: boolean;
}

export interface BackendSocialPerson {
  userId: string;
  displayName: string;
}

export interface BackendOwnProfileSocial {
  visibility: BackendSocialVisibility;
  followers: BackendSocialPerson[];
  following: BackendSocialPerson[];
  friends: BackendSocialPerson[];
  incomingFriendRequests: BackendSocialPerson[];
  outgoingFriendRequests: BackendSocialPerson[];
}

export interface BackendPublicProfileSocial {
  visibility: BackendSocialVisibility;
  followers?: BackendSocialPerson[];
  following?: BackendSocialPerson[];
  friends?: BackendSocialPerson[];
  viewer: {
    isFollowing: boolean;
    isFollowedBy: boolean;
    friendshipStatus: "self" | "none" | "outgoing_pending" | "incoming_pending" | "friends";
  };
}

export function loadBackendCapabilities(config: RuntimeConfig) {
  return apiJson<BackendCapabilities>(config, "/capabilities");
}

export type BackendPasswordSignupResult =
  | {
      user: BackendUser;
      profile: BackendProfile;
      verificationRequired: true;
      message: string;
    }
  | (BackendSessionState & {
      verificationRequired: false;
      message: string;
    });

export interface BackendImportRequest {
  sourceType: "aist" | "githubSave";
  text?: string;
  json?: unknown;
  title?: string;
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
  social?: BackendOwnProfileSocial;
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
  social?: BackendPublicProfileSocial;
}

export interface BackendPublicProfileSearchResult {
  userId: string;
  displayName: string;
  bio: string;
  createdAt: string;
  scenarioCount: number;
  followerCount: number;
  isFollowing: boolean;
  friendshipStatus: "self" | "none" | "outgoing_pending" | "incoming_pending" | "friends";
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
  likeCount?: number;
  likedByViewer?: boolean;
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
  administration: {
    adminEmails: string[];
  };
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface BackendProviderHealthResult {
  ok: true;
  providerName: string;
  model: string;
  durationMs: number;
  statusCode?: number;
  retryCount: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  contentPreview: string;
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
    usageStats: {
      usageLogCount: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cacheReadTokens: number;
      cacheCreationTokens: number;
      totalDurationMs: number;
      lastUsedAt?: string;
    };
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
  return session?.sessionToken && session.sessionToken !== "cookie" ? { Authorization: `Bearer ${session.sessionToken}` } : {};
}

function providerMutationHeaders(session: BackendSessionState): Record<string, string> {
  return { ...authHeaders(session), "Idempotency-Key": crypto.randomUUID() };
}

export function createBackendInvite(config: RuntimeConfig, session: BackendSessionState, input: { note?: string; maxUses?: number; expiresInDays?: number }) {
  return apiJson<{ token: string; inviteUrl: string; invite: unknown }>(config, "/admin/invites", {
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
  return apiJson<BackendPasswordSignupResult>(config, "/auth/signup/password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function requestBackendPasswordReset(config: RuntimeConfig, email: string) {
  return apiJson<{ ok: true; message: string }>(config, "/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmBackendPasswordReset(config: RuntimeConfig, token: string, password: string) {
  return apiJson<{ ok: true }>(config, "/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, password }),
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

export function exchangeBackendGoogleOAuth(config: RuntimeConfig, exchangeCode: string) {
  return apiJson<BackendSessionState>(config, "/auth/google/exchange", {
    method: "POST",
    body: JSON.stringify({ exchangeCode }),
  });
}

export function loadBackendSession(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendSessionState & { restriction?: BackendRestriction }>(config, "/auth/session", {
    headers: authHeaders(session),
  });
}

export function logoutBackendSession(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<{ ok: true }>(config, "/auth/logout", {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function listBackendSessions(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<{ sessions: Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }> }>(config, "/auth/sessions", {
    headers: authHeaders(session),
  });
}

export function revokeAllBackendSessions(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<{ ok: true }>(config, "/auth/sessions/revoke-all", {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function exportBackendAccount(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<Record<string, unknown>>(config, "/account/export", { headers: authHeaders(session) });
}

export function deleteBackendAccount(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<{ ok: true }>(config, "/account", {
    method: "DELETE",
    headers: authHeaders(session),
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
}

export function loadBackendProfile(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendProfileSummary>(config, "/profile/me", {
    headers: authHeaders(session),
  });
}

export function updateBackendSocialVisibility(
  config: RuntimeConfig,
  session: BackendSessionState,
  socialVisibility: Partial<BackendSocialVisibility>,
) {
  return apiJson<BackendProfileSummary>(config, "/profile/me", {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ socialVisibility }),
  });
}

export function loadBackendPublicProfile(config: RuntimeConfig, session: BackendSessionState, userId: string) {
  return apiJson<BackendPublicProfileSummary>(config, `/profiles/${encodeURIComponent(userId)}`, {
    headers: authHeaders(session),
  });
}

export function searchBackendPublicProfiles(config: RuntimeConfig, session: BackendSessionState, query: string) {
  const params = new URLSearchParams({ q: query });
  return apiJson<{ profiles: BackendPublicProfileSearchResult[] }>(config, `/profiles/search?${params.toString()}`, {
    headers: authHeaders(session),
  });
}

export function loadBackendExploreScenarios(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<{ scenarios: BackendExploreScenarioSummary[] }>(config, "/explore/scenarios", {
    headers: authHeaders(session),
  });
}

export function likeBackendScenario(config: RuntimeConfig, session: BackendSessionState, scenarioId: string) {
  return apiJson<{ scenarioId: string; liked: true; likeCount: number }>(config, `/scenarios/${encodeURIComponent(scenarioId)}/like`, {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function unlikeBackendScenario(config: RuntimeConfig, session: BackendSessionState, scenarioId: string) {
  return apiJson<{ scenarioId: string; liked: false; likeCount: number }>(config, `/scenarios/${encodeURIComponent(scenarioId)}/like`, {
    method: "DELETE",
    headers: authHeaders(session),
  });
}

export function followBackendProfile(config: RuntimeConfig, session: BackendSessionState, userId: string) {
  return apiJson<{ followedUserId: string; following: true }>(config, `/profiles/${encodeURIComponent(userId)}/follow`, {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function unfollowBackendProfile(config: RuntimeConfig, session: BackendSessionState, userId: string) {
  return apiJson<{ followedUserId: string; following: false }>(config, `/profiles/${encodeURIComponent(userId)}/follow`, {
    method: "DELETE",
    headers: authHeaders(session),
  });
}

export function requestBackendFriend(config: RuntimeConfig, session: BackendSessionState, userId: string) {
  return apiJson<{ id: string; status: "pending" }>(config, `/profiles/${encodeURIComponent(userId)}/friend-request`, {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function acceptBackendFriend(config: RuntimeConfig, session: BackendSessionState, requesterUserId: string) {
  return apiJson<{ id: string; status: "accepted" }>(config, `/profiles/${encodeURIComponent(requesterUserId)}/friend-accept`, {
    method: "POST",
    headers: authHeaders(session),
  });
}

export function removeBackendFriend(config: RuntimeConfig, session: BackendSessionState, userId: string) {
  return apiJson<{ otherUserId: string; removed: boolean }>(config, `/profiles/${encodeURIComponent(userId)}/friendship`, {
    method: "DELETE",
    headers: authHeaders(session),
  });
}

export function generateBackendAdventureSetup(
  config: RuntimeConfig,
  session: BackendSessionState,
  input: {
    premise: string;
    preferences: Partial<AdventureGenPreferences>;
    providerOverride?: Partial<ProviderConfig>;
  },
) {
  return apiJson<AdventureGenResult>(config, "/ai/adventure-generation", {
    method: "POST",
    headers: providerMutationHeaders(session),
    body: JSON.stringify(input),
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

export function checkBackendProviderHealth(config: RuntimeConfig, session: BackendSessionState) {
  return apiJson<BackendProviderHealthResult>(config, "/admin/provider-health", {
    method: "POST",
    headers: providerMutationHeaders(session),
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

export function updateBackendAdminUserRole(
  config: RuntimeConfig,
  session: BackendSessionState,
  userId: string,
  role: BackendUser["role"],
) {
  return apiJson<BackendAdminConsoleData>(config, `/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ role }),
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
    headers: providerMutationHeaders(session),
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
    headers: providerMutationHeaders(session),
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
    headers: providerMutationHeaders(session),
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
    headers: providerMutationHeaders(session),
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
    headers: providerMutationHeaders(session),
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
    headers: providerMutationHeaders(session),
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
    headers: providerMutationHeaders(session),
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

export function deleteBackendScenario(config: RuntimeConfig, session: BackendSessionState, scenarioId: string) {
  return apiJson<{ scenarioId: string; deletedRevisionCount: number; deletedShareLinkCount: number }>(
    config,
    `/scenarios/${encodeURIComponent(scenarioId)}`,
    {
      method: "DELETE",
      headers: authHeaders(session),
    },
  );
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

export function loadBackendScenarioRevisionEditorCopy(config: RuntimeConfig, session: BackendSessionState, revisionId: string) {
  return apiJson<Adventure>(config, `/scenario-revisions/${encodeURIComponent(revisionId)}/editor-copy`, {
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
