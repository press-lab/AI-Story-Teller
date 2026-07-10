import { cp, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist-api/apps/api", { recursive: true });
await writeFile("dist-api/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n", "utf8");
await cp("apps/api/migrations", "dist-api/apps/api/migrations", { recursive: true });
