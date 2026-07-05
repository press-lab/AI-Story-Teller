import { spawnSync } from "node:child_process";

const apiUrl = process.argv[2]?.trim();
const branch = process.argv[3]?.trim() || "backend-local-implementation";

if (!apiUrl) {
  console.error("Usage: npm.cmd run pages:set-api -- https://your-api.example.com [branch]");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(apiUrl);
} catch {
  console.error("Backend API URL must be a valid URL.");
  process.exit(1);
}

if (parsed.protocol !== "https:") {
  console.error("GitHub Pages is HTTPS, so the public backend API URL must also be HTTPS.");
  process.exit(1);
}

run("gh", ["variable", "set", "AIST_PUBLIC_API_BASE_URL", "--body", apiUrl]);
run("gh", ["workflow", "run", "deploy.yml", "--ref", branch]);

console.log(`Set AIST_PUBLIC_API_BASE_URL=${apiUrl}`);
console.log(`Triggered Deploy to GitHub Pages on ${branch}.`);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
