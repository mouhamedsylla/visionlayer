import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf, runTargets, sourceCandidates } from "./runs.js";

/**
 * Paquet Node, d'après son inventaire (docs/fonctionnement/packs/node-package.md).
 *
 * pkg_main(Dossier, Fichier)   le fichier que désigne `main` (ou `module`)
 * pkg_name(PackageJson, Nom)   son nom (`@app/web`) : un script d'un autre paquet le désigne ainsi
 * pkg_script(PackageJson, Script, Fichier)  le fichier que lance un script (`"start": "tsx src/index.ts"`), ou sa source
 * pkg_calls(PackageJson, Script, Autre)                 `npm run autre`, `pnpm autre`, `run-p a b` : un script du même paquet
 * pkg_calls_named(PackageJson, Script, Nom, Autre)      `pnpm --filter @app/web start` : le script d'un paquet, par son nom
 * pkg_calls_file(PackageJson, Script, PackageJson2, Autre)   `pnpm --filter ./apps/web start` : par son dossier
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
  if (typeof doc.name === "string") out.push(fact("pkg_name", [file.path, doc.name], lines.findIndex((l) => l.includes(`"name"`)) + 1 || 1));
  const scripts = doc.scripts;
  if (scripts && typeof scripts === "object") for (const [name, cmd] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof cmd !== "string") continue;
    const line = lines.findIndex((l) => l.includes(`"${name}"`)) + 1 || 1;
    for (const t of runTargets(cmd, dir)) for (const c of [t, ...sourceCandidates(t)]) out.push(fact("pkg_script", [file.path, name, c], line));
    for (const c of scriptCalls(cmd)) {
      if (c.dir !== undefined) out.push(fact("pkg_calls_file", [file.path, name, posix.normalize(posix.join(dir, c.dir, "package.json")), c.script], line));
      else if (c.pkg !== undefined) out.push(fact("pkg_calls_named", [file.path, name, c.pkg, c.script], line));
      else if (c.script !== name) out.push(fact("pkg_calls", [file.path, name, c.script], line));
    }
  }
  return out;
};

/** Les commandes de pnpm qui ne sont pas des scripts : `pnpm install` n'appelle pas un script nommé install. */
const PNPM_BUILTIN = new Set(["install", "i", "add", "remove", "rm", "update", "up", "exec", "dlx", "create", "init", "publish", "link", "unlink", "store", "why", "list", "ls", "outdated", "audit", "prune", "rebuild", "import", "fetch", "patch", "setup", "env", "config", "deploy", "pack", "licenses", "server"]);
const YARN_BUILTIN = new Set(["install", "add", "remove", "upgrade", "up", "init", "publish", "link", "unlink", "info", "why", "list", "dlx", "exec", "config", "cache", "set", "workspaces", "npm", "plugin", "pack", "constraints", "dedupe", "explain"]);
const NPM_LIFECYCLE = new Set(["start", "test", "stop", "restart"]);

/**
 * Les scripts qu'une commande appelle par npm, pnpm, Yarn, Bun, run-p ou npm-run-all, avec le paquet visé
 * quand ce n'est pas le même : par son nom (`pkg`) ou par son dossier (`dir`). Un motif (`./apps/*`) n'est pas déplié.
 */
export function scriptCalls(cmd: string): { script: string; pkg?: string; dir?: string }[] {
  const out: { script: string; pkg?: string; dir?: string }[] = [];
  // Chaque commande : entre guillemets (concurrently "a" "b"), ou séparée par &&, ||, ;, &, |.
  const quoted = [...cmd.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? "");
  const bare = cmd.replace(/"[^"]*"|'[^']*'/g, " ");
  for (const part of [...quoted, ...bare.split(/&&|\|\||;|&|\|/)]) {
    const t = part.trim().split(/\s+/).filter(Boolean);
    const i = t.findIndex((w) => /^(npm|pnpm|yarn|bun|run-p|run-s|npm-run-all)$/.test(w));
    if (i < 0) continue;
    const tool = t[i]!, rest = t.slice(i + 1);
    const target: { pkg?: string; dir?: string } = {};
    const words: string[] = [];
    let pattern = false;
    for (let k = 0; k < rest.length; k++) {
      const w = rest[k]!;
      const opt = w.match(/^(--filter|-F|--workspace|-w)(?:=(.+))?$/);
      if (opt) {
        const v = opt[2] ?? rest[++k];
        // Un motif (`./apps/*`) ou plusieurs paquets : rien n'est affirmé pour cette commande.
        if (!v || v.includes("*")) { pattern = true; break; }
        if (/^\.{0,2}\//.test(v) || (tool === "npm" && v.includes("/") && !v.startsWith("@"))) target.dir = v.replace(/^\.\//, "");
        else target.pkg = v;
        continue;
      }
      if (w.startsWith("-")) continue;
      words.push(w);
    }
    if (pattern || rest.includes("-r") || rest.includes("--recursive")) continue;
    if (tool === "run-p" || tool === "run-s" || tool === "npm-run-all") { for (const w of words) out.push({ script: w, ...target }); continue; }
    let names: string[] = [];
    if (tool === "npm") names = words[0] === "run" || words[0] === "run-script" ? words.slice(1, 2) : NPM_LIFECYCLE.has(words[0] ?? "") ? [words[0]!] : [];
    else if (tool === "bun") names = words[0] === "run" ? words.slice(1, 2) : [];
    else if (tool === "yarn") {
      if (words[0] === "workspace" && words.length >= 3) { target.pkg = words[1]; names = [words[2] === "run" ? words[3]! : words[2]!].filter(Boolean); }
      else names = words[0] === "run" ? words.slice(1, 2) : words[0] && !YARN_BUILTIN.has(words[0]) ? [words[0]] : [];
    } else names = words[0] === "run" ? words.slice(1, 2) : words[0] && !PNPM_BUILTIN.has(words[0]) ? [words[0]] : [];
    for (const n of names) out.push({ script: n, ...target });
  }
  return out;
}

export default script;
