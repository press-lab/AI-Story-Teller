export type RuntimeMode = "local" | "backendLocal" | "hostedBackend";

export interface RuntimeConfig {
  mode: RuntimeMode;
  apiBaseUrl: string;
}

export const defaultRuntimeConfig: RuntimeConfig = {
  mode: "backendLocal",
  apiBaseUrl: "http://127.0.0.1:8787",
};

export function normalizeRuntimeConfig(value: Partial<RuntimeConfig> | undefined): RuntimeConfig {
  return {
    mode: value?.mode === "local" || value?.mode === "backendLocal" || value?.mode === "hostedBackend"
      ? value.mode
      : defaultRuntimeConfig.mode,
    apiBaseUrl: value?.apiBaseUrl?.trim() || defaultRuntimeConfig.apiBaseUrl,
  };
}

export function runtimeModeLabel(mode: RuntimeMode): string {
  if (mode === "backendLocal") return "Local Backend";
  if (mode === "hostedBackend") return "Hosted Backend";
  return "Browser Local";
}
