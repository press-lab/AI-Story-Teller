import { networkInterfaces } from "node:os";
import { createApiServer } from "./server";

const host = process.env.AIST_API_HOST?.trim() || "0.0.0.0";
const api = createApiServer({ host });
const { port } = await api.listen();

const publicApiUrl = process.env.AIST_PUBLIC_API_BASE_URL?.trim();

console.log("AI Story Teller owner-hosted API is running.");
console.log(`Data file: ${api.config.dataFile}`);
console.log(`Bind URL: http://${host}:${port}`);
for (const address of localIpv4Addresses()) {
  console.log(`LAN URL: http://${address}:${port}`);
}
if (publicApiUrl) {
  console.log(`Public frontend API URL: ${publicApiUrl}`);
} else {
  console.log("Public frontend API URL: not set.");
  console.log("Use an HTTPS tunnel/domain that forwards to this API, then set AIST_PUBLIC_API_BASE_URL to that HTTPS URL.");
}
console.log("Press Ctrl+C to stop.");

function localIpv4Addresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}
