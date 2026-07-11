import { afterEach, describe, expect, it } from "vitest";
import { loadApiConfig } from "./config";

const ENV_KEYS = [
  "AIST_API_HOST",
  "AIST_API_PORT",
  "PORT",
  "AIST_API_DATA_FILE",
  "AIST_DATABASE_URL",
  "DATABASE_URL",
  "AIST_API_ALLOWED_ORIGINS",
  "AIST_EMAIL_DELIVERY_MODE",
  "AIST_PASSWORD_SIGNUP_MODE",
] as const;

const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("API config", () => {
  it("uses Render PORT when AIST_API_PORT is not set", () => {
    process.env.AIST_API_PORT = "";
    process.env.PORT = "12345";

    expect(loadApiConfig().port).toBe(12345);
  });

  it("lets AIST_API_PORT override PORT for explicit local runs", () => {
    process.env.AIST_API_PORT = "8788";
    process.env.PORT = "12345";

    expect(loadApiConfig().port).toBe(8788);
  });

  it("uses either AIST_DATABASE_URL or DATABASE_URL for Postgres", () => {
    process.env.AIST_DATABASE_URL = "";
    process.env.DATABASE_URL = "postgres://example";

    expect(loadApiConfig().databaseUrl).toBe("postgres://example");
  });

  it("requires an explicit opt-in to disabled email delivery", () => {
    delete process.env.AIST_EMAIL_DELIVERY_MODE;
    expect(loadApiConfig().emailDeliveryMode).toBe("resend");
    process.env.AIST_EMAIL_DELIVERY_MODE = "disabled";
    expect(loadApiConfig().emailDeliveryMode).toBe("disabled");
  });

  it("requires an explicit opt-in to trusted-invite password signup", () => {
    delete process.env.AIST_PASSWORD_SIGNUP_MODE;
    expect(loadApiConfig().passwordSignupMode).toBe("emailVerification");
    process.env.AIST_PASSWORD_SIGNUP_MODE = "trustedInvite";
    expect(loadApiConfig().passwordSignupMode).toBe("trustedInvite");
    process.env.AIST_PASSWORD_SIGNUP_MODE = "disabled";
    expect(loadApiConfig().passwordSignupMode).toBe("disabled");
    process.env.AIST_PASSWORD_SIGNUP_MODE = "public";
    expect(() => loadApiConfig()).toThrow(/AIST_PASSWORD_SIGNUP_MODE/);
  });
});
