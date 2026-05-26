import type { ChatMessage, ProviderConfig } from "../types/adventure";

export interface SendChatCompletionOptions {
  messages: ChatMessage[];
  config: ProviderConfig;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  content: string;
  raw: unknown;
}

function completionEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export async function sendOpenAICompatibleChatCompletion({
  messages,
  config,
  signal,
}: SendChatCompletionOptions): Promise<ProviderResponse> {
  if (!config.apiKey?.trim()) {
    throw new Error("Missing API key. Add one in Settings before generating.");
  }

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
