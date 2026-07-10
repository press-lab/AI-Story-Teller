import { createApiServer } from "./server";

async function main(): Promise<void> {
  const api = createApiServer();
  const { url } = await api.listen();
  console.log(`AI Story Teller local API listening at ${url}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
console.log("Press Ctrl+C to stop.");
