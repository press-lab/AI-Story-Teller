import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { normalizeAdventure, sanitizeAdventureForPersistence } from "../../src/state/defaults";
import type { Adventure } from "../../src/types/adventure";
import type { BackendDb } from "./backendDb";
import { loadApiConfig, type ApiConfig } from "./config";
import { createBackendDb } from "./db";
import { createEmptyDb } from "./dbShape";
import {
  confirmPasswordReset,
  completeGoogleSignin,
  consumeOAuthExchange,
  consumeOAuthState,
  createOAuthExchange,
  createInvite,
  createGoogleOAuthStart,
  loginWithPassword,
  previewInvite,
  requestPasswordReset,
  resolveSession,
  signupWithLocalGoogle,
  signupWithPassword,
  fetchGoogleOAuthProfile,
  verifyEmailToken,
  type AuthSessionResult,
} from "./auth";
import {
  buildServerContextPreview,
  getOwnedAdventureRecord,
  importAdventureAsCopy,
  listAdventureSnapshots,
  restoreAdventureSnapshot,
  runBackendBrainAudit,
  runBackendBrainGeneration,
  runBackendBrainUpdate,
  runBackendAdventureGeneration,
  runBackendMemoryReconcile,
  runBackendStoryCardAudit,
  runBackendStoryCardBuilder,
  runBackendStoryCardUpdates,
  runBackendTurn,
  saveBackendAdventure,
  summarizeAdventure,
} from "./adventureStore";
import { currentRestriction } from "./accountSafety";
import {
  createAdventureFromScenarioRevision,
  createScenarioRevisionEditorCopy,
  createScenarioDraft,
  createScenarioRevision,
  deleteScenarioDraft,
  publishScenarioRevision,
  unpublishScenarioRevision,
} from "./scenarioSharing";
import { buildProfileSummary, buildPublicProfileSummary, listExploreScenarios } from "./profileReadModels";
import { getPlatformSettings, updatePlatformSettings, type PlatformSettingsInput } from "./platformSettings";
import { buildAdminConsole, buildAdminConsoleDetails, createManualRestriction, disableInviteLink, updateSafetyEventStatus, updateUserStatus } from "./adminConsole";
import { bearerToken, readJsonBody, routePath, sendJson } from "./http";
import { createTraceId, elapsedMs, performanceTrace, sanitizeErrorMessage } from "./performanceTrace";
import type { LocalDbData, PerformanceTraceRecord } from "./apiTypes";
import { configuredEmailDelivery, type EmailDelivery } from "./emailDelivery";
import { hashToken } from "./ids";
import { ApiError, normalizeApiError } from "./apiError";
import { deleteUserData, pruneExpiredAndRetainedData } from "./dataLifecycle";

export interface ApiServer {
  server: Server;
  config: ApiConfig;
  db: BackendDb;
  listen(): Promise<{ port: number; url: string }>;
  close(): Promise<void>;
}

