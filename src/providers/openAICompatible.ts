import type { ChatMessage, ProviderConfig, ProviderRequestThrottle } from "../types/adventure";

export interface SendChatCompletionOptions {
  messages: ChatMessage[];
  config: ProviderConfig;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  content: string;
  raw: unknown;
}

let throttleQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;
let recentRequestStarts: number[] = [];

function completionEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
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

export async function sendOpenAICompatibleChatCompletion({
  messages,
  config,
  signal,
}: SendChatCompletionOptions): Promise<ProviderResponse> {
  if (!config.apiKey?.trim()) {
    throw new Error("Missing API key. Add one in Settings before generating.");
  }

  await waitForProviderThrottle(config, signal);

  const response = await fetch(completionEndpoint(config.baseUrl), {
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
  };

  if (!response.ok) {
    throw new Error(raw.error?.message || `Provider request failed with HTTP ${response.status}.`);
  }

  const content = raw.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Provider returned no message content.");
  }

  return { content, raw };
}
