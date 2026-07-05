import { randomBytes, createHash } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isPast(iso: string | undefined): boolean {
  return Boolean(iso && new Date(iso).getTime() <= Date.now());
}

export function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function addDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
