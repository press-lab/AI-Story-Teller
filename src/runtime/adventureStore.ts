import { deleteAdventure, getAdventure, listAdventures, saveAdventure, type AdventureSummary } from "../db/adventureDb";
import type { Adventure, ContextBuildResult, InputMode, ProviderConfig } from "../types/adventure";
import type { RuntimeConfig } from "./runtimeConfig";

export interface AdventureStore {
  list(): Promise<AdventureSummary[]>;
  get(id: string): Promise<Adventure | undefined>;
  save(adventure: Adventure): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface TurnResult {
  adventure: Adventure;
  responseContent: string;
  preProviderContext?: ContextBuildResult;
  postTurnContext?: ContextBuildResult;
}

export interface TurnRequest {
  adventureId: string;
  input: string;
  mode?: InputMode;
  recordUserInput?: boolean;
  providerCue?: string;
  regenerateLastAssistant?: boolean;
  providerOverride?: Partial<ProviderConfig>;
}

export interface TurnRunner {
  runTurn(request: TurnRequest): Promise<TurnResult>;
}

export interface ContextPreviewSource {
  build(adventureId: string): Promise<ContextBuildResult>;
}

export function createLocalAdventureStore(): AdventureStore {
  return {
    list: listAdventures,
    get: getAdventure,
    save: saveAdventure,
    delete: deleteAdventure,
  };
}

export function createUnavailableAdventureStore(message: string): AdventureStore {
  return {
    async list() {
      return [];
    },
    async get() {
      return undefined;
    },
    async save() {
      throw new Error(message);
    },
    async delete() {
      throw new Error(message);
    },
  };
}

export async function apiJson<T>(config: RuntimeConfig, path: string, init: RequestInit = {}): Promise<T> {
  const base = config.apiBaseUrl.replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as unknown : undefined;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : `Backend request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export function createBackendAdventureStore(config: RuntimeConfig, authToken?: string): AdventureStore {
  const authHeaders: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  return {
    async list() {
      return apiJson<AdventureSummary[]>(config, "/adventures", { headers: authHeaders });
    },
    async get(id) {
      return apiJson<Adventure | undefined>(config, `/adventures/${encodeURIComponent(id)}`, { headers: authHeaders });
    },
    async save(adventure) {
      await apiJson(config, `/adventures/${encodeURIComponent(adventure.id)}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ adventure }),
      });
    },
    async delete(id) {
      await apiJson(config, `/adventures/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
    },
  };
}

export function createBackendTurnRunner(config: RuntimeConfig, authToken: string, providerOverride?: Partial<ProviderConfig>): TurnRunner {
  return {
    runTurn(request) {
      return apiJson<TurnResult>(config, `/adventures/${encodeURIComponent(request.adventureId)}/turn`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          input: request.input,
          mode: request.mode,
          recordUserInput: request.recordUserInput,
          providerCue: request.providerCue,
          regenerateLastAssistant: request.regenerateLastAssistant,
          providerOverride: request.providerOverride ?? providerOverride,
        }),
      });
    },
  };
}

export function createBackendContextPreviewSource(config: RuntimeConfig, authToken: string): ContextPreviewSource {
  return {
    build(adventureId) {
      return apiJson<ContextBuildResult>(config, `/adventures/${encodeURIComponent(adventureId)}/context-preview`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
  };
}
