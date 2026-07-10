import { describe, expect, it } from "vitest";
import { normalizeApiError } from "./apiError";
import { sanitizeErrorMessage } from "./performanceTrace";

describe("API error boundary", () => {
  it("distinguishes provider timeouts from other provider failures", () => {
    expect(normalizeApiError(new Error("Network error (provider): request timed out.")).status).toBe(504);
    expect(normalizeApiError(new Error("Provider error 503 (provider): unavailable")).status).toBe(502);
  });

  it("redacts credentials, database URLs, and SQL before logging", () => {
    const message = sanitizeErrorMessage(
      "Bearer abc.def api_key=sk-secretsecretsecret postgresql://user:password@db.example/app SELECT * FROM users",
    );
    expect(message).not.toContain("abc.def");
    expect(message).not.toContain("sk-secret");
    expect(message).not.toContain("password@db");
    expect(message).not.toContain("SELECT *");
    expect(message).toContain("[redacted-sql]");
  });
});
