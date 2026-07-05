import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { normalizeAdventure, sanitizeAdventureForPersistence } from "../../src/state/defaults";
import type { Adventure } from "../../src/types/adventure";
import { createEmptyDb, LocalDb } from "./localDb";
import { loadApiConfig, type ApiConfig } from "./config";
import {
  confirmPasswordReset,
  createInvite,
  loginWithPassword,
  previewInvite,
  requestPasswordReset,
  resolveSession,
  signupWithLocalGoogle,
  signupWithPassword,
  verifyEmailToken,
  type AuthSessionResult,
} from "./auth";
import {
  buildServerContextPreview,
  getOwnedAdventureRecord,
  importAdventureAsCopy,
  runBackendTurn,
  saveBackendAdventure,
  summarizeAdventure,
} from "./adventureStore";
import { currentRestriction } from "./accountSafety";
import { createScenarioDraft, createScenarioRevision, publishScenarioRevision } from "./scenarioSharing";
import { bearerToken, readJsonBody, routePath, sendJson } from "./http";
import { PolicyBlockedError } from "./policy";

export interface ApiServer {
  server: Server;
  config: ApiConfig;
  db: LocalDb;
  listen(): Promise<{ port: number; url: string }>;
  close(): Promise<void>;
}

export function createApiServer(overrides: Partial<ApiConfig> = {}): ApiServer {
  const config = loadApiConfig(overrides);
  const db = new LocalDb(config.dataFile);
  const server = createServer((request, response) => {
    void handleRequest(request, response, config, db);
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
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, config: ApiConfig, db: LocalDb): Promise<void> {
  const corsHeaders = corsFor(request, config);
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  try {
    const route = routePath(request);
    if (request.method === "GET" && route.pathname === "/health") {
      const data = await db.read();
      sendJson(response, 200, { ok: true, schemaVersion: data.schemaVersion, migrations: data.migrations }, corsHeaders);
      return;
    }
    if (request.method === "GET" && route.pathname === "/version") {
      sendJson(response, 200, { app: "ai-story-teller-api", mode: "local", policyMode: config.policyMode }, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/admin/invites") {
      await assertAdmin(request, config);
      const { body } = await readJsonBody<{ expiresInDays?: number; maxUses?: number; note?: string }>(request);
      const created = await db.update((data) => createInvite(data, body));
      sendJson(response, 201, created, corsHeaders);
      return;
    }

    if (request.method === "GET" && route.segments[0] === "invites" && route.segments[2] === "preview") {
      const token = route.segments[1];
      const preview = await db.update((data) => previewInvite(data, token));
      sendJson(response, preview.valid ? 200 : 404, preview, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/signup/password") {
      const { body, remoteKey } = await readJsonBody<{ inviteToken: string; email: string; password: string; displayName?: string }>(request);
      const result = await db.update((data) => signupWithPassword(data, { ...body, remoteKey }));
      sendJson(response, 201, result, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/email/verify") {
      const { body } = await readJsonBody<{ token: string }>(request);
      const result = await db.update((data) => verifyEmailToken(data, body.token));
      sendJson(response, 200, publicSession(result), corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/login/password") {
      const { body, remoteKey } = await readJsonBody<{ email: string; password: string }>(request);
      const result = await db.update((data) => loginWithPassword(data, { ...body, remoteKey }));
      sendJson(response, 200, publicSession(result), corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/password-reset/request") {
      const { body } = await readJsonBody<{ email: string }>(request);
      const result = await db.update((data) => requestPasswordReset(data, body.email));
      sendJson(response, 200, result, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/password-reset/confirm") {
      const { body } = await readJsonBody<{ token: string; password: string }>(request);
      await db.update((data) => confirmPasswordReset(data, body));
      sendJson(response, 200, { ok: true }, corsHeaders);
      return;
    }

    if (request.method === "POST" && route.pathname === "/auth/google/local") {
      if (!config.allowLocalGoogleStub) throw new Error("Local Google stub is disabled.");
      const { body, remoteKey } = await readJsonBody<{ inviteToken: string; email: string; googleSubject: string; displayName?: string }>(request);
      const result = await db.update((data) => signupWithLocalGoogle(data, { ...body, remoteKey }));
      sendJson(response, 200, publicSession(result), corsHeaders);
      return;
    }

    if (request.method === "GET" && route.pathname === "/auth/session") {
      const session = await requireSession(request, db);
      const data = await db.read();
      sendJson(response, 200, { ...publicSession(session), restriction: currentRestriction(data, session.user.id) }, corsHeaders);
      return;
    }

    if (route.segments[0] === "adventures") {
      const session = await requireSession(request, db);
      await handleAdventureRoute(request, response, route.segments, session, config, db, corsHeaders);
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

    if (request.method === "GET" && route.pathname === "/admin/account-safety-events") {
      await assertAdmin(request, config);
      const data = await db.read();
      sendJson(response, 200, {
        events: data.accountSafetyEvents,
        restrictions: data.accountRestrictions,
        policyDecisions: data.policyDecisions,
      }, corsHeaders);
      return;
    }

    sendJson(response, 404, { error: "Route not found." }, corsHeaders);
  } catch (error) {
    const status = error instanceof PolicyBlockedError ? 422 : /not found/i.test(errorMessage(error)) ? 404 : /unauthorized|forbidden|admin/i.test(errorMessage(error)) ? 401 : 400;
    sendJson(response, status, { error: errorMessage(error) }, corsHeaders);
  }
}

async function handleAdventureRoute(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  session: AuthSessionResult,
  config: ApiConfig,
  db: LocalDb,
  corsHeaders: Record<string, string>,
): Promise<void> {
  const userId = session.user.id;
  if (request.method === "GET" && segments.length === 1) {
    const data = await db.read();
    const summaries = data.adventures.filter((entry) => entry.ownerUserId === userId).map((entry) => summarizeAdventure(entry.adventure));
    sendJson(response, 200, summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[1] === "import") {
    const { body } = await readJsonBody(request, 10_000_000);
      const imported = await db.updatePersistingOnError((data) => importAdventureAsCopy(data, userId, body as never, config));
    sendJson(response, 201, { adventures: imported.map(summarizeAdventure) }, corsHeaders);
    return;
  }
  const adventureId = segments[1];
  if (!adventureId) throw new Error("Adventure id is required.");
  if (request.method === "GET" && segments.length === 2) {
    const data = await db.read();
    sendJson(response, 200, getOwnedAdventureRecord(data, userId, adventureId).adventure, corsHeaders);
    return;
  }
  if (request.method === "PUT" && segments.length === 2) {
    const { body } = await readJsonBody<{ adventure: Adventure }>(request, 10_000_000);
    const saved = await db.update((data) => saveBackendAdventure(data, userId, normalizeAdventure(sanitizeAdventureForPersistence(body.adventure)), "manualSave"));
    sendJson(response, 200, summarizeAdventure(saved.adventure), corsHeaders);
    return;
  }
  if (request.method === "DELETE" && segments.length === 2) {
    await db.update((data) => {
      data.adventures = data.adventures.filter((entry) => !(entry.ownerUserId === userId && entry.id === adventureId));
    });
    sendJson(response, 200, { ok: true }, corsHeaders);
    return;
  }
  if (request.method === "GET" && segments[2] === "export") {
    const data = await db.read();
    sendJson(response, 200, getOwnedAdventureRecord(data, userId, adventureId).adventure, corsHeaders);
    return;
  }
  if (request.method === "GET" && segments[2] === "context-preview") {
    const context = await db.updatePersistingOnError((data) => buildServerContextPreview(data, userId, adventureId, config));
    sendJson(response, 200, context, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "turn") {
    const { body } = await readJsonBody<{
      input: string;
      mode?: "do" | "story" | "comms";
      recordUserInput?: boolean;
      providerCue?: string;
      regenerateLastAssistant?: boolean;
    }>(request);
    const result = await db.updatePersistingOnError((data) =>
      runBackendTurn(data, userId, adventureId, body.input ?? "", config, {
        mode: body.mode,
        recordUserInput: body.recordUserInput,
        providerCue: body.providerCue,
        regenerateLastAssistant: body.regenerateLastAssistant,
      }),
    );
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  throw new Error("Adventure route not found.");
}

async function handleScenarioRoute(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  session: AuthSessionResult,
  config: ApiConfig,
  db: LocalDb,
  corsHeaders: Record<string, string>,
): Promise<void> {
  if (request.method === "POST" && segments.length === 1) {
    const { body } = await readJsonBody<{ title: string; description?: string; sourceAdventureId?: string }>(request);
    const scenario = await db.updatePersistingOnError((data) => createScenarioDraft(data, session.user.id, body, config));
    sendJson(response, 201, scenario, corsHeaders);
    return;
  }
  if (request.method === "POST" && segments[2] === "revisions") {
    const { body } = await readJsonBody<{ title?: string; description?: string; content: unknown }>(request, 10_000_000);
    const revision = await db.updatePersistingOnError((data) => createScenarioRevision(data, session.user.id, segments[1], body, config));
    sendJson(response, 201, revision, corsHeaders);
    return;
  }
  throw new Error("Scenario route not found.");
}

async function handleScenarioRevisionRoute(
  request: IncomingMessage,
  response: ServerResponse,
  segments: string[],
  session: AuthSessionResult,
  config: ApiConfig,
  db: LocalDb,
  corsHeaders: Record<string, string>,
): Promise<void> {
  if (request.method === "POST" && segments[2] === "publish") {
    const result = await db.updatePersistingOnError((data) => publishScenarioRevision(data, session.user.id, segments[1], config));
    sendJson(response, 200, result, corsHeaders);
    return;
  }
  throw new Error("Scenario revision route not found.");
}

async function requireSession(request: IncomingMessage, db: LocalDb): Promise<AuthSessionResult> {
  const token = bearerToken(request);
  const data = await db.read();
  const session = resolveSession(data, token);
  if (!session) throw new Error("Unauthorized.");
  if (session.user.status !== "active") throw new Error("Account is not active.");
  return session;
}

async function assertAdmin(request: IncomingMessage, config: ApiConfig): Promise<void> {
  if (!config.adminKey) return;
  if (request.headers["x-admin-key"] !== config.adminKey) {
    throw new Error("Admin key required.");
  }
}

function publicSession(result: AuthSessionResult) {
  return {
    user: result.user,
    profile: result.profile,
    sessionToken: result.sessionToken,
    expiresAt: result.session.expiresAt,
  };
}

function corsFor(request: IncomingMessage, config: ApiConfig): Record<string, string> {
  const origin = request.headers.origin;
  const allowOrigin = typeof origin === "string" && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function resetLocalDbForTests(config: ApiConfig): Promise<void> {
  const db = new LocalDb(config.dataFile);
  await db.write(createEmptyDb());
}
