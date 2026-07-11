import { createApiServer } from "./server";
import type { ApiConfig } from "./config";
import { pruneExpiredAndRetainedData } from "./dataLifecycle";

async function main(): Promise<void> {
  const api = createApiServer({
    host: hostedHost(),
    port: hostedPort(),
    allowLocalGoogleStub: false,
  });

  assertHostedServerConfig(api.config);
  await api.db.readiness();
  await cleanupLifecycle(api);
  const { port } = await api.listen();
  const cleanupTimer = setInterval(() => {
    void cleanupLifecycle(api).catch((error) => {
      console.warn("Scheduled retention cleanup failed:", error instanceof Error ? error.message : String(error));
    });
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();

  console.log("AI Story Teller hosted API is running.");
  console.log(`Database: ${api.config.databaseUrl ? "postgres" : "local-json"}`);
  console.log(`Bind URL: http://${api.config.host}:${port}`);
  console.log(`Allowed origins: ${api.config.allowedOrigins.join(", ")}`);
  console.log(`Policy mode: ${api.config.policyMode}`);
  console.log(`Password signup mode: ${api.config.passwordSignupMode}`);

  let shuttingDown = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      clearInterval(cleanupTimer);
      const forcedExit = setTimeout(() => {
        console.error(`Hosted API did not shut down cleanly after ${signal}.`);
        process.exit(1);
      }, 10_000);
      forcedExit.unref();
      void api.close()
        .then(() => {
          clearTimeout(forcedExit);
          process.exit(0);
        })
        .catch((error) => {
          clearTimeout(forcedExit);
          console.error("Hosted API shutdown failed:", error instanceof Error ? error.message : String(error));
          process.exit(1);
        });
    });
  }
}

function cleanupLifecycle(api: ReturnType<typeof createApiServer>): Promise<unknown> {
  return api.db.cleanupLifecycle
    ? api.db.cleanupLifecycle()
    : api.db.update((data) => pruneExpiredAndRetainedData(data));
}

void main().catch((error) => {
  console.error("Hosted API failed to start:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function hostedHost(): string {
  return process.env.AIST_API_HOST?.trim() || "0.0.0.0";
}

function hostedPort(): number {
  const port = numberFromEnv("PORT") ?? numberFromEnv("AIST_API_PORT");
  return port ?? 10000;
}

function numberFromEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function assertHostedServerConfig(config: ApiConfig): void {
  const errors: string[] = [];
  if (!isPublicBindHost(config.host)) {
    errors.push("Hosted API must bind to 0.0.0.0 or :: so Render can route public HTTP traffic to it.");
  }
  if (!config.databaseUrl) {
    errors.push("Set AIST_DATABASE_URL or DATABASE_URL to the Neon Postgres connection string.");
  }
  if (!config.adminKey && config.adminEmails.length === 0) {
    errors.push("Set AIST_ADMIN_EMAILS or AIST_API_ADMIN_KEY before running the hosted API.");
  }
  if (config.allowedOrigins.length === 0 || config.allowedOrigins.includes("*")) {
    errors.push("Set AIST_API_ALLOWED_ORIGINS to explicit frontend origins. Do not use '*'.");
  }
  if (!config.allowedOrigins.some((origin) => origin.startsWith("https://"))) {
    errors.push("AIST_API_ALLOWED_ORIGINS should include the HTTPS Cloudflare Pages origin.");
  }
  if (!config.providerConfig.apiKey) {
    errors.push("Set AIST_PROVIDER_API_KEY so hosted backend generation can use the platform provider key.");
  }
  if (config.emailDeliveryMode === "disabled" && config.policyMode !== "reviewOnly") {
    errors.push("AIST_EMAIL_DELIVERY_MODE=disabled is allowed only with AIST_POLICY_MODE=reviewOnly for controlled UAT.");
  }
  if (config.passwordSignupMode === "trustedInvite"
    && (config.emailDeliveryMode !== "disabled" || config.policyMode !== "reviewOnly")) {
    errors.push("AIST_PASSWORD_SIGNUP_MODE=trustedInvite requires AIST_EMAIL_DELIVERY_MODE=disabled and AIST_POLICY_MODE=reviewOnly.");
  }
  if (config.emailDeliveryMode === "resend" && !config.emailDelivery && (!config.resendApiKey || !config.emailFrom)) {
    errors.push("Set RESEND_API_KEY and AIST_EMAIL_FROM so hosted verification and password reset email can be delivered.");
  }
  if (config.googleOAuth.redirectUri && !config.googleOAuth.redirectUri.startsWith("https://")) {
    errors.push("Set AIST_GOOGLE_REDIRECT_URI to the hosted HTTPS callback URL.");
  }
  if (errors.length > 0) {
    console.error("Hosted server refused to start:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
}

function isPublicBindHost(value: string): boolean {
  return value === "0.0.0.0" || value === "::" || value === "";
}
