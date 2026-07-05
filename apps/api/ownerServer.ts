import { networkInterfaces } from "node:os";
import { createApiServer } from "./server";

const host = process.env.AIST_API_HOST?.trim() || "127.0.0.1";
const publicApiUrl = process.env.AIST_PUBLIC_API_BASE_URL?.trim();
const api = createApiServer({ host, allowLocalGoogleStub: false });

assertOwnerServerConfig();

const { port } = await api.listen();

console.log("AI Story Teller owner-hosted API is running.");
console.log(`Data file: ${api.config.dataFile}`);
console.log(`Bind URL: http://${host}:${port}`);
if (isPublicBindHost(host)) {
  for (const address of localIpv4Addresses()) {
    console.log(`LAN URL: http://${address}:${port}`);
  }
}
if (publicApiUrl) {
  console.log(`Public frontend API URL: ${publicApiUrl}`);
} else {
  console.log("Public frontend API URL: not set.");
  console.log("Use an HTTPS tunnel/domain that forwards to this API, then set AIST_PUBLIC_API_BASE_URL to that HTTPS URL.");
}
console.log("Press Ctrl+C to stop.");

function assertOwnerServerConfig(): void {
  const errors: string[] = [];
  if (isPublicBindHost(host) && !envEnabled("AIST_ALLOW_PUBLIC_BIND")) {
    errors.push(
      "AIST_API_HOST is publicly bindable. Keep api:serve bound to 127.0.0.1 and use an HTTPS tunnel, or set AIST_ALLOW_PUBLIC_BIND=true intentionally.",
    );
  }
  if (!api.config.adminKey && api.config.adminEmails.length === 0) {
    errors.push("Set AIST_ADMIN_EMAILS or AIST_API_ADMIN_KEY before running the owner-hosted server.");
  }
  if (api.config.allowedOrigins.length === 0 || api.config.allowedOrigins.includes("*")) {
    errors.push("Set AIST_API_ALLOWED_ORIGINS to explicit frontend origins. Do not use '*'.");
  }
  if (publicApiUrl && !publicApiUrl.startsWith("https://")) {
    errors.push("AIST_PUBLIC_API_BASE_URL must be HTTPS for GitHub Pages.");
  }
  if (errors.length > 0) {
    console.error("Owner-hosted server refused to start:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
}

function isPublicBindHost(value: string): boolean {
  return value === "0.0.0.0" || value === "::" || value === "";
}

function envEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function localIpv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}
