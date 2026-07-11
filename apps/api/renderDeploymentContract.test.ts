import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Render deployment contract", () => {
  it("uses the explicit Free UAT migration-before-start contract", async () => {
    const blueprint = await readFile("render.yaml", "utf8");
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      engines?: { node?: string };
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const apiTsconfig = JSON.parse(await readFile("tsconfig.api.json", "utf8")) as {
      files?: string[];
    };
    const headers = await readFile("public/_headers", "utf8");

    expect(blueprint).toMatch(/^\s*plan:\s+free\s*$/m);
    expect(blueprint).toMatch(/^\s*buildCommand:\s+npm run api:render:build\s*$/m);
    expect(blueprint).not.toMatch(/^\s*preDeployCommand:/m);
    expect(blueprint).toMatch(/^\s*startCommand:\s+npm run api:hosted:free\s*$/m);
    expect(blueprint).toMatch(/^\s*value:\s+disabled\s*$/m);
    expect(blueprint).toMatch(/^\s*autoDeployTrigger:\s+checksPass\s*$/m);
    expect(blueprint).not.toMatch(/^\s*autoDeploy:/m);

    expect(packageJson.engines?.node).toBe("24.x");
    expect(packageJson.devDependencies?.["@types/node"]).toMatch(/^\^24\./);
    expect(packageJson.scripts?.["api:render:build"]).toContain("npm ci --include=dev");
    expect(packageJson.scripts?.["api:render:build"]).toContain("npm prune --omit=dev");
    expect(packageJson.scripts?.["api:db:migrate"]).toBe("node dist-api/apps/api/migrateSchema.js");
    expect(packageJson.scripts?.["api:hosted"]).toBe("node dist-api/apps/api/hostedServer.js");
    expect(packageJson.scripts?.["api:hosted:free"]).toBe("node dist-api/apps/api/freeHostedServer.js");
    expect(packageJson.scripts?.["api:deploy:parity"]).toBe("node scripts/api-deployment-parity.mjs");
    expect(packageJson.scripts?.["api:db:migrate"]).not.toContain("tsx");
    expect(packageJson.scripts?.["api:hosted"]).not.toContain("tsx");

    expect(apiTsconfig.files).toEqual(expect.arrayContaining([
      "apps/api/hostedServer.ts",
      "apps/api/freeHostedServer.ts",
      "apps/api/migrateSchema.ts",
    ]));
    expect(headers).toContain("Content-Security-Policy:");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("Strict-Transport-Security:");
    expect(headers).not.toMatch(/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval')/);
  });
});
