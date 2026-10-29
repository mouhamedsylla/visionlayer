import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ArchModelV2 } from "../arch/types.js";
import { assertWithinRepo } from "../model/paths.js";
import type { SourceExcerpt } from "./types.js";

/** Au plus tant de lignes par extrait : l'interface montre un passage, pas un fichier. */
export const MAX_LINES = 80;

export class SourceError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/**
 * Un passage d'un fichier cité comme preuve par la carte. Un fichier que la
 * carte ne cite pas, un fichier d'environnement ou un chemin hors du dépôt
 * sont refusés ; une valeur qui ressemble à un secret est masquée. `also` :
 * les fichiers cités par l'inventaire des technologies, quand il est calculé.
 */
export function readExcerpt(root: string, model: ArchModelV2, path: string, from: number, to: number, also: Set<string> = new Set()): SourceExcerpt {
  if (/^\.env(\..*)?$/.test(basename(path))) throw new SourceError(403, "fichier d'environnement : jamais lu");
  if (!also.has(path) && !citedPaths(model).has(path)) throw new SourceError(404, "fichier absent de la carte");
  assertWithinRepo(root, path);
  const lines = readFileSync(join(root, path), "utf8").split("\n");
  const start = Math.max(1, Math.min(from, lines.length));
  const end = Math.min(lines.length, Math.max(start, to), start + MAX_LINES - 1);
  return { path, from: start, lines: lines.slice(start - 1, end).map(redactSecrets) };
}

/** Tous les chemins que la carte cite : nœuds, facettes, liens, constats. */
function citedPaths(model: ArchModelV2): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.path === "string" && typeof o.line === "number") out.add(o.path);
    Object.values(o).forEach(walk);
  };
  walk(model);
  return out;
}

/** Une valeur dont la clé ressemble à un secret, ou des identifiants dans une adresse, sont masqués. */
export function redactSecrets(line: string): string {
  const m = line.match(/^(\s*-?\s*"?[A-Za-z0-9_.-]*(?:PASSWORD|PASSWD|SECRET|TOKEN|_KEY|API_KEY|DSN|CREDENTIAL|PRIVATE)[A-Za-z0-9_.-]*"?\s*[:=]\s*)(.+)$/i);
  const masked = m && m[2]!.trim() && !/^\$\{|^process\.env/.test(m[2]!.trim()) ? `${m[1]}<valeur masquée>` : line;
  return masked.replace(/(\w+:\/\/)([^/@\s"']+)@/g, "$1***@");
}
