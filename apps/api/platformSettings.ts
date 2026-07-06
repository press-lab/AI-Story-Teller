import type { OpenRouterDataCollection, OpenRouterProviderSort, ProviderConfig } from "../../src/types/adventure";
import type { LocalDbData, PlatformSettingsRecord } from "./apiTypes";
import type { ApiConfig } from "./config";
import { createId, nowIso } from "./ids";

export interface PlatformSettings {
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
    openRouterProviderSort?: OpenRouterProviderSort;
    openRouterDataCollection?: OpenRouterDataCollection;
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

export type PlatformSettingsInput = Partial<{
  provider: Partial<PlatformSettings["provider"]>;
  background: Partial<PlatformSettings["background"]>;
  features: Partial<PlatformSettings["features"]>;
}>;

export function getPlatformSettings(data: LocalDbData, config: ApiConfig): PlatformSettings {
  const defaults = defaultPlatformSettings(config);
  const record = data.platformSettings.find((entry) => entry.key === "platform");
  return mergePlatformSettings(defaults, record);
}

export function updatePlatformSettings(
  data: LocalDbData,
  config: ApiConfig,
  input: PlatformSettingsInput,
  updatedByUserId?: string,
): PlatformSettings {
  const current = getPlatformSettings(data, config);
  const next = sanitizePlatformSettings({
    ...current,
    provider: { ...current.provider, ...(input.provider ?? {}) },
    background: { ...current.background, ...(input.background ?? {}) },
    features: { ...current.features, ...(input.features ?? {}) },
    updatedAt: nowIso(),
    updatedByUserId,
  });
  let record = data.platformSettings.find((entry) => entry.key === "platform");
  if (!record) {
    record = {
      id: createId("platform_settings"),
      key: "platform",
      value: next,
      updatedAt: next.updatedAt ?? nowIso(),
      updatedByUserId,
    };
    data.platformSettings.push(record);
  } else {
    record.value = next;
    record.updatedAt = next.updatedAt ?? nowIso();
    record.updatedByUserId = updatedByUserId;
  }
  data.adminActions.push({
    id: createId("admin_action"),
    adminUserId: updatedByUserId,
    action: "update_platform_settings",
    targetType: "platformSettings",
    targetId: record.id,
    reason: "Updated backend platform settings.",
    createdAt: nowIso(),
  });
  return next;
}

export function effectiveProviderConfig(data: LocalDbData, config: ApiConfig): ProviderConfig {
  const settings = getPlatformSettings(data, config);
  return {
    ...config.providerConfig,
    ...settings.provider,
    apiKey: config.providerConfig.apiKey,
  };
}

function defaultPlatformSettings(config: ApiConfig): PlatformSettings {
  return sanitizePlatformSettings({
    provider: {
      name: config.providerConfig.name,
      baseUrl: config.providerConfig.baseUrl,
      model: config.providerConfig.model,
      temperature: config.providerConfig.temperature,
      maxOutputTokens: config.providerConfig.maxOutputTokens,
      topP: config.providerConfig.topP,
      presencePenalty: config.providerConfig.presencePenalty,
      frequencyPenalty: config.providerConfig.frequencyPenalty,
      promptCaching: config.providerConfig.promptCaching,
      openRouterProviderSort: config.providerConfig.openRouterProviderSort,
      openRouterDataCollection: config.providerConfig.openRouterDataCollection,
    },
    background: {
      semanticEvaluationEnabled: true,
      semanticEvalEveryNTurns: 2,
      memoryDetectionEnabled: true,
      memoryDetectionEveryNTurns: 3,
    },
    features: {
      scenarioPublishingEnabled: true,
      developerToolsVisibleToAdmins: true,
    },
  });
}

function mergePlatformSettings(defaults: PlatformSettings, record: PlatformSettingsRecord | undefined): PlatformSettings {
  if (!record || typeof record.value !== "object" || !record.value) return defaults;
  const value = record.value as PlatformSettingsInput & Partial<Pick<PlatformSettings, "updatedAt" | "updatedByUserId">>;
  return sanitizePlatformSettings({
    ...defaults,
    provider: { ...defaults.provider, ...(value.provider ?? {}) },
    background: { ...defaults.background, ...(value.background ?? {}) },
    features: { ...defaults.features, ...(value.features ?? {}) },
    updatedAt: value.updatedAt ?? record.updatedAt,
    updatedByUserId: value.updatedByUserId ?? record.updatedByUserId,
  });
}

function sanitizePlatformSettings(settings: PlatformSettings): PlatformSettings {
  return {
    provider: {
      name: cleanString(settings.provider.name, "provider"),
      baseUrl: cleanString(settings.provider.baseUrl, "http://127.0.0.1"),
      model: cleanString(settings.provider.model, "model"),
      temperature: clampNumber(settings.provider.temperature, 0, 2, 0.7),
      maxOutputTokens: clampInteger(settings.provider.maxOutputTokens, 1, 200_000, 1200),
      topP: settings.provider.topP === undefined ? undefined : clampNumber(settings.provider.topP, 0, 1, 0.95),
      presencePenalty: settings.provider.presencePenalty === undefined ? undefined : clampNumber(settings.provider.presencePenalty, 0, 2, 0.8),
      frequencyPenalty: settings.provider.frequencyPenalty === undefined ? undefined : clampNumber(settings.provider.frequencyPenalty, 0, 2, 0),
      promptCaching: Boolean(settings.provider.promptCaching),
      openRouterProviderSort: sanitizeOpenRouterProviderSort(settings.provider.openRouterProviderSort),
      openRouterDataCollection: sanitizeOpenRouterDataCollection(settings.provider.openRouterDataCollection),
    },
    background: {
      semanticEvaluationEnabled: Boolean(settings.background.semanticEvaluationEnabled),
      semanticEvalEveryNTurns: clampInteger(settings.background.semanticEvalEveryNTurns, 0, 100, 2),
      memoryDetectionEnabled: Boolean(settings.background.memoryDetectionEnabled),
      memoryDetectionEveryNTurns: clampInteger(settings.background.memoryDetectionEveryNTurns, 1, 100, 3),
    },
    features: {
      scenarioPublishingEnabled: Boolean(settings.features.scenarioPublishingEnabled),
      developerToolsVisibleToAdmins: Boolean(settings.features.developerToolsVisibleToAdmins),
    },
    updatedAt: settings.updatedAt,
    updatedByUserId: settings.updatedByUserId,
  };
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function sanitizeOpenRouterProviderSort(value: unknown): OpenRouterProviderSort | undefined {
  return value === "price" || value === "throughput" || value === "latency" ? value : undefined;
}

function sanitizeOpenRouterDataCollection(value: unknown): OpenRouterDataCollection | undefined {
  return value === "allow" || value === "deny" ? value : undefined;
}
