import type { ChatMessage, ProviderConfig, ProviderRequestThrottle, ProviderUsage } from "../types/adventure";

export interface SendChatCompletionOptions {
  messages: ChatMessage[];
  config: ProviderConfig;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  content: string;
  raw: unknown;
  usage?: ProviderUsage;
}

let throttleQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;
let recentRequestStarts: number[] = [];

function isAnthropicFormat(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).pathname.includes("/anthropic");
  } catch {
    return baseUrl.includes("/anthropic");
  }
}

function openAIEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function anthropicEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/messages")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

function completionEndpoint(baseUrl: string): string {
  return isAnthropicFormat(baseUrl) ? anthropicEndpoint(baseUrl) : openAIEndpoint(baseUrl);
}

function normalizedThrottle(config: ProviderConfig): ProviderRequestThrottle {
  return {
    enabled: config.requestThrottle?.enabled ?? false,
    minSecondsBetweenRequests: Math.max(0, config.requestThrottle?.minSecondsBetweenRequests ?? 0),
    maxRequestsPerMinute: Math.max(0, Math.floor(config.requestThrottle?.maxRequestsPerMinute ?? 0)),
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Provider request was aborted."));
      return;
    }
    const timeout = globalThis.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        reject(signal.reason instanceof Error ? signal.reason : new Error("Provider request was aborted."));
      },
      { once: true },
    );
  });
}

async function waitForProviderThrottle(config: ProviderConfig, signal?: AbortSignal): Promise<void> {
  const throttle = normalizedThrottle(config);
  if (!throttle.enabled) return;

  const run = throttleQueue.then(async () => {
    const now = Date.now();
    let waitMs = 0;
    const minIntervalMs = throttle.minSecondsBetweenRequests * 1000;
    if (minIntervalMs > 0 && lastRequestStartedAt > 0) {
      waitMs = Math.max(waitMs, lastRequestStartedAt + minIntervalMs - now);
    }
    if (throttle.maxRequestsPerMinute > 0) {
      recentRequestStarts = recentRequestStarts.filter((startedAt) => now - startedAt < 60_000);
      if (recentRequestStarts.length >= throttle.maxRequestsPerMinute) {
        waitMs = Math.max(waitMs, recentRequestStarts[0] + 60_000 - now);
      }
    }

    await wait(waitMs, signal);
    const startedAt = Date.now();
    lastRequestStartedAt = startedAt;
    recentRequestStarts = [...recentRequestStarts.filter((timestamp) => startedAt - timestamp < 60_000), startedAt];
  });

  throttleQueue = run.catch(() => undefined);
  await run;
}

export function resetProviderThrottleForTests(): void {
  throttleQueue = Promise.resolve();
  lastRequestStartedAt = 0;
  recentRequestStarts = [];
}

async function sendOpenAIRequest(
  endpoint: string,
  messages: ChatMessage[],
  config: ProviderConfig,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxOutputTokens,
    }),
  });

  const raw = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  if (!response.ok) {
    throw new Error(raw.error?.message || `Provider request failed with HTTP ${response.status} (${endpoint}).`);
  }

  const content = raw.choices?.[0]?.message?.content;
  if (!content) throw new Error("Provider returned no message content.");

  const usage: ProviderUsage | undefined = raw.usage
    ? {
        promptTokens: raw.usage.prompt_tokens ?? 0,
        completionTokens: raw.usage.completion_tokens ?? 0,
        totalTokens: raw.usage.total_tokens ?? 0,
      }
    : undefined;

  return { content, raw, usage };
}

async function sendAnthropicRequest(
  endpoint: string,
  messages: ChatMessage[],
  config: ProviderConfig,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const chatMessages = messages.filter((m) => m.role !== "system");

  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
      messages: chatMessages,
      temperature: config.temperature,
      max_tokens: config.maxOutputTokens,
    }),
  });

  const raw = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!response.ok) {
    throw new Error(raw.error?.message || `Provider request failed with HTTP ${response.status} (${endpoint}).`);
  }

  const content = raw.content?.find((c) => c.type === "text")?.text;
  if (!content) throw new Error("Provider returned no message content.");

  const usage: ProviderUsage | undefined = raw.usage
    ? {
        promptTokens: raw.usage.input_tokens ?? 0,
        completionTokens: raw.usage.output_tokens ?? 0,
        totalTokens: (raw.usage.input_tokens ?? 0) + (raw.usage.output_tokens ?? 0),
      }
    : undefined;

  return { content, raw, usage };
}

export async function sendOpenAICompatibleChatCompletion({
  messages,
  config,
  signal,
}: SendChatCompletionOptions): Promise<ProviderResponse> {
  if (!config.apiKey?.trim()) {
    throw new Error("Missing API key. Add one in Settings before generating.");
  }

  await waitForProviderThrottle(config, signal);

  const endpoint = completionEndpoint(config.baseUrl);
  if (isAnthropicFormat(config.baseUrl)) {
    return sendAnthropicRequest(endpoint, messages, config, signal);
  }
  return sendOpenAIRequest(endpoint, messages, config, signal);
}
