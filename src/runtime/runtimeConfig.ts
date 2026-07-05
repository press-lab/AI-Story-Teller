export type RuntimeMode = "local" | "backendLocal" | "hostedBackend";

export interface RuntimeConfig {
  mode: RuntimeMode;
  apiBaseUrl: string;
}

const fallbackBackendApiBaseUrl = "http://127.0.0.1:8787";

function envRuntimeMode(value: string | undefined): RuntimeMode {
  return value === "local" || value === "backendLocal" || value === "hostedBackend"
    ? value
    : "backendLocal";
}

export const defaultRuntimeConfig: RuntimeConfig = {
  mode: envRuntimeMode(import.meta.env.VITE_AIST_RUNTIME_MODE),
  apiBaseUrl: import.meta.env.VITE_AIST_API_BASE_URL?.trim() || fallbackBackendApiBaseUrl,
};

export function normalizeRuntimeConfig(value: Partial<RuntimeConfig> | undefined): RuntimeConfig {
  return {
    mode: value?.mode === "local" || value?.mode === "backendLocal" || value?.mode === "hostedBackend"
      ? value.mode
      : defaultRuntimeConfig.mode,
    apiBaseUrl: value?.apiBaseUrl?.trim() || defaultRuntimeConfig.apiBaseUrl,
  };
}

export function isFallbackBackendApiBaseUrl(apiBaseUrl: string | undefined): boolean {
  const normalized = apiBaseUrl?.trim().replace(/\/+$/, "");
  return normalized === fallbackBackendApiBaseUrl;
}

export function applyConfiguredBackendDefault(
  value: Partial<RuntimeConfig> | undefined,
  configuredDefault: RuntimeConfig = defaultRuntimeConfig,
): RuntimeConfig {
  const normalized = normalizeRuntimeConfig(value);
  if (
    !isFallbackBackendApiBaseUrl(configuredDefault.apiBaseUrl)
    && isFallbackBackendApiBaseUrl(normalized.apiBaseUrl)
  ) {
    return {
      ...normalized,
      mode: normalized.mode === "local" ? configuredDefault.mode : normalized.mode,
      apiBaseUrl: configuredDefault.apiBaseUrl,
    };
  }
  return normalized;
}

export function runtimeModeLabel(mode: RuntimeMode): string {
  if (mode === "backendLocal") return "Local Backend";
  if (mode === "hostedBackend") return "Hosted Backend";
  return "Browser Local";
}
