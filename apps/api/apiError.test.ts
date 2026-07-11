import { describe, expect, it } from "vitest";
import { normalizeApiError } from "./apiError";
import { sanitizeErrorMessage } from "./performanceTrace";

describe("API error boundary", () => {
  it("distinguishes provider timeouts from other provider failures", () => {
    expect(normalizeApiError(new Error("Network error (provider): request timed out.")).status).toBe(504);
    expect(normalizeApiError(new Error("Provider error 503 (provider): unavailable")).status).toBe(502);
  });

  it("returns actionable provider details while redacting credentials", () => {
    const error = normalizeApiError(new Error(
      "Provider error 401 (https://openrouter.ai/api/v1/chat/completions): invalid Bearer sk-secret api_key=sk-other",
    ));
    expect(error.status).toBe(502);
    expect(error.code).toBe("provider_failure");
    expect(error.message).toContain("Provider error 401");
    expect(error.message).toContain("invalid Bearer [redacted]");
    expect(error.message).toContain("api key=[redacted]");
    expect(error.message).not.toContain("sk-secret");
    expect(error.message).not.toContain("sk-other");
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
