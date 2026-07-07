import { execSync } from "child_process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

function getCommitHash(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH?.trim() || "/",
  define: {
    __COMMIT_HASH__: JSON.stringify(getCommitHash()),
  },
  test: {
    testTimeout: 10000,
  },
});
