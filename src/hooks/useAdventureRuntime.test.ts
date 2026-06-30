import { describe, expect, it } from "vitest";
import { applyResponseLengthHint } from "./useAdventureRuntime";
import type { RuntimeProviderSettings } from "../pages/pageTypes";

const baseConfig: RuntimeProviderSettings = {
  name: "openai-compatible",
  baseUrl: "https://example.test",
  apiKey: "secret",
  model: "deepseek-chat",
  temperature: 0.7,
  maxOutputTokens: 2048,
};

describe("applyResponseLengthHint", () => {
  it("preserves the provider output cap when one is configured", () => {
    expect(applyResponseLengthHint(baseConfig, 150).maxOutputTokens).toBe(2048);
  });

  it("derives a fallback cap only when the provider has no usable cap", () => {
    const uncapped = { ...baseConfig, maxOutputTokens: 0 };
    expect(applyResponseLengthHint(uncapped, 150).maxOutputTokens).toBe(269);
    expect(applyResponseLengthHint(uncapped, 150, 240).maxOutputTokens).toBe(329);
    expect(applyResponseLengthHint(uncapped, 150, 999).maxOutputTokens).toBe(329);
  });

  it("keeps an intentionally lower provider cap", () => {
    expect(applyResponseLengthHint({ ...baseConfig, maxOutputTokens: 220 }, 150).maxOutputTokens).toBe(220);
  });

  it("clamps unsafe word targets before deriving a fallback cap", () => {
    const uncapped = { ...baseConfig, maxOutputTokens: 0 };
    expect(applyResponseLengthHint(uncapped, 999).maxOutputTokens).toBe(815);
    expect(applyResponseLengthHint(uncapped, 10).maxOutputTokens).toBe(113);
  });
});
