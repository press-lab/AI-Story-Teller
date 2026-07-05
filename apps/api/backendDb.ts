import type { LocalDbData } from "./apiTypes";

export interface BackendDb {
  read(): Promise<LocalDbData>;
  write(data: LocalDbData): Promise<void>;
  update<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  updatePersistingOnError<T>(mutate: (data: LocalDbData) => T | Promise<T>): Promise<T>;
  close(): Promise<void>;
}
