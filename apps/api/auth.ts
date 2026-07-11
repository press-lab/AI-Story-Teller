import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type {
  AuthIdentity,
  BackendUser,
  InviteLink,
  LocalDbData,
  OAuthExchangeRecord,
  OAuthStateRecord,
  PasswordCredential,
  SessionRecord,
  SignupIntent,
  UserProfile,
  VerificationToken,
} from "./apiTypes";
import type { ApiConfig } from "./config";
import { addDays, addHours, createId, hashToken, isPast, nowIso, randomToken } from "./ids";

const scrypt = promisify(scryptCallback) as unknown as (
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;
const PASSWORD_KEY_BYTES = 64;
const PASSWORD_PARAMETER_VERSION = 2;
const PRODUCTION_SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const TEST_SCRYPT = { N: 1 << 12, r: 8, p: 1, maxmem: 16 * 1024 * 1024 };

export interface CreatedInvite {
  invite: InviteLink;
  token: string;
}

export interface AuthSessionResult {
  user: BackendUser;
  profile: UserProfile;
  sessionToken: string;
  session: SessionRecord;
}

export interface PasswordSignupResult {
  user: BackendUser;
  profile: UserProfile;
  verification: IssuedAuthToken;
}

export interface IssuedAuthToken {
  token: string;
  expiresAt: string;
}

export interface GoogleOAuthStartResult {
  authUrl: string;
  expiresAt: string;
}

export interface GoogleOAuthProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

export interface GoogleOAuthCompleteResult extends AuthSessionResult {
  returnTo?: string;
}

export interface OAuthExchangeResult {
  exchangeCode: string;
  expiresAt: string;
  returnTo?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
  parameters = process.env.NODE_ENV === "test" ? TEST_SCRYPT : PRODUCTION_SCRYPT,
): Promise<{ hash: string; salt: string; N: number; r: number; p: number }> {
  const key = await scrypt(password, salt, PASSWORD_KEY_BYTES, parameters) as Buffer;
  return { hash: key.toString("hex"), salt, N: parameters.N, r: parameters.r, p: parameters.p };
}

async function verifyPassword(password: string, credential: PasswordCredential): Promise<boolean> {
  const parameters = credential.parameterVersion
    ? {
      N: credential.scryptN ?? PRODUCTION_SCRYPT.N,
      r: credential.scryptR ?? PRODUCTION_SCRYPT.r,
      p: credential.scryptP ?? PRODUCTION_SCRYPT.p,
      maxmem: Math.max(16 * 1024 * 1024, 256 * (credential.scryptN ?? PRODUCTION_SCRYPT.N) * (credential.scryptR ?? PRODUCTION_SCRYPT.r)),
    }
    : { N: 1 << 14, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
  const { hash } = await hashPassword(password, credential.salt, parameters);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(credential.passwordHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createInvite(data: LocalDbData, options: { expiresInDays?: number; maxUses?: number; note?: string; createdByUserId?: string } = {}): CreatedInvite {
  const token = randomToken(32);
  const now = nowIso();
  const invite: InviteLink = {
    id: createId("invite"),
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: options.expiresInDays === undefined ? addDays(14) : addDays(options.expiresInDays),
    maxUses: Math.max(1, Math.floor(options.maxUses ?? 1)),
    useCount: 0,
    note: options.note,
    createdByUserId: options.createdByUserId,
  };
  data.inviteLinks.push(invite);
  return { invite, token };
}

export function previewInvite(data: LocalDbData, token: string): { valid: boolean; reason?: string; invite?: InviteLink } {
  const invite = data.inviteLinks.find((entry) => entry.tokenHash === hashToken(token));
  if (!invite) return { valid: false, reason: "Invite not found." };
  if (invite.disabledAt) return { valid: false, reason: "Invite is disabled.", invite };
  if (isPast(invite.expiresAt)) return { valid: false, reason: "Invite is expired.", invite };
  if (invite.useCount >= invite.maxUses) return { valid: false, reason: "Invite has already been used.", invite };
  return { valid: true, invite };
}

function consumeInvite(data: LocalDbData, token: string): InviteLink {
  const preview = previewInvite(data, token);
  if (!preview.valid || !preview.invite) {
    const reason = preview.reason && !/not found/i.test(preview.reason) ? preview.reason : "Invite is not valid.";
    throw new Error(reason);
  }
  preview.invite.useCount += 1;
  return preview.invite;
}

function consumeInviteById(data: LocalDbData, inviteId: string): InviteLink {
  const invite = data.inviteLinks.find((entry) => entry.id === inviteId);
  if (!invite) throw new Error("Invite is not valid.");
  if (invite.disabledAt) throw new Error("Invite is disabled.");
  if (isPast(invite.expiresAt)) throw new Error("Invite is expired.");
  if (invite.useCount >= invite.maxUses) throw new Error("Invite has already been used.");
  invite.useCount += 1;
  return invite;
}

function assertUniqueEmail(data: LocalDbData, email: string): void {
  if (data.users.some((user) => user.email === email)) {
    throw new Error("An account with that email already exists.");
  }
}

function createUserAndProfile(data: LocalDbData, input: { email: string; displayName?: string; status: BackendUser["status"]; emailVerified: boolean }): { user: BackendUser; profile: UserProfile } {
  const now = nowIso();
  const displayName = input.displayName?.trim() || input.email.split("@")[0] || "Player";
  const user: BackendUser = {
    id: createId("user"),
    email: input.email,
    displayName,
    status: input.status,
    emailVerified: input.emailVerified,
    createdAt: now,
    updatedAt: now,
  };
  const profile: UserProfile = {
    userId: user.id,
    displayName,
    bio: "",
    createdAt: now,
    updatedAt: now,
  };
  data.users.push(user);
  data.profiles.push(profile);
  return { user, profile };
}

function createSignupIntent(data: LocalDbData, inviteId: string, email: string, provider: "password" | "google"): SignupIntent {
  const intent: SignupIntent = {
    id: createId("signup"),
    inviteId,
    email,
    provider,
    status: "completed",
    createdAt: nowIso(),
    completedAt: nowIso(),
  };
  data.signupIntents.push(intent);
  return intent;
}

export function createGoogleOAuthStart(
  data: LocalDbData,
  input: { inviteToken?: string; returnTo?: string },
  config: ApiConfig,
): GoogleOAuthStartResult {
  if (!config.googleOAuth.clientId) throw new Error("Google OAuth client id is not configured.");
  let inviteId: string | undefined;
  const inviteToken = input.inviteToken?.trim();
  if (inviteToken) {
    const preview = previewInvite(data, inviteToken);
    if (!preview.valid || !preview.invite) {
      const reason = preview.reason && !/not found/i.test(preview.reason) ? preview.reason : "Invite is not valid.";
      throw new Error(reason);
    }
    inviteId = preview.invite.id;
  }
  const state = randomToken(32);
  const record: OAuthStateRecord = {
    id: createId("oauth_state"),
    provider: "google",
    tokenHash: hashToken(state),
    inviteId,
    returnTo: sanitizeReturnTo(input.returnTo, config),
    createdAt: nowIso(),
    expiresAt: addHours(1),
  };
  data.oauthStates.push(record);

  const authUrl = new URL(config.googleOAuth.authUrl);
  authUrl.searchParams.set("client_id", config.googleOAuth.clientId);
  authUrl.searchParams.set("redirect_uri", config.googleOAuth.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  return { authUrl: authUrl.toString(), expiresAt: record.expiresAt };
}

export async function completeGoogleOAuth(
  data: LocalDbData,
  input: { code: string; state: string },
  config: ApiConfig,
): Promise<GoogleOAuthCompleteResult> {
  const record = consumeOAuthState(data, input.state);
  const googleProfile = await fetchGoogleOAuthProfile(input.code, config);
  const result = completeGoogleSignin(data, googleProfile, record.inviteId);
  return { ...result, returnTo: record.returnTo };
}

export function createOAuthExchange(
  data: LocalDbData,
  session: AuthSessionResult,
  returnTo?: string,
): OAuthExchangeResult {
  data.sessions = data.sessions.filter((entry) => entry.id !== session.session.id);
  data.oauthExchangeCodes = data.oauthExchangeCodes.filter((entry) => !entry.consumedAt && !isPast(entry.expiresAt));
  const exchangeCode = randomToken(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const record: OAuthExchangeRecord = {
    id: createId("oauth_exchange"),
    codeHash: hashToken(exchangeCode),
    userId: session.user.id,
    returnTo,
    createdAt: nowIso(),
    expiresAt,
  };
  data.oauthExchangeCodes.push(record);
  return { exchangeCode, expiresAt, returnTo };
}

export function consumeOAuthExchange(data: LocalDbData, exchangeCode: string): AuthSessionResult {
  const record = data.oauthExchangeCodes.find((entry) => entry.codeHash === hashToken(exchangeCode));
  if (!record || record.consumedAt || isPast(record.expiresAt)) throw new Error("OAuth exchange code is invalid or expired.");
  record.consumedAt = nowIso();
  const user = data.users.find((entry) => entry.id === record.userId);
  const profile = data.profiles.find((entry) => entry.userId === record.userId);
  if (!user || !profile || user.status !== "active") throw new Error("OAuth account is not active.");
  return createSession(data, user, profile);
}

export async function signupWithPassword(
  data: LocalDbData,
  input: { inviteToken: string; email: string; password: string; displayName?: string },
): Promise<PasswordSignupResult> {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (input.password.length < 10) throw new Error("Password must be at least 10 characters.");
  assertUniqueEmail(data, email);
  const invite = consumeInvite(data, input.inviteToken);
  const { user, profile } = createUserAndProfile(data, {
    email,
    displayName: input.displayName,
    status: "pending_verification",
    emailVerified: false,
  });
  createSignupIntent(data, invite.id, email, "password");
  const password = await hashPassword(input.password);
  data.passwordCredentials.push({
    userId: user.id,
    passwordHash: password.hash,
    salt: password.salt,
    algorithm: "scrypt",
    parameterVersion: PASSWORD_PARAMETER_VERSION,
    scryptN: password.N,
    scryptR: password.r,
    scryptP: password.p,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const verification = createVerificationToken(data, user.id, "emailVerification", 24);
  return {
    user,
    profile,
    verification: { token: verification.token, expiresAt: verification.record.expiresAt },
  };
}

export function signupWithLocalGoogle(
  data: LocalDbData,
  input: { inviteToken: string; email: string; googleSubject: string; displayName?: string },
): AuthSessionResult {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  if (!input.googleSubject.trim()) throw new Error("Google subject is required.");
  const existingIdentity = data.authIdentities.find((identity) => identity.provider === "google" && identity.providerSubject === input.googleSubject);
  if (existingIdentity) {
    const user = data.users.find((entry) => entry.id === existingIdentity.userId);
    const profile = data.profiles.find((entry) => entry.userId === existingIdentity.userId);
    if (!user || !profile) throw new Error("Google identity is incomplete.");
    return createSession(data, user, profile);
  }
  assertUniqueEmail(data, email);
  const invite = consumeInvite(data, input.inviteToken);
  const { user, profile } = createUserAndProfile(data, {
    email,
    displayName: input.displayName,
    status: "active",
    emailVerified: true,
  });
  createSignupIntent(data, invite.id, email, "google");
  const identity: AuthIdentity = {
    id: createId("identity"),
    userId: user.id,
    provider: "google",
    providerSubject: input.googleSubject,
    email,
    createdAt: nowIso(),
  };
  data.authIdentities.push(identity);
  return createSession(data, user, profile);
}

export function completeGoogleSignin(data: LocalDbData, googleProfile: GoogleOAuthProfile, inviteId?: string): AuthSessionResult {
  const email = normalizeEmail(googleProfile.email);
  if (!email.includes("@")) throw new Error("Google did not return a valid email address.");
  if (!googleProfile.emailVerified) throw new Error("Google email must be verified.");
  if (!googleProfile.sub.trim()) throw new Error("Google subject is missing.");

  const existingIdentity = data.authIdentities.find((identity) => identity.provider === "google" && identity.providerSubject === googleProfile.sub);
  if (existingIdentity) {
    const user = data.users.find((entry) => entry.id === existingIdentity.userId);
    const profile = data.profiles.find((entry) => entry.userId === existingIdentity.userId);
    if (!user || !profile) throw new Error("Google identity is incomplete.");
    if (user.status !== "active") throw new Error("Account is not active.");
    return createSession(data, user, profile);
  }

  const existingUser = data.users.find((user) => user.email === email);
  if (existingUser) {
    const profile = data.profiles.find((entry) => entry.userId === existingUser.id);
    if (!profile) throw new Error("Account profile is missing.");
    existingUser.emailVerified = true;
    existingUser.status = "active";
    existingUser.updatedAt = nowIso();
    data.authIdentities.push({
      id: createId("identity"),
      userId: existingUser.id,
      provider: "google",
      providerSubject: googleProfile.sub,
      email,
      createdAt: nowIso(),
    });
    return createSession(data, existingUser, profile);
  }

  if (!inviteId) throw new Error("Invite is required for new Google accounts.");
  const invite = consumeInviteById(data, inviteId);
  const { user, profile } = createUserAndProfile(data, {
    email,
    displayName: googleProfile.name,
    status: "active",
    emailVerified: true,
  });
  createSignupIntent(data, invite.id, email, "google");
  data.authIdentities.push({
    id: createId("identity"),
    userId: user.id,
    provider: "google",
    providerSubject: googleProfile.sub,
    email,
    createdAt: nowIso(),
  });
  return createSession(data, user, profile);
}

export async function loginWithPassword(data: LocalDbData, input: { email: string; password: string }): Promise<AuthSessionResult> {
  const email = normalizeEmail(input.email);
  const user = data.users.find((entry) => entry.email === email);
  if (!user) throw new Error("Invalid email or password.");
  if (user.status !== "active" || !user.emailVerified) {
    throw new Error("Verify this account before logging in.");
  }
  const credential = data.passwordCredentials.find((entry) => entry.userId === user.id);
  if (!credential || !(await verifyPassword(input.password, credential))) {
    throw new Error("Invalid email or password.");
  }
  if ((credential.parameterVersion ?? 1) < PASSWORD_PARAMETER_VERSION) {
    const upgraded = await hashPassword(input.password);
    credential.passwordHash = upgraded.hash;
    credential.salt = upgraded.salt;
    credential.algorithm = "scrypt";
    credential.parameterVersion = PASSWORD_PARAMETER_VERSION;
    credential.scryptN = upgraded.N;
    credential.scryptR = upgraded.r;
    credential.scryptP = upgraded.p;
    credential.updatedAt = nowIso();
  }
  const profile = data.profiles.find((entry) => entry.userId === user.id);
  if (!profile) throw new Error("Account profile is missing.");
  return createSession(data, user, profile);
}

export function createSession(data: LocalDbData, user: BackendUser, profile: UserProfile): AuthSessionResult {
  const sessionToken = randomToken(32);
  const session: SessionRecord = {
    id: createId("session"),
    userId: user.id,
    tokenHash: hashToken(sessionToken),
    createdAt: nowIso(),
    expiresAt: addDays(7),
  };
  data.sessions.push(session);
  return { user, profile, sessionToken, session };
}

export function resolveSession(data: LocalDbData, token: string | undefined): AuthSessionResult | undefined {
  if (!token) return undefined;
  const tokenHash = hashToken(token);
  const session = data.sessions.find((entry) => entry.tokenHash === tokenHash && !entry.revokedAt && !isPast(entry.expiresAt));
  if (!session) return undefined;
  const user = data.users.find((entry) => entry.id === session.userId);
  const profile = data.profiles.find((entry) => entry.userId === session.userId);
  if (!user || !profile) return undefined;
  return { user, profile, sessionToken: token, session };
}

export function createVerificationToken(
  data: LocalDbData,
  userId: string,
  purpose: VerificationToken["purpose"],
  expiresInHours: number,
): { record: VerificationToken; token: string } {
  const token = randomToken(32);
  const record: VerificationToken = {
    id: createId("verify"),
    userId,
    tokenHash: hashToken(token),
    purpose,
    createdAt: nowIso(),
    expiresAt: addHours(expiresInHours),
  };
  data.verificationTokens.push(record);
  return { record, token };
}

export function verifyEmailToken(data: LocalDbData, token: string): AuthSessionResult {
  const record = consumeVerificationToken(data, token, "emailVerification");
  const user = data.users.find((entry) => entry.id === record.userId);
  if (!user) throw new Error("Verification account not found.");
  user.emailVerified = true;
  user.status = "active";
  user.updatedAt = nowIso();
  const profile = data.profiles.find((entry) => entry.userId === user.id);
  if (!profile) throw new Error("Account profile is missing.");
  return createSession(data, user, profile);
}

export function requestPasswordReset(data: LocalDbData, emailInput: string): { email: string; reset?: IssuedAuthToken } {
  const email = normalizeEmail(emailInput);
  const user = data.users.find((entry) => entry.email === email);
  if (!user) return { email };
  const reset = createVerificationToken(data, user.id, "passwordReset", 2);
  return { email, reset: { token: reset.token, expiresAt: reset.record.expiresAt } };
}

export async function confirmPasswordReset(data: LocalDbData, input: { token: string; password: string }): Promise<void> {
  if (input.password.length < 10) throw new Error("Password must be at least 10 characters.");
  const record = consumeVerificationToken(data, input.token, "passwordReset");
  const password = await hashPassword(input.password);
  const existing = data.passwordCredentials.find((entry) => entry.userId === record.userId);
  if (existing) {
    existing.passwordHash = password.hash;
    existing.salt = password.salt;
    existing.algorithm = "scrypt";
    existing.parameterVersion = PASSWORD_PARAMETER_VERSION;
    existing.scryptN = password.N;
    existing.scryptR = password.r;
    existing.scryptP = password.p;
    existing.updatedAt = nowIso();
  } else {
    data.passwordCredentials.push({
      userId: record.userId,
      passwordHash: password.hash,
      salt: password.salt,
      algorithm: "scrypt",
      parameterVersion: PASSWORD_PARAMETER_VERSION,
      scryptN: password.N,
      scryptR: password.r,
      scryptP: password.p,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  const revokedAt = nowIso();
  for (const session of data.sessions) {
    if (session.userId === record.userId && !session.revokedAt) session.revokedAt = revokedAt;
  }
  for (const token of data.verificationTokens) {
    if (token.userId === record.userId && token.purpose === "passwordReset" && !token.usedAt) {
      token.usedAt = revokedAt;
    }
  }
}

function consumeVerificationToken(data: LocalDbData, token: string, purpose: VerificationToken["purpose"]): VerificationToken {
  const tokenHash = hashToken(token);
  const record = data.verificationTokens.find((entry) => entry.tokenHash === tokenHash && entry.purpose === purpose);
  if (!record || record.usedAt || isPast(record.expiresAt)) {
    throw new Error("Token is invalid or expired.");
  }
  record.usedAt = nowIso();
  return record;
}

export function consumeOAuthState(data: LocalDbData, state: string): OAuthStateRecord {
  const tokenHash = hashToken(state);
  const record = data.oauthStates.find((entry) => entry.provider === "google" && entry.tokenHash === tokenHash);
  if (!record || record.usedAt || isPast(record.expiresAt)) {
    throw new Error("Google OAuth state is invalid or expired.");
  }
  record.usedAt = nowIso();
  return record;
}

export async function fetchGoogleOAuthProfile(code: string, config: ApiConfig): Promise<GoogleOAuthProfile> {
  if (!config.googleOAuth.clientId || !config.googleOAuth.clientSecret) {
    throw new Error("Google OAuth client id and secret are not configured.");
  }
  const fetchImpl = config.fetchImpl ?? fetch;
  const tokenBody = new URLSearchParams({
    code,
    client_id: config.googleOAuth.clientId,
    client_secret: config.googleOAuth.clientSecret,
    redirect_uri: config.googleOAuth.redirectUri,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetchImpl(config.googleOAuth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenPayload = await readJsonResponse<{ id_token?: string; error?: string; error_description?: string }>(tokenResponse);
  if (!tokenResponse.ok || !tokenPayload.id_token) {
    throw new Error(tokenPayload.error_description || tokenPayload.error || "Google token exchange failed.");
  }
  const tokenInfoUrl = new URL(config.googleOAuth.tokenInfoUrl);
  tokenInfoUrl.searchParams.set("id_token", tokenPayload.id_token);
  const infoResponse = await fetchImpl(tokenInfoUrl.toString());
  const info = await readJsonResponse<{
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    error?: string;
    error_description?: string;
  }>(infoResponse);
  if (!infoResponse.ok) throw new Error(info.error_description || info.error || "Google token verification failed.");
  if (info.aud !== config.googleOAuth.clientId) throw new Error("Google token audience does not match this backend.");
  return {
    sub: info.sub ?? "",
    email: info.email ?? "",
    emailVerified: info.email_verified === true || info.email_verified === "true",
    name: info.name,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

function sanitizeReturnTo(returnTo: string | undefined, config: ApiConfig): string {
  const fallback = config.googleOAuth.successRedirectUrl;
  if (!returnTo) return fallback;
  try {
    const url = new URL(returnTo);
    const allowed = new Set([
      ...config.allowedOrigins,
      new URL(fallback).origin,
    ]);
    return allowed.has(url.origin) ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}
