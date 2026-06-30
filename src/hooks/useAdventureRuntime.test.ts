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
  it("applies a generous length-derived cap below the provider maximum", () => {
    expect(applyResponseLengthHint(baseConfig, 150).maxOutputTokens).toBe(517);
  });

  it("adds a bounded reserve for hidden thought and memory tags", () => {
    expect(applyResponseLengthHint(baseConfig, 150, 240).maxOutputTokens).toBe(637);
    expect(applyResponseLengthHint(baseConfig, 150, 999).maxOutputTokens).toBe(697);
  });

  it("uses the same length cap when the provider has no usable cap", () => {
    const uncapped = { ...baseConfig, maxOutputTokens: 0 };
    expect(applyResponseLengthHint(uncapped, 150).maxOutputTokens).toBe(517);
  });

  it("keeps an intentionally lower provider cap", () => {
    expect(applyResponseLengthHint({ ...baseConfig, maxOutputTokens: 220 }, 150).maxOutputTokens).toBe(220);
  });

  it("clamps unsafe word targets before deriving the cap", () => {
    expect(applyResponseLengthHint(baseConfig, 999).maxOutputTokens).toBe(1440);
    expect(applyResponseLengthHint(baseConfig, 10).maxOutputTokens).toBe(252);
  });
});
