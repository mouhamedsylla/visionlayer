import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf, runTargets, sourceCandidates } from "./runs.js";

/**
 * pkg_main(Dossier, Fichier)   le fichier que désigne `main` (ou `module`)
 * pkg_script(PackageJson, Script, Fichier)  le fichier que lance un script (`"start": "tsx src/index.ts"`), ou sa source
 * pkg_src(Dossier, Fichier)    sa source possible : `main` désigne souvent le code compilé
 *                              (`lib/index.js`), la source est cherchée à la même place sous
 *                              `src/`, en .ts ou .tsx
 *
 * Toutes les places possibles sont émises ; les règles du pack ne gardent que
 * celles qui existent (`present`), la source avant le compilé.
 */
const script: PackScript = ({ file, fact }) => {
  let doc: Record<string, unknown>;
  try { doc = JSON.parse(file.source) as Record<string, unknown>; } catch { return []; }
  const dir = dirOf(file.path);
  const out: FileFact[] = [];
  const lines = file.source.split("\n");
  for (const key of ["main", "module"]) {
    const main = doc[key];
    if (typeof main !== "string" || main.includes("://")) continue;
    const line = lines.findIndex((l) => l.includes(`"${key}"`)) + 1 || 1;
    const rel = posix.normalize(main.replace(/^\.\//, ""));
    const at = (c: string) => posix.normalize(posix.join(dir, c));
    if (!at(rel).startsWith("..")) out.push(fact("pkg_main", [dir, at(rel)], line));
    for (const c of sourceCandidates(rel)) if (!at(c).startsWith("..")) out.push(fact("pkg_src", [dir, at(c)], line));
  }
  const scripts = doc.scripts;
  if (scripts && typeof scripts === "object") for (const [name, cmd] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof cmd !== "string") continue;
    const line = lines.findIndex((l) => l.includes(`"${name}"`)) + 1 || 1;
    for (const t of runTargets(cmd, dir)) for (const c of [t, ...sourceCandidates(t)]) out.push(fact("pkg_script", [file.path, name, c], line));
  }
  return out;
};

export default script;
