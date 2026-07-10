import { spawn } from "node:child_process";

const port = 18_000 + Math.floor(Math.random() * 1_000);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npm, ["run", "api:hosted"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    AIST_API_HOST: "0.0.0.0",
    AIST_API_ALLOWED_ORIGINS: "https://story.example.com",
    AIST_ADMIN_EMAILS: "admin@example.com",
    AIST_PROVIDER_API_KEY: "ci-provider-key",
    AIST_GOOGLE_REDIRECT_URI: "https://api.example.com/auth/google/callback",
    AIST_WEB_APP_URL: "https://story.example.com/",
    RESEND_API_KEY: "ci-resend-key",
    AIST_EMAIL_FROM: "AI Story Teller <accounts@example.com>",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => { output += String(chunk); });
child.stderr.on("data", (chunk) => { output += String(chunk); });

try {
  const deadline = Date.now() + 20_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/readyz`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error(`Hosted API did not become ready.\n${output}`);
  child.kill("SIGTERM");
  const exitCode = await new Promise((resolve) => child.once("exit", resolve));
  if (exitCode !== 0) throw new Error(`Hosted API exited with ${exitCode}.\n${output}`);
  console.log(`Hosted API production smoke passed on port ${port}.`);
} finally {
  if (child.exitCode === null) child.kill("SIGKILL");
}
