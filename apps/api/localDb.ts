import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { LocalDbData } from "./apiTypes";
import type { BackendDb } from "./backendDb";
import { createEmptyDb, normalizeDbData } from "./dbShape";

export { createEmptyDb };

export class LocalDb implements BackendDb {
  private readonly filePath: string;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  async read(): Promise<LocalDbData> {
    try {
      const text = await readFile(this.filePath, "utf8");
      return normalizeDbData(JSON.parse(text) as Partial<LocalDbData>);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
        return createEmptyDb();
      }
      throw error;
    }
  }

  async write(data: LocalDbData): Promise<void> {
    this.writeChain = this.writeChain.then(() => this.persist(data));
    await this.writeChain;
  }

  async update<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    const run = this.writeChain.then(async () => {
      const data = await this.read();
      const result = await mutate(data);
      await this.persist(data);
      return result;
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T> {
    const run = this.writeChain.then(async () => {
      const data = await this.read();
      try {
        const result = await mutate(data);
        await this.persist(data);
        return result;
      } catch (error) {
        await this.persist(data);
        throw error;
      }
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async persist(data: LocalDbData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}
