import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendOpenAICompatibleChatCompletion } from "./openAICompatible";
import type { ProviderConfig } from "../types/adventure";

const config: ProviderConfig = {
  name: "test",
  baseUrl: "https://api.example.com",
  apiKey: "sk-test",
  model: "test-model",
  temperature: 0.8,
  maxOutputTokens: 256,
};

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendOpenAICompatibleChatCompletion", () => {
  it("throws when API key is missing", async () => {
    await expect(
      sendOpenAICompatibleChatCompletion({ messages: [], config: { ...config, apiKey: "" } }),
    ).rejects.toThrow("Missing API key");
    await expect(
      sendOpenAICompatibleChatCompletion({ messages: [], config: { ...config, apiKey: "   " } }),
    ).rejects.toThrow("Missing API key");
  });

  it("sends the correct payload to the v1/chat/completions endpoint", async () => {
    const spy = mockFetch(200, { choices: [{ message: { content: "Hello." } }] });
    await sendOpenAICompatibleChatCompletion({
      messages: [{ role: "user", content: "Hi" }],
      config,
    });

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer sk-test");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.8,
      max_tokens: 256,
    });
  });

  it("does not double-append v1 when base URL already ends with /v1", async () => {
    mockFetch(200, { choices: [{ message: { content: "ok" } }] });
    const spy = vi.spyOn(globalThis, "fetch");
    await sendOpenAICompatibleChatCompletion({
      messages: [],
      config: { ...config, baseUrl: "https://api.example.com/v1" },
    });
    expect(spy.mock.calls[0][0]).toBe("https://api.example.com/v1/chat/completions");
  });

  it("does not modify base URL that already ends with /chat/completions", async () => {
    mockFetch(200, { choices: [{ message: { content: "ok" } }] });
    const spy = vi.spyOn(globalThis, "fetch");
    await sendOpenAICompatibleChatCompletion({
      messages: [],
      config: { ...config, baseUrl: "https://api.example.com/v1/chat/completions" },
    });
    expect(spy.mock.calls[0][0]).toBe("https://api.example.com/v1/chat/completions");
  });

  it("returns content from the first choice", async () => {
    mockFetch(200, { choices: [{ message: { content: "The storm broke." } }] });
    const result = await sendOpenAICompatibleChatCompletion({ messages: [], config });
    expect(result.content).toBe("The storm broke.");
  });

  it("throws the provider error message on non-2xx with error body", async () => {
    mockFetch(401, { error: { message: "Invalid authentication credentials." } });
    await expect(
      sendOpenAICompatibleChatCompletion({ messages: [], config }),
    ).rejects.toThrow("Invalid authentication credentials.");
  });

  it("throws HTTP status fallback on non-2xx without error body", async () => {
    mockFetch(500, {});
    await expect(
      sendOpenAICompatibleChatCompletion({ messages: [], config }),
    ).rejects.toThrow("HTTP 500");
  });

  it("throws when response has no message content", async () => {
    mockFetch(200, { choices: [{ message: {} }] });
    await expect(
      sendOpenAICompatibleChatCompletion({ messages: [], config }),
    ).rejects.toThrow("no message content");
  });

  it("throws when choices array is empty", async () => {
    mockFetch(200, { choices: [] });
    await expect(
      sendOpenAICompatibleChatCompletion({ messages: [], config }),
    ).rejects.toThrow("no message content");
  });
});
