import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createDefaultAdventure } = require("../dist-api/src/state/defaults.js");

const port = 18_000 + Math.floor(Math.random() * 1_000);
const child = spawn(process.execPath, ["dist-api/apps/api/hostedServer.js"], {
  cwd: process.cwd(),
  windowsHide: true,
  env: {
    ...process.env,
    PORT: String(port),
    AIST_API_HOST: "0.0.0.0",
    AIST_API_ALLOWED_ORIGINS: "https://story.example.com",
    AIST_API_ADMIN_KEY: "ci-admin-key",
    AIST_PROVIDER_API_KEY: "ci-provider-key",
    AIST_POLICY_MODE: "reviewOnly",
    AIST_EMAIL_DELIVERY_MODE: "disabled",
    AIST_PASSWORD_SIGNUP_MODE: "trustedInvite",
    AIST_GOOGLE_REDIRECT_URI: "https://api.example.com/auth/google/callback",
    AIST_WEB_APP_URL: "https://story.example.com/",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });

try {
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/readyz`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Hosted API did not become ready.\n${output}`);

  const capabilities = await jsonRequest("/capabilities");
  assertStatus(capabilities, 200, "capabilities");
  if (capabilities.body.passwordSignup !== true
    || capabilities.body.passwordReset !== false
    || capabilities.body.emailVerificationDelivery !== false
    || capabilities.body.inviteRequired !== true) {
    throw new Error(`Hosted API exposed the wrong trusted-invite capabilities: ${JSON.stringify(capabilities.body)}`);
  }

  const createdInvite = await jsonRequest("/admin/invites", {
    method: "POST",
    headers: { "X-Admin-Key": "ci-admin-key", "X-AIST-CSRF": "1" },
    body: JSON.stringify({ maxUses: 1, note: "production smoke" }),
  });
  assertStatus(createdInvite, 201, "invite creation");
  const inviteUrl = new URL(createdInvite.body.inviteUrl);
  if (inviteUrl.origin !== "https://story.example.com"
    || new URLSearchParams(inviteUrl.hash.slice(1)).get("invite") !== createdInvite.body.token) {
    throw new Error(`Hosted API returned an invalid invite URL: ${createdInvite.body.inviteUrl}`);
  }

  const email = `render-smoke-${Date.now()}@example.com`;
  const signupBody = {
    inviteToken: createdInvite.body.token,
    email,
    password: "correct horse battery staple",
    displayName: "Render Smoke",
  };
  const signup = await jsonRequest("/auth/signup/password", {
    method: "POST",
    headers: { "X-AIST-CSRF": "1" },
    body: JSON.stringify(signupBody),
  });
  assertStatus(signup, 201, "trusted-invite signup");
  if (signup.body.verificationRequired !== false
    || signup.body.user?.status !== "active"
    || signup.body.user?.emailVerified !== false
    || !signup.headers.get("set-cookie")) {
    throw new Error(`Trusted-invite signup returned the wrong session state: ${JSON.stringify(signup.body)}`);
  }

  const reused = await jsonRequest("/auth/signup/password", {
    method: "POST",
    headers: { "X-AIST-CSRF": "1" },
    body: JSON.stringify({ ...signupBody, email: `reused-${email}` }),
  });
  assertStatus(reused, 400, "one-use invite replay");

  const login = await jsonRequest("/auth/login/password", {
    method: "POST",
    headers: { "X-AIST-CSRF": "1" },
    body: JSON.stringify({ email, password: signupBody.password }),
  });
  assertStatus(login, 200, "trusted-invite password login");

  const sessionCookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!sessionCookie) throw new Error("Smoke login did not return a session cookie.");
  const authHeaders = { Cookie: sessionCookie, "X-AIST-CSRF": "1" };
  const legacy = createDefaultAdventure("Hosted legacy compatibility smoke");
  legacy.rollingSummary = { content: "Retired compression", updatedAt: legacy.createdAt };
  legacy.sceneState = { content: "Retired scene snapshot", updatedAt: legacy.createdAt };
  legacy.messages = [{ id: "smoke-source", role: "assistant", content: "The observatory opened.", createdAt: legacy.createdAt }];
  Object.assign(legacy.tokenBudgetSettings, { autoSummarize: true, summaryEnabled: true, sceneStateEnabled: true, autoSceneStateEveryNTurns: 1 });
  Object.assign(legacy.tokenBudgetSettings.sectionBudgets, { rollingSummary: 900, sceneState: 90 });
  legacy.activeState.pendingUpdates = [{ id: "legacy-update", source: "autoSummary", actions: [{ type: "UPDATE_ROLLING_SUMMARY", content: "Obsolete" }] }];
  const imported = await jsonRequest("/adventures/import", { method: "POST", headers: authHeaders, body: JSON.stringify({ sourceType: "aist", json: legacy }) });
  assertStatus(imported, 201, "legacy hosted import");
  const importedId = imported.body.adventures[0].id;
  const loaded = await jsonRequest(`/adventures/${encodeURIComponent(importedId)}`, { headers: authHeaders });
  assertStatus(loaded, 200, "legacy hosted load");
  assertCurrentAdventure(loaded.body);
  const saved = await jsonRequest(`/adventures/${encodeURIComponent(importedId)}`, { method: "PUT", headers: authHeaders,
    body: JSON.stringify({ adventure: { ...legacy, id: importedId, metadata: loaded.body.metadata } }) });
  assertStatus(saved, 200, "direct legacy hosted save");
  assertCurrentAdventure(saved.body);
  const exported = await jsonRequest(`/adventures/${encodeURIComponent(importedId)}/export`, { headers: authHeaders });
  assertStatus(exported, 200, "current hosted export");
  assertCurrentAdventure(exported.body);
  const accountExport = await jsonRequest("/account/export", { headers: authHeaders });
  assertStatus(accountExport, 200, "account export");
  accountExport.body.adventures.forEach(assertCurrentAdventure);

  const reset = await jsonRequest("/auth/password-reset/request", {
    method: "POST",
    headers: { "X-AIST-CSRF": "1" },
    body: JSON.stringify({ email }),
  });
  assertStatus(reset, 503, "disabled password recovery");

  child.kill("SIGTERM");
  const exit = await new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  const windowsSignalExit = process.platform === "win32" && exit.code === null && exit.signal === "SIGTERM";
  if (exit.code !== 0 && !windowsSignalExit) {
    throw new Error(`Hosted API exited with code ${exit.code} and signal ${exit.signal}.\n${output}`);
  }
  console.log(`Hosted API production smoke passed on port ${port}.`);
} finally {
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function jsonRequest(path, init = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined, headers: response.headers };
}

function assertStatus(result, expected, label) {
  if (result.status !== expected) {
    throw new Error(`${label} returned HTTP ${result.status}; expected ${expected}. Body: ${JSON.stringify(result.body)}`);
  }
}

function assertCurrentAdventure(adventure) {
  if (/"(?:rollingSummary|sceneState|summaryUpdate|autoSummarize|summaryEnabled|sceneStateEnabled|autoSceneStateEveryNTurns|UPDATE_ROLLING_SUMMARY|autoSummary)"/.test(JSON.stringify(adventure))) {
    throw new Error("Hosted output retained a retired feature.");
  }
  if (adventure.messages.length !== 1 || adventure.messages[0].content !== "The observatory opened.") throw new Error("Hosted legacy transcript changed.");
  if (Object.keys(adventure.memoryAutoApprove).length !== 7) throw new Error("Hosted approval contract is not seven categories.");
}
