import { createApiServer } from "./server";
import type { ApiConfig } from "./config";

const api = createApiServer({
  host: hostedHost(),
  port: hostedPort(),
  allowLocalGoogleStub: false,
});

assertHostedServerConfig(api.config);

const { port } = await api.listen();

console.log("AI Story Teller hosted API is running.");
console.log(`Database: ${api.config.databaseUrl ? "postgres" : "local-json"}`);
console.log(`Bind URL: http://${api.config.host}:${port}`);
console.log(`Allowed origins: ${api.config.allowedOrigins.join(", ")}`);
console.log(`Policy mode: ${api.config.policyMode}`);

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
