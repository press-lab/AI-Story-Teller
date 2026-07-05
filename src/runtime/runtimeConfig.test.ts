import { describe, expect, it } from "vitest";
import { normalizeRuntimeConfig } from "./runtimeConfig";

describe("runtime config", () => {
  it("keeps browser-local mode as the default", () => {
    expect(normalizeRuntimeConfig(undefined)).toEqual({
      mode: "local",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
  });

  it("accepts backend modes only when explicitly selected", () => {
    expect(normalizeRuntimeConfig({ mode: "backendLocal", apiBaseUrl: "http://localhost:8787/" })).toEqual({
      mode: "backendLocal",
      apiBaseUrl: "http://localhost:8787/",
    });
    expect(normalizeRuntimeConfig({ mode: "unexpected" as never })).toEqual({
      mode: "local",
      apiBaseUrl: "http://127.0.0.1:8787",
    });
  });
});
