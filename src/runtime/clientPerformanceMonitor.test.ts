import { describe, expect, it } from "vitest";
import {
  classifyPageLoadCause,
  measurePageLoad,
  navigationDestination,
  readClientPerformanceRuntimeConfig,
} from "./clientPerformanceMonitor";

describe("client performance monitoring", () => {
  it("turns navigation timings into content-free diagnostic measurements", () => {
    const measurement = measurePageLoad({
      startTime: 0,
      responseStart: 1_250,
      responseEnd: 1_400,
      domInteractive: 1_700,
      domContentLoadedEventEnd: 1_800,
      loadEventEnd: 1_900,
      transferSize: 42_000,
      type: "navigate",
    }, 18, 2_000);

    expect(measurement).toEqual({
      durationMs: 1900,
      metadata: expect.objectContaining({
        navigationType: "navigate",
        ttfbMs: 1250,
        clientWorkMs: 500,
        transferBytes: 42000,
        resourceCount: 18,
        causeHint: "server_or_network",
      }),
    });
    expect(Object.keys(measurement.metadata)).not.toContain("url");
    expect(Object.keys(measurement.metadata)).not.toContain("title");
  });

  it("classifies only coarse causes and allowlists navigation labels", () => {
    expect(classifyPageLoadCause(100, 1_200, 1_400)).toBe("client_render_or_assets");
    expect(classifyPageLoadCause(100, 200, 3_000)).toBe("mixed_page_load");
    expect(classifyPageLoadCause(100, 200, 800)).toBeUndefined();
    expect(navigationDestination("Context Inspector")).toBe("context-inspector");
    expect(navigationDestination("A user's private story title")).toBeUndefined();
  });

  it("uses a saved backend runtime config and safely ignores malformed storage", () => {
    expect(readClientPerformanceRuntimeConfig({
      getItem: () => JSON.stringify({ mode: "hostedBackend", apiBaseUrl: "https://api.example.com" }),
    })).toEqual({ mode: "hostedBackend", apiBaseUrl: "https://api.example.com" });
    expect(readClientPerformanceRuntimeConfig({ getItem: () => "{" })).toEqual(expect.objectContaining({
      mode: expect.stringMatching(/^(local|backendLocal|hostedBackend)$/),
    }));
  });
});
