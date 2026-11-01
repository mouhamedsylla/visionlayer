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
 * pkg_calls_glob(PackageJson, Script, Commande, Genre, Clé, Autre)   `pnpm --filter "./packages/*" start`, `pnpm -r start` :
 *                              les paquets que désigne un filtre (Genre dir, name ou all), dans la commande n° Commande du script
 * pkg_calls_except(PackageJson, Script, Commande, Genre, Clé)          `--filter "!./packages/enterprise"` : ceux qu'elle exclut
 * pkg_glob(PackageJson, Genre, Clé)   les clés de filtre qui désignent ce paquet : son dossier (`packages/backend`),
 *                              `packages/*`, `packages/**`, `**` ; son nom, `@scope/*`, `*` ; `all` hors de la racine
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
  const nameLine = lines.findIndex((l) => l.includes(`"name"`)) + 1 || 1;
  if (typeof doc.name === "string") out.push(fact("pkg_name", [file.path, doc.name], nameLine));
  for (const [kind, key] of globKeys(dir, typeof doc.name === "string" ? doc.name : undefined)) out.push(fact("pkg_glob", [file.path, kind, key], nameLine));
  const scripts = doc.scripts;
  if (scripts && typeof scripts === "object") for (const [name, cmd] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof cmd !== "string") continue;
    const line = lines.findIndex((l) => l.includes(`"${name}"`)) + 1 || 1;
    for (const t of runTargets(cmd, dir)) for (const c of [t, ...sourceCandidates(t)]) out.push(fact("pkg_script", [file.path, name, c], line));
    for (const c of scriptCalls(cmd)) {
      if (c.filters) {
        for (const f of c.filters) {
          const key = f.kind === "dir" ? posix.normalize(posix.join(dir, f.key)) : f.key;
          out.push(f.not ? fact("pkg_calls_except", [file.path, name, c.group!, f.kind, key], line) : fact("pkg_calls_glob", [file.path, name, c.group!, f.kind, key, c.script], line));
        }
      } else if (c.dir !== undefined) out.push(fact("pkg_calls_file", [file.path, name, posix.normalize(posix.join(dir, c.dir, "package.json")), c.script], line));
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
export interface Filter { kind: "dir" | "name" | "all"; key: string; not?: boolean }
export interface ScriptCall { script: string; pkg?: string; dir?: string; filters?: Filter[]; group?: number }

export function scriptCalls(cmd: string): ScriptCall[] {
  const out: ScriptCall[] = [];
  let group = 0;
  // Chaque commande : entre guillemets (concurrently "a" "b"), ou séparée par &&, ||, ;, &, |.
  // Entre guillemets avec des espaces, c'est une commande ; sans espace, un argument (`--filter "./apps/*"`).
  const quoted = [...cmd.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? "").filter((q) => /\s/.test(q));
  const bare = cmd.replace(/"([^"]*)"|'([^']*)'/g, (m, a?: string, b?: string) => (/\s/.test(a ?? b ?? "") ? " " : (a ?? b ?? "")));
  for (const part of [...quoted, ...bare.split(/&&|\|\||;|&|\|/)]) {
    const t = part.trim().split(/\s+/).filter(Boolean);
    const i = t.findIndex((w) => /^(npm|pnpm|yarn|bun|run-p|run-s|npm-run-all)$/.test(w));
    if (i < 0) continue;
    const tool = t[i]!, rest = t.slice(i + 1);
    const target: { pkg?: string; dir?: string; filters?: Filter[]; group?: number } = {};
    const words: string[] = [];
    const filters: Filter[] = [];
    for (let k = 0; k < rest.length; k++) {
      const w = rest[k]!;
      const opt = w.match(/^(--filter|-F|--workspace|-w)(?:=(.+))?$/);
      if (opt) {
        const f = filterOf(opt[2] ?? rest[++k] ?? "", tool);
        if (f) filters.push(f);
        continue;
      }
      if ((w === "-r" || w === "--recursive") && tool === "pnpm") { filters.push({ kind: "all", key: "*" }); continue; }
      if (w.startsWith("-")) continue;
      words.push(w);
    }
    // Un seul paquet nommé exactement : comme avant. Sinon (motif, exclusion, plusieurs filtres, -r) : les filtres.
    const single = filters.length === 1 && !filters[0]!.not && filters[0]!.kind !== "all" && !filters[0]!.key.includes("*");
    if (single) { if (filters[0]!.kind === "dir") target.dir = filters[0]!.key; else target.pkg = filters[0]!.key; }
    else if (filters.length) {
      if (!filters.some((f) => !f.not)) filters.push({ kind: "all", key: "*" });
      target.filters = filters;
      target.group = group++;
    }
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

/**
 * Un filtre de pnpm, npm ou Yarn, d'après la documentation de pnpm (« Filtering ») : un dossier s'écrit
 * avec `./` ou entre accolades, un nom sinon ; `!` exclut ; `*` et `**` sont des motifs.
 */
function filterOf(raw: string, tool: string): Filter | undefined {
  let v = raw.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!v) return undefined;
  const not = v.startsWith("!");
  if (not) v = v.slice(1);
  const braced = v.startsWith("{") && v.endsWith("}");
  if (braced) v = v.slice(1, -1);
  // Les sélecteurs de graphe (`foo...`, `...foo`, `[origin/main]`) ne sont pas lus.
  if (v.includes("...") || v.startsWith("[")) return undefined;
  const isDir = braced || /^\.{0,2}(\/|$)/.test(v) || (tool === "npm" && v.includes("/") && !v.startsWith("@"));
  const key = isDir ? posix.normalize(v.replace(/^\.\//, "")).replace(/\/$/, "") : v;
  return { kind: isDir ? "dir" : "name", key, ...(not ? { not: true } : {}) };
}

/** Les clés de filtre qui désignent un paquet : son dossier et ses motifs, son nom et ses motifs. */
export function globKeys(dir: string, name?: string): [Filter["kind"], string][] {
  const out: [Filter["kind"], string][] = [["dir", dir]];
  if (dir !== ".") {
    out.push(["dir", posix.join(posix.dirname(dir), "*")], ["all", "*"]);
    for (let a = posix.dirname(dir); ; a = posix.dirname(a)) {
      out.push(["dir", a === "." ? "**" : `${a}/**`]);
      if (a === ".") break;
    }
  }
  if (name) {
    out.push(["name", name], ["name", "*"]);
    if (name.startsWith("@") && name.includes("/")) out.push(["name", `${name.slice(0, name.indexOf("/"))}/*`]);
  }
  return out.map(([k, v]) => [k, k === "dir" ? v.replace(/^\.\//, "") : v] as [Filter["kind"], string]);
}

export default script;
