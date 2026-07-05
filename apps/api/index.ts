import { createApiServer } from "./server";

const api = createApiServer();
const { url } = await api.listen();

console.log(`AI Story Teller local API listening at ${url}`);
console.log("Press Ctrl+C to stop.");
