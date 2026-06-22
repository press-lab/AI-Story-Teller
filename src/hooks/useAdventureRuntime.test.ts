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
  it("turns the play word target into a provider output cap", () => {
    expect(applyResponseLengthHint(baseConfig, 150).maxOutputTokens).toBe(345);
  });

  it("keeps an already lower provider cap", () => {
    expect(applyResponseLengthHint({ ...baseConfig, maxOutputTokens: 220 }, 150).maxOutputTokens).toBe(220);
  });

  it("clamps unsafe word targets before deriving the cap", () => {
    expect(applyResponseLengthHint(baseConfig, 999).maxOutputTokens).toBe(870);
    expect(applyResponseLengthHint(baseConfig, 10).maxOutputTokens).toBe(195);
  });
});
