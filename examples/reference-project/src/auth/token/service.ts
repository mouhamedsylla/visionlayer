import { randomUUID } from "node:crypto";

export function generate(): string {
  return randomUUID();
}

function isExpired(issuedAt: number): boolean {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return Date.now() - issuedAt > ONE_DAY_MS;
}

export function validate(token: string, issuedAt: number): boolean {
  return token.length > 0 && !isExpired(issuedAt);
}
