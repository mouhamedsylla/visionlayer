import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le chargement seul d'un pack écrit par Muse (ADR 0019, étape 6, 03/11/2026) : quand toutes ses vérifications
 * passent, il quitte .vision/packs/proposes/ pour .vision/packs/, avec une fiche de ce qu'il a coûté. Le retirer le
 * range dans .vision/packs/retires/ : la carte redevient celle d'avant, et rien n'est perdu.
 */
export interface LoadedMeta { by: "muse"; pkg: string; at: string; tests: number; cost?: number }

const dir = (root: string) => join(root, ".vision", "packs");
const safe = (id: string) => { if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`identifiant refusé : ${id}`); return id; };

export function loadProposal(root: string, id: string, meta: LoadedMeta): void {
  const from = join(dir(root), "proposes", `${safe(id)}.yaml`);
  if (!existsSync(from)) throw new Error(`aucun pack proposé ${id}`);
  mkdirSync(join(dir(root), "meta"), { recursive: true });
  renameSync(from, join(dir(root), `${id}.yaml`));
  writeFileSync(join(dir(root), "meta", `${id}.json`), JSON.stringify(meta, null, 2));
}

export function retirePack(root: string, id: string): void {
  const from = join(dir(root), `${safe(id)}.yaml`);
  if (!existsSync(from)) throw new Error(`aucun pack chargé ${id}`);
  mkdirSync(join(dir(root), "retires"), { recursive: true });
  renameSync(from, join(dir(root), "retires", `${id}.yaml`));
  rmSync(join(dir(root), "meta", `${id}.json`), { force: true });
}

export function loadedMeta(root: string, id: string): LoadedMeta | undefined {
  const f = join(dir(root), "meta", `${id}.json`);
  try { return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : undefined; } catch { return undefined; }
}
