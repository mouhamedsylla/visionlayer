import { statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { listProjectFiles } from "../scanner/files.js";
import { supportedExtensions } from "../scanner/scanner.js";
import type { SystemModel } from "./types.js";

/**
 * La carte correspond-elle encore au code ? Compare le disque au dernier scan,
 * sans rien lire d'autre que les métadonnées des fichiers (date de
 * modification) : aucun contenu n'est ouvert.
 *
 * Ne comptent que les fichiers dont la carte dépend : le code, les manifestes
 * et les configurations (JSON, YAML, TOML, Dockerfile). Un README modifié ne
 * rend pas la carte fausse. Les `.env` ne sont jamais consultés.
 */

export interface Freshness {
  scannedAt: string;
  /** Fichiers modifiés, ajoutés ou supprimés depuis le scan (au plus 50 listés). */
  changed: { path: string; change: "modified" | "added" | "deleted" }[];
  changedCount: number;
}

const CONFIG_EXT = new Set([".json", ".yaml", ".yml", ".toml"]);
const LISTED = 50;

export function mapRelevant(path: string): boolean {
  const name = basename(path);
  if (/^\.env/.test(name)) return false;
  const ext = extname(name);
  return supportedExtensions().includes(ext) || CONFIG_EXT.has(ext) || /^Dockerfile/.test(name) || /^requirements.*\.txt$/.test(name);
}

export function modelFreshness(root: string, model: SystemModel, scannedAt: string): Freshness {
  const since = Date.parse(scannedAt);
  const inModel = new Set(model.files.map((f) => f.path));
  const onDisk = new Set<string>();
  const changed: Freshness["changed"] = [];
  for (const f of listProjectFiles(root)) {
    if (!mapRelevant(f.path)) continue;
    onDisk.add(f.path);
    let mtime: number;
    try {
      mtime = statSync(join(root, f.path)).mtimeMs;
    } catch {
      continue;
    }
    if (mtime <= since) continue;
    changed.push({ path: f.path, change: inModel.has(f.path) || !supportedExtensions().includes(extname(f.path)) ? "modified" : "added" });
  }
  for (const p of inModel) if (!onDisk.has(p)) changed.push({ path: p, change: "deleted" });
  changed.sort((a, b) => a.path.localeCompare(b.path));
  return { scannedAt, changed: changed.slice(0, LISTED), changedCount: changed.length };
}