export function createApiServer(overrides: Partial<ApiConfig> = {}): ApiServer {
  const config = loadApiConfig(overrides);
  const db = createBackendDb(config);
  const emailDelivery = configuredEmailDelivery(config);
  const server = createServer((request, response) => {
    void handleRequest(request, response, config, db, emailDelivery).catch((error) => {
      if (response.headersSent || response.writableEnded) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      const apiError = normalizeApiError(error);
      const traceId = requestTraceId(request);
      console.error(`[${traceId}] ${apiError.code}:`, sanitizeErrorMessage(apiError.cause ?? error));
      sendJson(response, apiError.status, { error: apiError.message, code: apiError.code, traceId }, {
        ...corsFor(request, config),
        "X-AIST-Trace-Id": traceId,
      });
    });
  });
  return {
    server,
    config,
    db,
    listen: () => new Promise((resolve) => {
      server.listen(config.port, config.host, () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : config.port;
        resolve({ port, url: `http://${config.host}:${port}` });
      });
    }),
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }).then(() => db.close()),
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: ApiConfig,
  db: BackendDb,
  emailDelivery: EmailDelivery,
): Promise<void> {
  const corsHeaders = corsFor(request, config);
  if (request.method === "OPTIONS") {
    if (request.headers.origin && !corsHeaders["Access-Control-Allow-Origin"]) {
      sendJson(response, 403, { error: "Origin is not allowed.", code: "cors_forbidden" }, {});
      return;
    }
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const route = routePath(request);
  const traceId = requestTraceId(request);
  const requestStartedAt = performance.now();
  const requestBytes = numericHeader(request.headers["content-length"]);
  try {
    if (config.databaseUrl && !["GET", "HEAD", "OPTIONS"].includes(request.method ?? "GET") && request.headers["x-aist-csrf"] !== "1") {
      throw new ApiError(403, "csrf_required", "This request is missing CSRF protection.");
    }
    if (request.method === "GET" && (route.pathname === "/readyz" || route.pathname === "/health")) {
      const readiness = await db.readiness();
      sendJson(response, 200, {
        ok: true,
        ...readiness,
      }, corsHeaders);
      return;
    }
    if (request.method === "GET" && route.pathname === "/livez") {
      sendJson(response, 200, { ok: true }, corsHeaders);
      return;
    }
    if (request.method === "GET" && route.pathname === "/version") {
      sendJson(response, 200, {
        app: "ai-story-teller-api",
        version: process.env.npm_package_version ?? "0.1.0",
        buildSha: process.env.RENDER_GIT_COMMIT ?? process.env.AIST_BUILD_SHA ?? "development",
        buildTimestamp: process.env.AIST_BUILD_TIMESTAMP,
        mode: config.databaseUrl ? "hosted" : "local",
        database: config.databaseUrl ? "postgres" : "local-json",
        policyMode: config.policyMode,
        capabilities: serverCapabilities(config),
      }, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/capabilities") {
      sendJson(response, 200, serverCapabilities(config), corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/admin/invites") {
      const adminUserId = await assertAdmin(request, config, db);
      const { body } = await readJsonBody<{ expiresInDays?: number; maxUses?: number; note?: string }>(request);
      const created = await authUpdate(db, (data) => createInvite(data, { ...body, createdByUserId: adminUserId }));
      sendJson(response, 201, created, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.segments.length === 4 && route.segments[0] === "admin" && route.segments[1] === "invites" && route.segments[3] === "disable") {
      const adminUserId = await assertAdmin(request, config, db);
      const consoleData = await authUpdate(db, (data) => {
        disableInviteLink(data, adminUserId, route.segments[2]);
        return buildAdminConsole(data, config);
      });
      sendJson(response, 200, consoleData, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.segments[0] === "invites" && route.segments[2] === "preview") {
      const token = route.segments[1];
      const preview = await authUpdate(db, (data) => previewInvite(data, token));
      sendJson(response, preview.valid ? 200 : 404, preview, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/signup/password") {
      assertEmailCapability(config);
      const { body } = await readJsonBody<{ inviteToken: string; email: string; password: string; displayName?: string }>(request);
      requireStringFields(body, ["inviteToken", "email", "password"]);
      await enforceRateLimit(db, config, request, "signup", body.email, 8, 60_000);
      const result = await authUpdate(db, async (data) => {
        const signup = await signupWithPassword(data, body);
        applyConfiguredAdminRole(data, signup.user, config);
        return signup;
      });
      await emailDelivery.sendVerificationEmail({
        to: result.user.email,
        verificationUrl: authActionUrl(config.googleOAuth.successRedirectUrl, "verifyEmail", result.verification.token),
        expiresAt: result.verification.expiresAt,
      });
      sendJson(response, 201, {
        user: publicUser(result.user, config),
        profile: result.profile,
        verificationRequired: true,
        message: "Check your email for a verification link.",
      }, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/email/verify") {
      assertEmailCapability(config);
      const { body } = await readJsonBody<{ token: string }>(request);
      requireStringFields(body, ["token"]);
      const result = await authUpdate(db, (data) => {
        const session = verifyEmailToken(data, body.token);
        applyConfiguredAdminRole(data, session.user, config);
        return session;
      });
      sendJson(response, 200, publicSession(result, config), authSessionHeaders(config, corsHeaders, result));
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/login/password") {
      const { body } = await readJsonBody<{ email: string; password: string }>(request);
      requireStringFields(body, ["email", "password"]);
      await enforceRateLimit(db, config, request, "login", body.email, 12, 60_000);
      const result = await authUpdate(db, async (data) => {
        const session = await loginWithPassword(data, body);
        applyConfiguredAdminRole(data, session.user, config);
        return session;
      });
      sendJson(response, 200, publicSession(result, config), authSessionHeaders(config, corsHeaders, result));
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/password-reset/request") {
      assertEmailCapability(config);
      const { body } = await readJsonBody<{ email: string }>(request);
      requireStringFields(body, ["email"]);
      await enforceRateLimit(db, config, request, "password-reset", body.email, 5, 60_000);
      const result = await authUpdate(db, (data) => requestPasswordReset(data, body.email));
      if (result.reset) {
        try {
          await emailDelivery.sendPasswordResetEmail({
            to: result.email,
            resetUrl: authActionUrl(config.googleOAuth.successRedirectUrl, "passwordReset", result.reset.token),
            expiresAt: result.reset.expiresAt,
          });
        } catch (deliveryError) {
          console.warn("Password reset email delivery failed:", errorMessage(deliveryError));
        }
      }
      sendJson(response, 202, genericPasswordResetResponse(), corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/password-reset/confirm") {
      assertEmailCapability(config);
      const { body } = await readJsonBody<{ token: string; password: string }>(request);
      requireStringFields(body, ["token", "password"]);
      await authUpdate(db, (data) => confirmPasswordReset(data, body));
      sendJson(response, 200, { ok: true }, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/google/local") {
      if (!config.allowLocalGoogleStub) throw new Error("Local Google stub is disabled.");
      const { body } = await readJsonBody<{ inviteToken: string; email: string; googleSubject: string; displayName?: string }>(request);
      requireStringFields(body, ["inviteToken", "email", "googleSubject"]);
      await enforceRateLimit(db, config, request, "google-local", body.email, 12, 60_000);
      const result = await authUpdate(db, (data) => {
        const session = signupWithLocalGoogle(data, body);
        applyConfiguredAdminRole(data, session.user, config);
        return session;
      });
      sendJson(response, 200, publicSession(result, config), authSessionHeaders(config, corsHeaders, result));
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/google/start") {
      const { body } = await readJsonBody<{ inviteToken?: string; returnTo?: string }>(request);
      await enforceRateLimit(db, config, request, "google-start", undefined, 24, 60_000);
      const result = await authUpdate(db, (data) => createGoogleOAuthStart(data, body, config));
      sendJson(response, 200, result, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/google/exchange") {
      const { body } = await readJsonBody<{ exchangeCode: string }>(request);
      requireStringFields(body, ["exchangeCode"]);
      const result = await authUpdate(db, (data) => {
        const session = consumeOAuthExchange(data, body.exchangeCode);
        applyConfiguredAdminRole(data, session.user, config);
        return session;
      });
      sendJson(response, 200, publicSession(result, config), authSessionHeaders(config, corsHeaders, result));
      return;
    }

    if (request.method === "GET" && route.pathname === "/auth/google/callback") {
      const code = route.url.searchParams.get("code") ?? "";
      const state = route.url.searchParams.get("state") ?? "";
      await enforceRateLimit(db, config, request, "google-callback", undefined, 24, 60_000);
      const oauthState = await authUpdate(db, (data) => consumeOAuthState(data, state));
      const googleProfile = await fetchGoogleOAuthProfile(code, config);
      const exchange = await authUpdate(db, (data) => {
        const session = completeGoogleSignin(data, googleProfile, oauthState.inviteId);
        applyConfiguredAdminRole(data, session.user, config);
        return createOAuthExchange(data, session, oauthState.returnTo);
      });
      if (request.headers.accept?.includes("application/json")) {
        sendJson(response, 200, exchange, corsHeaders);
      } else {
        sendOAuthRedirect(response, exchange.returnTo ?? config.googleOAuth.successRedirectUrl, exchange.exchangeCode, corsHeaders);
      }
      return;
    }

    if (request.method === "GET" && route.pathname === "/auth/session") {
      const session = await requireSession(request, db);
      applyConfiguredAdminRole({ users: [session.user] }, session.user, config);
      const data = db.readAccountRestrictions
        ? { ...createEmptyDb(), accountRestrictions: await db.readAccountRestrictions(session.user.id) }
        : await db.read();
      sendJson(response, 200, { ...publicSession(session, config), restriction: currentRestriction(data, session.user.id) }, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/logout") {
      const session = await requireSession(request, db);
      const tokenHash = hashToken(session.sessionToken);
      if (db.revokeSessionByTokenHash) await db.revokeSessionByTokenHash(tokenHash);
      else await db.update((data) => {
        const stored = data.sessions.find((entry) => entry.id === session.session.id);
        if (stored) stored.revokedAt = new Date().toISOString();
      });
      sendJson(response, 200, { ok: true }, config.databaseUrl ? { ...corsHeaders, "Set-Cookie": expiredSessionCookie() } : corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/auth/sessions") {
      const session = await requireSession(request, db);
      const data = await db.read();
      sendJson(response, 200, {
        sessions: data.sessions
          .filter((entry) => entry.userId === session.user.id && !entry.revokedAt && Date.parse(entry.expiresAt) > Date.now())
          .map((entry) => ({ id: entry.id, createdAt: entry.createdAt, expiresAt: entry.expiresAt, current: entry.id === session.session.id })),
      }, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/sessions/revoke-all") {
      const session = await requireSession(request, db);
      await db.update((data) => {
        const revokedAt = new Date().toISOString();
        for (const entry of data.sessions) if (entry.userId === session.user.id && !entry.revokedAt) entry.revokedAt = revokedAt;
      });
      sendJson(response, 200, { ok: true }, config.databaseUrl ? { ...corsHeaders, "Set-Cookie": expiredSessionCookie() } : corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/account/export") {
      const session = await requireSession(request, db);
      const data = await db.read();
      const scenarioIds = new Set(data.scenarioDrafts.filter((entry) => entry.ownerUserId === session.user.id).map((entry) => entry.id));
      sendJson(response, 200, {
        exportedAt: new Date().toISOString(),
        user: publicUser(session.user, config),
        profile: session.profile,
        adventures: data.adventures.filter((entry) => entry.ownerUserId === session.user.id).map((entry) => entry.adventure),
        scenarios: data.scenarioDrafts.filter((entry) => entry.ownerUserId === session.user.id),
        scenarioRevisions: data.scenarioRevisions.filter((entry) => scenarioIds.has(entry.scenarioId)),
      }, corsHeaders);
      return;
    }

    if (request.method === "DELETE" && route.pathname === "/account") {
      const session = await requireSession(request, db);
      const { body } = await readJsonBody<{ confirmation: string }>(request, 1_024);
      if (body.confirmation !== "DELETE") throw new ApiError(400, "confirmation_required", "Enter DELETE to permanently delete the account.");
      await db.update((data) => deleteUserData(data, session.user.id));
      sendJson(response, 200, { ok: true }, config.databaseUrl ? { ...corsHeaders, "Set-Cookie": expiredSessionCookie() } : corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/admin/maintenance/retention") {
      await assertAdmin(request, config, db);
      const deletedRecords = db.cleanupLifecycle
        ? await db.cleanupLifecycle()
        : await db.update((data) => {
          const before = Object.values(data).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
          pruneExpiredAndRetainedData(data);
          const after = Object.values(data).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
          return before - after;
        });
      sendJson(response, 200, { ok: true, deletedRecords }, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/profile/me") {
      const session = await requireSession(request, db);
      const dbStartedAt = performance.now();
      const profile = db.readProfileSummary
        ? await db.readProfileSummary(session.user.id)
        : buildProfileSummary(await db.read(), session.user.id);
      await recordTrace(db, performanceTrace({
        traceId,
        source: "database",
        phase: "profile_summary_read",
        route: route.pathname,
        method: request.method,
        userId: session.user.id,
        status: "ok",
        durationMs: elapsedMs(dbStartedAt),
        metadata: { optimizedReadModel: Boolean(db.readProfileSummary) },
      }));
      sendJson(response, 200, profile, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.segments[0] === "profiles" && route.segments.length === 2) {
      await requireSession(request, db);
      const dbStartedAt = performance.now();
      const profile = db.readPublicProfileSummary
        ? await db.readPublicProfileSummary(route.segments[1])
        : buildPublicProfileSummary(await db.read(), route.segments[1]);
      await recordTrace(db, performanceTrace({
        traceId,
        source: "database",
        phase: "public_profile_read",
        route: route.pathname,
        method: request.method,
        userId: route.segments[1],
        status: "ok",
        durationMs: elapsedMs(dbStartedAt),
        metadata: { optimizedReadModel: Boolean(db.readPublicProfileSummary) },
      }));
      sendJson(response, 200, profile, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/explore/scenarios") {
      await requireSession(request, db);
      const dbStartedAt = performance.now();
      const scenarios = db.readExploreScenarios
        ? await db.readExploreScenarios()
        : listExploreScenarios(await db.read());
      await recordTrace(db, performanceTrace({
        traceId,
        source: "database",
        phase: "explore_scenarios_read",
        route: route.pathname,
        method: request.method,
        status: "ok",
        durationMs: elapsedMs(dbStartedAt),
        metadata: { optimizedReadModel: Boolean(db.readExploreScenarios), resultCount: scenarios.length },
      }));
      sendJson(response, 200, { scenarios }, corsHeaders);
      return;
    }

    if (route.segments[0] === "adventures") {
      const session = await requireSession(request, db);
      await handleAdventureRoute(request, response, route.segments, session, config, db, corsHeaders, traceId, route.pathname);
      return;
    }

    if (route.segments[0] === "scenarios") {
      const session = await requireSession(request, db);
      await handleScenarioRoute(request, response, route.segments, session, config, db, corsHeaders);
      return;
    }

    if (route.segments[0] === "scenario-revisions") {
      const session = await requireSession(request, db);
      await handleScenarioRevisionRoute(request, response, route.segments, session, config, db, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/ai/adventure-generation") {
      const session = await requireSession(request, db);
      const { body } = await readJsonBody<{
        premise?: string;
        preferences?: NonNullable<Parameters<typeof runBackendAdventureGeneration>[3]>;
        providerOverride?: NonNullable<Parameters<typeof runBackendAdventureGeneration>[5]>;
      }>(request);
      const result = await executeIdempotent(db, config, request, session.user.id, route.pathname, body, () =>
        runAccountWorkspaceOperation(db, session.user.id, (data) =>
          runBackendAdventureGeneration(
            data,
            session.user.id,
            body.premise ?? "",
            body.preferences ?? {},
            config,
            body.providerOverride,
          ),
        ));
      sendJson(response, 200, result, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/admin/account-safety-events") {
      await assertAdmin(request, config, db);
      const data = await db.read();
      sendJson(response, 200, {
        events: data.accountSafetyEvents,
        restrictions: data.accountRestrictions,
        policyDecisions: data.policyDecisions,
      }, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/admin/console") {
      await assertAdmin(request, config, db);
      const dbStartedAt = performance.now();
      const consoleData = db.readAdminConsoleSummary
        ? await db.readAdminConsoleSummary(config)
        : buildAdminConsole(await db.read(), config);
      await recordTrace(db, performanceTrace({
        traceId,
        source: "database",
        phase: "admin_console_summary_read",
        route: route.pathname,
        method: request.method,
        status: "ok",
        durationMs: elapsedMs(dbStartedAt),
        metadata: { optimizedReadModel: Boolean(db.readAdminConsoleSummary) },
      }));
      sendJson(response, 200, consoleData, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/admin/console/details") {
      await assertAdmin(request, config, db);
      const dbStartedAt = performance.now();
      const details = db.readAdminConsoleDetails
        ? await db.readAdminConsoleDetails(config)
        : buildAdminConsoleDetails(await db.read());
      await recordTrace(db, performanceTrace({
        traceId,
        source: "database",
        phase: "admin_console_details_read",
        route: route.pathname,
        method: request.method,
        status: "ok",
        durationMs: elapsedMs(dbStartedAt),
        metadata: { optimizedReadModel: Boolean(db.readAdminConsoleDetails) },
      }));
      sendJson(response, 200, details, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/telemetry/client") {
      const session = await requireSession(request, db);
      await enforceRateLimit(db, config, request, "telemetry", session.user.id, 60, 60_000);
      const { body } = await readJsonBody<Partial<PerformanceTraceRecord>>(request, 16_384);
      const trace = validatedClientTrace(body);
      await recordTrace(db, performanceTrace({
        traceId: trace.traceId ?? traceId,
        source: "device",
        userId: session.user.id,
        phase: trace.phase,
        route: trace.route,
        method: trace.method,
        status: trace.status,
        statusCode: trace.statusCode,
        durationMs: trace.durationMs,
        requestBytes: trace.requestBytes,
        responseBytes: trace.responseBytes,
        errorCategory: trace.errorCategory,
        errorMessage: trace.errorMessage,
        metadata: trace.metadata,
      }));
      sendJson(response, 202, { ok: true }, corsHeaders);
      return;
    }

    if (request.method === "PATCH" && route.segments[0] === "admin" && route.segments[1] === "users" && route.segments[3] === "status") {
      const adminUserId = await assertAdmin(request, config, db);
      const userId = route.segments[2];
      const { body } = await readJsonBody<{ status: "pending_verification" | "active" | "disabled" }>(request);
      const data = await db.update((draft) => {
        updateUserStatus(draft, adminUserId, userId, body.status);
        return buildAdminConsole(draft, config);
      });
      sendJson(response, 200, data, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.segments[0] === "admin" && route.segments[1] === "users" && route.segments[3] === "restrictions") {
      const adminUserId = await assertAdmin(request, config, db);
      const userId = route.segments[2];
      const { body } = await readJsonBody<{
        level: "none" | "watched" | "restricted" | "generation_hold" | "banned";
        reason: string;
        sharingDisabled?: boolean;
        generationDisabled?: boolean;
        contextTokenCap?: number;
      }>(request);
      const data = await db.update((draft) => {
        createManualRestriction(draft, adminUserId, userId, body);
        return buildAdminConsole(draft, config);
      });
      sendJson(response, 200, data, corsHeaders);
      return;
    }

    if (request.method === "PATCH" && route.segments[0] === "admin" && route.segments[1] === "account-safety-events") {
      const adminUserId = await assertAdmin(request, config, db);
      const eventId = route.segments[2];
      const { body } = await readJsonBody<{ status: "open" | "reviewed" | "dismissed" }>(request);
      const data = await db.update((draft) => {
        updateSafetyEventStatus(draft, adminUserId, eventId, body.status);
        return buildAdminConsole(draft, config);
      });
      sendJson(response, 200, data, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/admin/platform-settings") {
      await assertAdmin(request, config, db);
      const data = await db.read();
      sendJson(response, 200, getPlatformSettings(data, config), corsHeaders);
      return;
    }

    if (request.method === "PUT" && route.pathname === "/admin/platform-settings") {
      const adminUserId = await assertAdmin(request, config, db);
      const { body } = await readJsonBody<PlatformSettingsInput>(request);
      const settings = await db.update((data) => updatePlatformSettings(data, config, body, adminUserId));
      sendJson(response, 200, settings, corsHeaders);
      return;
    }

    throw new ApiError(404, "route_not_found", "Route not found.");
  } catch (error) {
    const apiError = normalizeApiError(error);
    console.error(`[${traceId}] ${apiError.code}:`, sanitizeErrorMessage(apiError.cause ?? error));
    const headers = apiError.retryAfterSeconds
      ? { ...corsHeaders, "Retry-After": String(apiError.retryAfterSeconds) }
      : corsHeaders;
    sendJson(response, apiError.status, { error: apiError.message, code: apiError.code, traceId }, {
      ...headers,
      "X-AIST-Trace-Id": traceId,
    });
  } finally {
    if (config.databaseUrl && shouldTraceRequest(route.pathname)) {
      await recordTrace(db, performanceTrace({
        traceId,
        source: "server",
        phase: "http_request",
        route: route.pathname,
        method: request.method,
        status: response.statusCode >= 400 ? "error" : "ok",
        statusCode: response.statusCode,
        durationMs: elapsedMs(requestStartedAt),
        requestBytes,
        responseBytes: numericHeader(response.getHeader("Content-Length")),
      }));
    }
  }
}

async function handleAdventureRoute(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  session: AuthSessionResult,
  config: ApiConfig,
  db: BackendDb,
  corsHeaders: Record<string, string>,
  traceId: string,
  pathname: string,
): Promise<void> {
  const userId = session.user.id;
  if (request.method === "GET" && segments.length === 1) {
    const dbStartedAt = performance.now();
    const records = db.listAdventureRecords
      ? await db.listAdventureRecords(userId)
      : (await db.read()).adventures.filter((entry) => entry.ownerUserId === userId);
    const summaries = records.map((entry) => summarizeAdventure(entry.adventure));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "database",
      phase: "adventure_list_read",
      route: pathname,
      method: request.method,
      userId,
      status: "ok",
      durationMs: elapsedMs(dbStartedAt),
      metadata: { resultCount: summaries.length },
    }));
    sendJson(response, 200, summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[1] === "import") {
    const { body } = await readJsonBody(request, 10_000_000);
    const dbStartedAt = performance.now();
    const imported = await db.updatePersistingOnError((data) => importAdventureAsCopy(data, userId, body as never, config));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "database",
      phase: "adventure_import_write",
      route: pathname,
      method: request.method,
      userId,
      status: "ok",
      durationMs: elapsedMs(dbStartedAt),
      metadata: { resultCount: imported.length },
    }));
    sendJson(response, 201, { adventures: imported.map(summarizeAdventure) }, corsHeaders);
    return;
  }
  const adventureId = segments[1];
  if (!adventureId) throw new ApiError(400, "adventure_id_required", "Adventure id is required.");
  if (request.method === "GET" && segments.length === 2) {
    const dbStartedAt = performance.now();
    const record = db.readAdventureRecord
      ? await db.readAdventureRecord(userId, adventureId)
      : getOwnedAdventureRecord(await db.read(), userId, adventureId);
    if (!record) throw new ApiError(404, "adventure_not_found", "Adventure not found.");
    const adventure = record.adventure;
    await recordTrace(db, performanceTrace({
      traceId,
      source: "database",
      phase: "adventure_get_read",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(dbStartedAt),
    }));
    sendJson(response, 200, adventure, corsHeaders);
    return;
  }
  if (request.method === "GET" && segments[2] === "snapshots" && segments.length === 3) {
    const snapshots = db.readAdventureSnapshotSummaries
      ? await db.readAdventureSnapshotSummaries(userId, adventureId)
      : listAdventureSnapshots(await db.read({ includeAdventureSnapshots: true }), userId, adventureId);
    sendJson(response, 200, { snapshots }, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "snapshots" && segments[4] === "restore") {
    const restored = await db.update((data) => restoreAdventureSnapshot(data, userId, adventureId, segments[3]));
    sendJson(response, 200, restored, corsHeaders);
    return;
  }
  if (request.method === "PUT" && segments.length === 2) {
    const { body } = await readJsonBody<{ adventure: Adventure }>(request, 10_000_000);
    if (!body.adventure || typeof body.adventure !== "object" || Array.isArray(body.adventure)) {
      throw new ApiError(400, "invalid_adventure", "adventure must be an object.");
    }
    if (body.adventure.id !== adventureId) {
      throw new ApiError(409, "adventure_id_mismatch", "Adventure id does not match the request path.");
    }
    const dbStartedAt = performance.now();
    const cleanAdventure = normalizeAdventure(sanitizeAdventureForPersistence(body.adventure));
    const saved = db.saveAdventureRecord
      ? await db.saveAdventureRecord(userId, cleanAdventure, "manualSave")
      : await db.update((data) => saveBackendAdventure(data, userId, cleanAdventure, "manualSave"));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "database",
      phase: "adventure_save_write",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(dbStartedAt),
    }));
    sendJson(response, 200, saved.adventure, corsHeaders);
    return;
  }
  if (request.method === "DELETE" && segments.length === 2) {
    if (db.deleteAdventureRecord) await db.deleteAdventureRecord(userId, adventureId);
    else await db.update((data) => {
      data.adventures = data.adventures.filter((entry) => !(entry.ownerUserId === userId && entry.id === adventureId));
    });
    sendJson(response, 200, { ok: true }, corsHeaders);
    return;
  }
  if (request.method === "GET" && segments[2] === "export") {
    const record = db.readAdventureRecord
      ? await db.readAdventureRecord(userId, adventureId)
      : getOwnedAdventureRecord(await db.read(), userId, adventureId);
    if (!record) throw new ApiError(404, "adventure_not_found", "Adventure not found.");
    sendJson(response, 200, record.adventure, corsHeaders);
    return;
  }
  if (request.method === "GET" && segments[2] === "context-preview") {
    const context = await runAdventureWorkspaceOperation(db, userId, adventureId, (data) => buildServerContextPreview(data, userId, adventureId, config));
    sendJson(response, 200, context, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "story-card-builder") {
    const { body } = await readJsonBody<{
      request: NonNullable<Parameters<typeof runBackendStoryCardBuilder>[3]>;
      providerOverride?: NonNullable<Parameters<typeof runBackendStoryCardBuilder>[5]>;
    }>(request, 2_000_000);
    requireObjectField(body, "request");
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendStoryCardBuilder(data, userId, adventureId, body.request, config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "ai",
      phase: "story_card_builder_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "story-card-updates") {
    const { body } = await readJsonBody<{
      providerOverride?: NonNullable<Parameters<typeof runBackendStoryCardUpdates>[4]>;
    }>(request, 2_000_000);
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendStoryCardUpdates(data, userId, adventureId, config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "ai",
      phase: "story_card_updates_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "memory-reconcile") {
    const { body } = await readJsonBody<{
      request: NonNullable<Parameters<typeof runBackendMemoryReconcile>[3]>;
      providerOverride?: NonNullable<Parameters<typeof runBackendMemoryReconcile>[5]>;
    }>(request, 2_000_000);
    requireObjectField(body, "request");
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendMemoryReconcile(data, userId, adventureId, body.request, config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "ai",
      phase: "memory_reconcile_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "story-card-audit") {
    const { body } = await readJsonBody<{
      nTurns?: number;
      includeAI?: boolean;
      providerOverride?: NonNullable<Parameters<typeof runBackendStoryCardAudit>[6]>;
    }>(request, 2_000_000);
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendStoryCardAudit(data, userId, adventureId, body.nTurns ?? 6, Boolean(body.includeAI), config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: Boolean(body.includeAI) ? "ai" : "server",
      phase: "story_card_audit_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
      metadata: { includeAI: Boolean(body.includeAI) },
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "generate-brain") {
    const { body } = await readJsonBody<{
      name?: string;
      providerOverride?: NonNullable<Parameters<typeof runBackendBrainGeneration>[5]>;
    }>(request, 2_000_000);
    requireStringFields(body, ["name"]);
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendBrainGeneration(data, userId, adventureId, body.name ?? "", config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "ai",
      phase: "brain_generation_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "update-brain") {
    const { body } = await readJsonBody<{
      brainId?: string;
      providerOverride?: NonNullable<Parameters<typeof runBackendBrainUpdate>[5]>;
    }>(request, 2_000_000);
    requireStringFields(body, ["brainId"]);
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendBrainUpdate(data, userId, adventureId, body.brainId ?? "", config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "ai",
      phase: "brain_update_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "ai" && segments[3] === "brain-audit") {
    const { body } = await readJsonBody<{
      nTurns?: number;
      includeAI?: boolean;
      providerOverride?: NonNullable<Parameters<typeof runBackendBrainAudit>[6]>;
    }>(request, 2_000_000);
    const aiStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendBrainAudit(data, userId, adventureId, body.nTurns ?? 6, Boolean(body.includeAI), config, body.providerOverride),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: Boolean(body.includeAI) ? "ai" : "server",
      phase: "brain_audit_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(aiStartedAt),
      metadata: { includeAI: Boolean(body.includeAI) },
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "turn") {
    const { body } = await readJsonBody<{
      input: string;
      mode?: "do" | "story" | "comms";
      recordUserInput?: boolean;
      providerCue?: string;
      regenerateLastAssistant?: boolean;
      providerOverride?: NonNullable<Parameters<typeof runBackendTurn>[5]>["providerOverride"];
    }>(request);
    requireStringFields(body, ["input"]);
    const turnStartedAt = performance.now();
    const result = await executeIdempotent(db, config, request, userId, pathname, body, () =>
      runAdventureWorkspaceOperation(db, userId, adventureId, (data) =>
        runBackendTurn(data, userId, adventureId, body.input ?? "", config, {
          mode: body.mode,
          recordUserInput: body.recordUserInput,
          providerCue: body.providerCue,
          regenerateLastAssistant: body.regenerateLastAssistant,
          providerOverride: body.providerOverride,
          traceId,
          route: pathname,
        }),
      ));
    await recordTrace(db, performanceTrace({
      traceId,
      source: "server",
      phase: "turn_route_total",
      route: pathname,
      method: request.method,
      userId,
      adventureId,
      status: "ok",
      durationMs: elapsedMs(turnStartedAt),
    }));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  throw new ApiError(404, "route_not_found", "Adventure route not found.");
}

async function handleScenarioRoute(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  session: AuthSessionResult,
  config: ApiConfig,
  db: BackendDb,
  corsHeaders: Record<string, string>,
): Promise<void> {
  if (request.method === "POST" && segments.length === 1) {
    const { body } = await readJsonBody<{ title: string; description?: string; sourceAdventureId?: string }>(request);
    const scenario = await db.updatePersistingOnError((data) => {
      assertScenarioPublishingEnabled(data, config);
      return createScenarioDraft(data, session.user.id, body, config);
    });
    sendJson(response, 201, scenario, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "revisions") {
    const { body } = await readJsonBody<{ title?: string; description?: string; content: unknown }>(request, 10_000_000);
    const revision = await db.updatePersistingOnError((data) => {
      assertScenarioPublishingEnabled(data, config);
      return createScenarioRevision(data, session.user.id, segments[1], body, config);
    });
    sendJson(response, 201, revision, corsHeaders);
    return;
  }
  if (request.method === "DELETE" && segments.length === 2) {
    const result = await db.updatePersistingOnError((data) =>
      deleteScenarioDraft(data, session.user.id, segments[1]),
    );
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  throw new ApiError(404, "route_not_found", "Scenario route not found.");
}

async function handleScenarioRevisionRoute(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  session: AuthSessionResult,
  config: ApiConfig,
  db: BackendDb,
  corsHeaders: Record<string, string>,
): Promise<void> {
  if (request.method === "GET" && segments[2] === "editor-copy") {
    const data = await db.read();
    const adventure = createScenarioRevisionEditorCopy(data, session.user.id, segments[1]);
    sendJson(response, 200, adventure, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "publish") {
    const result = await db.updatePersistingOnError((data) => {
      assertScenarioPublishingEnabled(data, config);
      return publishScenarioRevision(data, session.user.id, segments[1], config);
    });
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "unpublish") {
    const result = await db.updatePersistingOnError((data) =>
      unpublishScenarioRevision(data, session.user.id, segments[1]),
    );
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "fork") {
    const saved = await db.updatePersistingOnError((data) => {
      const adventure = createAdventureFromScenarioRevision(data, session.user.id, segments[1]);
      return saveBackendAdventure(data, session.user.id, adventure, "import");
    });
    sendJson(response, 201, saved.adventure, corsHeaders);
    return;
  }
  throw new ApiError(404, "route_not_found", "Scenario revision route not found.");
}

async function requireSession(request: IncomingMessage, db: BackendDb): Promise<AuthSessionResult> {
  const token = bearerToken(request) ?? sessionCookie(request);
  let session: AuthSessionResult | undefined;
  if (db.resolveSessionByTokenHash) {
    const resolved = token ? await db.resolveSessionByTokenHash(hashToken(token)) : undefined;
    session = resolved && token ? { ...resolved, sessionToken: token } : undefined;
  } else {
    session = resolveSession(await db.read(), token);
  }
  if (!session) throw new ApiError(401, "unauthenticated", "Authentication is required.");
  if (session.user.status !== "active") throw new ApiError(403, "account_inactive", "Account is not active.");
  return session;
}

async function runAdventureWorkspaceOperation<T>(
  db: BackendDb,
  ownerUserId: string,
  adventureId: string,
  operation: (data: LocalDbData) => T | Promise<T>,
): Promise<T> {
  if (!db.loadAdventureWorkspace || !db.saveAdventureWorkspace) {
    return db.updatePersistingOnError(operation);
  }
  const workspace = await db.loadAdventureWorkspace(ownerUserId, adventureId);
  try {
    const result = await operation(workspace.data);
    await db.saveAdventureWorkspace(ownerUserId, adventureId, workspace.baseRevision, workspace.data);
    return result;
  } catch (error) {
    await db.saveAdventureWorkspace(ownerUserId, adventureId, workspace.baseRevision, workspace.data);
    throw error;
  }
}

async function runAccountWorkspaceOperation<T>(
  db: BackendDb,
  userId: string,
  operation: (data: LocalDbData) => T | Promise<T>,
): Promise<T> {
  if (!db.loadAccountWorkspace || !db.saveAccountWorkspace) return db.updatePersistingOnError(operation);
  const workspace = await db.loadAccountWorkspace(userId);
  try {
    const result = await operation(workspace);
    await db.saveAccountWorkspace(userId, workspace);
    return result;
  } catch (error) {
    await db.saveAccountWorkspace(userId, workspace);
    throw error;
  }
}

async function executeIdempotent<T>(
  db: BackendDb,
  config: ApiConfig,
  request: IncomingMessage,
  userId: string,
  operation: string,
  requestBody: unknown,
  run: () => Promise<T>,
): Promise<T> {
  await enforceRateLimit(db, config, request, "provider-operation", userId, 30, 60_000);
  const header = request.headers["idempotency-key"];
  const key = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!key || key.length < 8 || key.length > 200) {
    throw new ApiError(400, "idempotency_key_required", "Idempotency-Key header is required for provider-backed operations.");
  }
  if (!db.claimIdempotency || !db.completeIdempotency) return run();
  const requestHash = hashToken(canonicalJson(requestBody ?? null));
  let claim;
  try {
    claim = await db.claimIdempotency(
      userId,
      operation,
      key,
      requestHash,
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Idempotency key")) {
      throw new ApiError(409, "idempotency_key_reused", "This idempotency key was already used for a different request.", error);
    }
    throw error;
  }
  if (claim.state === "succeeded") return claim.responseBody as T;
  if (claim.state === "failed") throw new ApiError(409, "idempotency_failed", "The previous attempt for this idempotency key failed.");
  if (claim.state === "pending") throw new ApiError(409, "idempotency_pending", "An operation with this idempotency key is still pending.");
  try {
    const result = await run();
    await db.completeIdempotency(userId, operation, key, "succeeded", 200, result);
    return result;
  } catch (error) {
    await db.completeIdempotency(userId, operation, key, "failed", 500, { error: "Provider-backed operation failed." });
    throw error;
  }
}

async function enforceRateLimit(
  db: BackendDb,
  config: ApiConfig,
  request: IncomingMessage,
  route: string,
  identity: string | undefined,
  limit: number,
  windowMs: number,
): Promise<void> {
  if (!db.consumeRateLimit) return;
  const ipHash = hashToken(trustedClientIp(request, config));
  const identityHash = identity?.trim().toLowerCase() ? hashToken(identity.trim().toLowerCase()) : "none";
  const result = await db.consumeRateLimit(`${route}:${ipHash}:${identityHash}`, limit, windowMs);
  if (!result.allowed) throw new ApiError(429, "rate_limited", "Too many requests. Wait briefly and try again.", undefined, result.retryAfterSeconds);
}

function trustedClientIp(request: IncomingMessage, config: ApiConfig): string {
  if (config.trustedProxyHops > 0) {
    const raw = request.headers["x-forwarded-for"];
    const forwarded = (Array.isArray(raw) ? raw[0] : raw)?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    const index = forwarded.length - config.trustedProxyHops;
    if (index >= 0 && forwarded[index]) return forwarded[index];
  }
  return request.socket.remoteAddress ?? "unknown";
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function requireStringFields(body: object, fields: string[]): void {
  const record = body as Record<string, unknown>;
  for (const field of fields) {
    if (typeof record[field] !== "string" || !record[field].trim()) {
      throw new ApiError(400, "invalid_request", `${field} must be a non-empty string.`);
    }
  }
}

function requireObjectField(body: object, field: string): void {
  const value = (body as Record<string, unknown>)[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "invalid_request", `${field} must be an object.`);
  }
}

async function assertAdmin(request: IncomingMessage, config: ApiConfig, db: BackendDb): Promise<string | undefined> {
  if (config.adminKey && request.headers["x-admin-key"] === config.adminKey) return undefined;
  const session = await requireSession(request, db).catch(() => undefined);
  if (session) {
    applyConfiguredAdminRole({ users: [session.user] }, session.user, config);
    if (isAdminUser(session.user, config)) {
      return session.user.id;
    }
  }
  if (!config.adminKey && config.adminEmails.length === 0) return undefined;
  throw new ApiError(403, "admin_required", "Admin access is required.");
}

function publicSession(result: AuthSessionResult, config: ApiConfig) {
  return {
    user: publicUser(result.user, config),
    profile: result.profile,
    sessionToken: config.databaseUrl ? "cookie" : result.sessionToken,
    expiresAt: result.session.expiresAt,
  };
}

function publicUser(user: AuthSessionResult["user"], config: ApiConfig) {
  return {
    ...user,
    role: isAdminUser(user, config) ? "admin" : user.role ?? "user",
  };
}

function applyConfiguredAdminRole(
  data: { users: AuthSessionResult["user"][]; adminActions?: LocalDbData["adminActions"] },
  user: AuthSessionResult["user"],
  config: ApiConfig,
): void {
  if (config.adminEmails.length === 0) return;
  const nextRole = config.adminEmails.includes(user.email.toLowerCase()) ? "admin" : "user";
  const previousRole = user.role ?? "user";
  user.role = nextRole;
  const stored = data.users.find((entry) => entry.id === user.id);
  if (stored) stored.role = nextRole;
  if (previousRole !== nextRole && data.adminActions) {
    data.adminActions.push({
      id: `admin_role_${createTraceId()}`,
      action: nextRole === "admin" ? "configured_admin_granted" : "configured_admin_revoked",
      targetType: "user",
      targetId: user.id,
      reason: "Reconciled from AIST_ADMIN_EMAILS.",
      createdAt: new Date().toISOString(),
    });
  }
}

function authSessionHeaders(config: ApiConfig, headers: Record<string, string>, result: AuthSessionResult): Record<string, string> {
  return config.databaseUrl
    ? { ...headers, "Set-Cookie": hostedSessionCookie(result.sessionToken, result.session.expiresAt) }
    : headers;
}

function hostedSessionCookie(token: string, expiresAt: string): string {
  return `__Host-aist_session=${encodeURIComponent(token)}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; Secure; HttpOnly; SameSite=Lax`;
}

function expiredSessionCookie(): string {
  return "__Host-aist_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
}

function sessionCookie(request: IncomingMessage): string | undefined {
  const raw = request.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === "__Host-aist_session") return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function isAdminUser(user: AuthSessionResult["user"], config: ApiConfig): boolean {
  return config.adminEmails.length > 0
    ? config.adminEmails.includes(user.email.toLowerCase())
    : user.role === "admin";
}

function assertScenarioPublishingEnabled(data: Parameters<typeof getPlatformSettings>[0], config: ApiConfig): void {
  if (!getPlatformSettings(data, config).features.scenarioPublishingEnabled) {
    throw new Error("Scenario publishing is disabled by platform settings.");
  }
}

function sendOAuthRedirect(
  response: ServerResponse,
  returnTo: string,
  exchangeCode: string,
  extraHeaders: Record<string, string>,
): void {
  const target = new URL(returnTo);
  target.hash = `oauthExchange=${encodeURIComponent(exchangeCode)}`;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    ...extraHeaders,
  });
  response.end(`<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(target.toString())});</script>`);
}

function authActionUrl(baseUrl: string, action: "verifyEmail" | "passwordReset", token: string): string {
  const target = new URL(baseUrl);
  target.hash = `${action}=${encodeURIComponent(token)}`;
  return target.toString();
}

function genericPasswordResetResponse(): { ok: true; message: string } {
  return {
    ok: true,
    message: "If an account exists for that email, a password-reset link has been sent.",
  };
}

function authUpdate<T>(db: BackendDb, mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
  return db.updateAuth ? db.updateAuth(mutate) : db.update(mutate);
}

function assertEmailCapability(config: ApiConfig): void {
  if (config.emailDeliveryMode === "disabled") {
    throw new ApiError(503, "email_delivery_disabled", "Account signup and recovery email are disabled during controlled UAT.");
  }
}

function serverCapabilities(config: ApiConfig) {
  const emailEnabled = config.emailDeliveryMode === "resend"
    && Boolean(config.emailDelivery || (config.resendApiKey && config.emailFrom));
  const googleOAuth = Boolean(
    config.googleOAuth.clientId
    && config.googleOAuth.clientSecret
    && config.googleOAuth.redirectUri.startsWith("https://"),
  );
  return {
    passwordLogin: true,
    passwordSignup: emailEnabled,
    passwordReset: emailEnabled,
    emailVerificationDelivery: emailEnabled,
    googleOAuth,
  };
}

function validatedClientTrace(body: Partial<PerformanceTraceRecord>) {
  if (body.source !== undefined && body.source !== "device") {
    throw new ApiError(400, "invalid_telemetry", "Telemetry source must be device.");
  }
  if (body.status !== "ok" && body.status !== "error") {
    throw new ApiError(400, "invalid_telemetry", "Telemetry status must be ok or error.");
  }
  if (typeof body.durationMs !== "number" || !Number.isFinite(body.durationMs) || body.durationMs < 0 || body.durationMs > 3_600_000) {
    throw new ApiError(400, "invalid_telemetry", "Telemetry duration is invalid.");
  }
  const short = (value: unknown, max: number): string | undefined =>
    typeof value === "string" && value.length <= max ? value : undefined;
  const boundedNumber = (value: unknown, max: number): number | undefined =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
  const metadata: NonNullable<PerformanceTraceRecord["metadata"]> = {};
  if (body.metadata && typeof body.metadata === "object") {
    for (const [key, value] of Object.entries(body.metadata).slice(0, 20)) {
      if (!/^[A-Za-z0-9_.-]{1,50}$/.test(key)) continue;
      if (typeof value === "string") metadata[key] = value.slice(0, 200);
      else if (typeof value === "number" && Number.isFinite(value)) metadata[key] = value;
      else if (typeof value === "boolean") metadata[key] = value;
    }
  }
  return {
    traceId: short(body.traceId, 200),
    phase: short(body.phase, 80) ?? "http_round_trip",
    route: short(body.route, 300),
    method: short(body.method, 12),
    status: body.status,
    statusCode: boundedNumber(body.statusCode, 599),
    durationMs: body.durationMs,
    requestBytes: boundedNumber(body.requestBytes, 20_000_000),
    responseBytes: boundedNumber(body.responseBytes, 20_000_000),
    errorCategory: short(body.errorCategory, 80),
    errorMessage: body.errorMessage === undefined ? undefined : sanitizeErrorMessage(short(body.errorMessage, 500) ?? "invalid client error"),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function corsFor(request: IncomingMessage, config: ApiConfig): Record<string, string> {
  const origin = request.headers.origin;
  const allowOrigin = typeof origin === "string" && config.allowedOrigins.includes(origin) ? origin : undefined;
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    ...(allowOrigin ? { "Access-Control-Allow-Credentials": "true" } : {}),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Admin-Key, X-AIST-CSRF, X-AIST-Trace-Id, X-AIST-Client-Sent-At, X-AIST-Client-Path",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

function requestTraceId(request: IncomingMessage): string {
  const header = request.headers["x-aist-trace-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : createTraceId();
}

function numericHeader(value: string | string[] | number | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function shouldTraceRequest(pathname: string): boolean {
  return !["/health", "/readyz", "/livez", "/version", "/telemetry/client"].includes(pathname);
}

async function recordTrace(db: BackendDb, record: PerformanceTraceRecord): Promise<void> {
  try {
    if (db.recordPerformanceTrace) {
      await db.recordPerformanceTrace(record);
      return;
    }
    await db.update((data) => {
      data.performanceTraces.push(record);
      if (data.performanceTraces.length > 2_000) {
        data.performanceTraces = data.performanceTraces
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 2_000);
      }
    });
  } catch (error) {
    console.warn("Failed to record performance trace:", errorMessage(error));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function resetLocalDbForTests(config: ApiConfig): Promise<void> {
  const db = createBackendDb(config);
  await db.write(createEmptyDb());
  await db.close();
}
