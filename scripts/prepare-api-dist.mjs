import { cp, mkdir, rm, writeFile } from "node:fs/promises";

if (process.argv.includes("--clean")) {
  await rm("dist-api", { recursive: true, force: true });
  process.exit(0);
}

await mkdir("dist-api/apps/api", { recursive: true });
await writeFile("dist-api/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n", "utf8");
await cp("apps/api/migrations", "dist-api/apps/api/migrations", { recursive: true });
