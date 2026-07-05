import type { ProviderConfig } from "../../src/types/adventure";

export type PolicyMode = "reviewOnly" | "enforce";

export interface ApiConfig {
  host: string;
  port: number;
  dataFile: string;
  allowedOrigins: string[];
  adminKey?: string;
  allowLocalGoogleStub: boolean;
  policyMode: PolicyMode;
  providerConfig: ProviderConfig;
}

function stringEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadApiConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
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
  };
  const policyModeRaw = stringEnv("AIST_POLICY_MODE", "reviewOnly");
  const policyMode: PolicyMode = policyModeRaw === "enforce" ? "enforce" : "reviewOnly";
  const config: ApiConfig = {
    host: stringEnv("AIST_API_HOST", "127.0.0.1"),
    port: numberEnv("AIST_API_PORT", 8787),
    dataFile: stringEnv("AIST_API_DATA_FILE", ".local-backend/aist-api-db.json"),
    allowedOrigins: stringEnv(
      "AIST_API_ALLOWED_ORIGINS",
      "http://localhost:5173,http://127.0.0.1:5173,https://press-lab.github.io",
    ).split(",").map((origin) => origin.trim()).filter(Boolean),
    adminKey: process.env.AIST_API_ADMIN_KEY?.trim() || undefined,
    allowLocalGoogleStub: boolEnv("AIST_API_ALLOW_LOCAL_GOOGLE_STUB", true),
    policyMode,
    providerConfig,
  };
  return {
    ...config,
    ...overrides,
    providerConfig: { ...config.providerConfig, ...overrides.providerConfig },
  };
}
