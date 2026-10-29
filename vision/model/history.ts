import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SystemModel } from "./types.js";

const CURRENT = "model.json";
const PREVIOUS = "model.previous.json";

/** À appeler AVANT d'écraser model.json, pour que `vision diff` (et l'onglet Technologies) ait un avant/après. */
export function archiveCurrentAsPrevious(root: string): void {
  const dir = join(root, ".vision");
  const current = join(dir, CURRENT);
  if (existsSync(current)) {
    copyFileSync(current, join(dir, PREVIOUS));
  }
  // Même instant pour l'inventaire et l'infrastructure : « avant » est cohérent entre niveaux.
  for (const name of ["stack", "infra", "architecture"]) {
    const file = join(dir, `${name}.json`);
    if (existsSync(file)) copyFileSync(file, join(dir, `${name}.previous.json`));
  }
}

export function readPreviousModel(root: string): SystemModel | undefined {
  const previous = join(root, ".vision", PREVIOUS);
  if (!existsSync(previous)) return undefined;
  return JSON.parse(readFileSync(previous, "utf-8")) as SystemModel;
}
