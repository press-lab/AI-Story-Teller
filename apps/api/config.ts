import type { ProviderConfig } from "../../src/types/adventure";
import { existsSync, readFileSync } from "node:fs";
import type { EmailDelivery } from "./emailDelivery";

export type PolicyMode = "reviewOnly" | "enforce";
export type EmailDeliveryMode = "disabled" | "resend";
export type PasswordSignupMode = "disabled" | "emailVerification" | "trustedInvite";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  successRedirectUrl: string;
  authUrl: string;
  tokenUrl: string;
  tokenInfoUrl: string;
}

export interface ApiConfig {
  host: string;
  port: number;
  dataFile: string;
  databaseUrl?: string;
  databaseDirectUrl?: string;
  databasePoolMax: number;
  databaseConnectionTimeoutMs: number;
  databaseIdleTimeoutMs: number;
  databaseStatementTimeoutMs: number;
  databaseLockTimeoutMs: number;
  databaseIdleTransactionTimeoutMs: number;
  trustedProxyHops: number;
  allowedOrigins: string[];
  adminKey?: string;
  adminEmails: string[];
  allowLocalGoogleStub: boolean;
  googleOAuth: GoogleOAuthConfig;
  policyMode: PolicyMode;
  emailDeliveryMode: EmailDeliveryMode;
  passwordSignupMode: PasswordSignupMode;
  providerConfig: ProviderConfig;
  resendApiKey?: string;
  emailFrom?: string;
  emailDelivery?: EmailDelivery;
  fetchImpl?: typeof fetch;
}

function stringEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function passwordSignupModeEnv(name: string, fallback: PasswordSignupMode): PasswordSignupMode {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (value === "disabled" || value === "emailVerification" || value === "trustedInvite") return value;
  throw new Error(`${name} must be disabled, emailVerification, or trustedInvite.`);
}

function openRouterProviderSortEnv(name: string): ProviderConfig["openRouterProviderSort"] {
  const value = process.env[name]?.trim();
  return value === "price" || value === "throughput" || value === "latency" ? value : undefined;
}

function openRouterDataCollectionEnv(name: string): ProviderConfig["openRouterDataCollection"] {
  const value = process.env[name]?.trim();
  return value === "allow" || value === "deny" ? value : undefined;
}

export function loadApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  loadDotEnv();
  const providerConfig: ProviderConfig = {
    name: stringEnv("AIST_PROVIDER_NAME", "deepseek"),
    baseUrl: stringEnv("AIST_PROVIDER_BASE_URL", "https://api.deepseek.com"),
    model: stringEnv("AIST_PROVIDER_MODEL", "deepseek-chat"),
    apiKey: process.env.AIST_PROVIDER_API_KEY?.trim() || "",
    temperature: numberEnv("AIST_PROVIDER_TEMPERATURE", 0.7),
    maxOutputTokens: numberEnv("AIST_PROVIDER_MAX_OUTPUT_TOKENS", 1200),
    topP: numberEnv("AIST_PROVIDER_TOP_P", 0.95),
    presencePenalty: numberEnv("AIST_PROVIDER_PRESENCE_PENALTY", 0.8),
    frequencyPenalty: numberEnv("AIST_PROVIDER_FREQUENCY_PENALTY", 0),
    promptCaching: boolEnv("AIST_PROVIDER_PROMPT_CACHING", true),
    openRouterProviderSort: openRouterProviderSortEnv("AIST_PROVIDER_OPENROUTER_SORT"),
    openRouterDataCollection: openRouterDataCollectionEnv("AIST_PROVIDER_OPENROUTER_DATA_COLLECTION"),
  };
  const policyModeRaw = stringEnv("AIST_POLICY_MODE", "reviewOnly");
  const policyMode: PolicyMode = policyModeRaw === "enforce" ? "enforce" : "reviewOnly";
  const emailDeliveryModeRaw = stringEnv("AIST_EMAIL_DELIVERY_MODE", "resend");
  const emailDeliveryMode: EmailDeliveryMode = emailDeliveryModeRaw === "disabled" ? "disabled" : "resend";
  const passwordSignupMode = passwordSignupModeEnv("AIST_PASSWORD_SIGNUP_MODE", "emailVerification");
  const config: ApiConfig = {
    host: stringEnv("AIST_API_HOST", "127.0.0.1"),
    port: numberEnv("AIST_API_PORT", numberEnv("PORT", 8787)),
    dataFile: stringEnv("AIST_API_DATA_FILE", ".local-backend/aist-api-db.json"),
    databaseUrl: process.env.AIST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || undefined,
    databaseDirectUrl: process.env.DATABASE_DIRECT_URL?.trim() || undefined,
    databasePoolMax: numberEnv("AIST_DATABASE_POOL_MAX", 10),
    databaseConnectionTimeoutMs: numberEnv("AIST_DATABASE_CONNECTION_TIMEOUT_MS", 5_000),
    databaseIdleTimeoutMs: numberEnv("AIST_DATABASE_IDLE_TIMEOUT_MS", 30_000),
    databaseStatementTimeoutMs: numberEnv("AIST_DATABASE_STATEMENT_TIMEOUT_MS", 30_000),
    databaseLockTimeoutMs: numberEnv("AIST_DATABASE_LOCK_TIMEOUT_MS", 5_000),
    databaseIdleTransactionTimeoutMs: numberEnv("AIST_DATABASE_IDLE_TRANSACTION_TIMEOUT_MS", 15_000),
    trustedProxyHops: Math.max(0, Math.floor(numberEnv("AIST_TRUST_PROXY_HOPS", 0))),
    allowedOrigins: stringEnv(
      "AIST_API_ALLOWED_ORIGINS",
      "http://localhost:5173,http://127.0.0.1:5173,https://press-lab.github.io",
    ).split(",").map((origin) => origin.trim()).filter(Boolean),
    adminKey: process.env.AIST_API_ADMIN_KEY?.trim() || undefined,
    adminEmails: stringEnv("AIST_ADMIN_EMAILS", "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
    allowLocalGoogleStub: boolEnv("AIST_API_ALLOW_LOCAL_GOOGLE_STUB", true),
    googleOAuth: {
      clientId: process.env.AIST_GOOGLE_CLIENT_ID?.trim() || "",
      clientSecret: process.env.AIST_GOOGLE_CLIENT_SECRET?.trim() || "",
      redirectUri: stringEnv("AIST_GOOGLE_REDIRECT_URI", "http://127.0.0.1:8787/auth/google/callback"),
      successRedirectUrl: stringEnv("AIST_WEB_APP_URL", "http://localhost:5173/"),
      authUrl: stringEnv("AIST_GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth"),
      tokenUrl: stringEnv("AIST_GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token"),
      tokenInfoUrl: stringEnv("AIST_GOOGLE_TOKEN_INFO_URL", "https://oauth2.googleapis.com/tokeninfo"),
    },
    policyMode,
    emailDeliveryMode,
    passwordSignupMode,
    providerConfig,
    resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    emailFrom: process.env.AIST_EMAIL_FROM?.trim() || undefined,
  };
  return {
    ...config,
    ...overrides,
    providerConfig: { ...config.providerConfig, ...(overrides.providerConfig ?? {}) },
    googleOAuth: { ...config.googleOAuth, ...(overrides.googleOAuth ?? {}) },
  };
}

function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
