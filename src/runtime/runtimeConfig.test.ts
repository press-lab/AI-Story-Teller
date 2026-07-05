import { describe, expect, it } from "vitest";
import { normalizeRuntimeConfig } from "./runtimeConfig";

describe("runtime config", () => {
  it("uses local backend as the default", () => {
    expect(normalizeRuntimeConfig(undefined)).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
  });

  it("accepts explicit runtime modes", () => {
    expect(normalizeRuntimeConfig({ mode: "backendLocal", apiBaseUrl: "http://localhost:8787/" })).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://localhost:8787/",
    });
    expect(normalizeRuntimeConfig({ mode: "local" })).toEqual({
      mode: "local",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
    expect(normalizeRuntimeConfig({ mode: "unexpected" as never })).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
  });
});
