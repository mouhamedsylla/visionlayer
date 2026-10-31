import { lstatSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Proof } from "../arch/types.js";
import { statementBindings } from "../arch/ast.js";
import { createAliasResolver } from "../model/aliases.js";
import { parse } from "../parsers/parser.js";
import { languageFor } from "../scanner/scanner.js";
import { listProjectFiles } from "../scanner/files.js";
import { dependencyFor } from "../extractor/extractor.js";
import { packageName } from "../stack/build.js";
import { Database, type Value } from "./datalog.js";
import { packApplies, runPack, type Pack } from "./packs.js";
import { syntaxFacts } from "./syntax.js";
import { flowFacts } from "./syntax-flow.js";
import { contractFacts } from "./syntax-contract.js";
import type { FileFact, FileInput } from "./types.js";

/**
 * La base de faits d'un dépôt (RYP-190). Chaque fichier garde ses faits ; au
 * rafraîchissement, seul un fichier dont la date ou la taille a changé est
 * relu. Puis les faits de tous les fichiers sont joints par les règles des
 * packs. Mêmes fichiers, mêmes packs : même résultat, dans le même ordre.
 *
 * Jamais un `.env` : ces fichiers ne sont ni lus ni ouverts.
 */

export interface FactCache {
  version: 2;
  /** Empreinte des packs : un pack modifié fait tout relire. */
  packs: string;
  files: Record<string, { mtime: number; size: number; facts: FileFact[] }>;
}

export interface RefreshResult {
  /** Fichiers relus (nouveaux ou modifiés). */
  read: string[];
  /** Fichiers dont les faits en cache ont servi tels quels. */
  reused: number;
  removed: string[];
}

const LINE_MAX = 200;

/** Des composants qui importent du code, sans pack qui les lise : ce qu'ils emploient n'est pas connu. */
const UNREAD_IMPORTERS = /\.(svelte|vue|astro|mdx)$/;

/**
 * Un pack qui échoue sur un fichier (une forme de code qu'il n'attendait pas) ne fait pas tomber la carte :
 * ses faits pour ce fichier sont perdus, et l'échec est rendu comme un fait, que la carte montre comme non lu.
 */
function safely(pack: Pack, path: string, run: () => FileFact[], fact: (rel: string, args: Value[], line: number) => FileFact): FileFact[] {
  try {
    return run();
  } catch (e) {
    const message = ((e as Error)?.message ?? String(e)).split("\n")[0]!.slice(0, 200);
    return [fact("pack_failed", [pack.id, path, message], 1)];
  }
}

export class FactBase {
  private files: FactCache["files"] = {};
  /** Tous les fichiers du dépôt, lus ou non (un fichier Python existe même si aucun lecteur ne l'ouvre). */
  private listed: string[] = [];
  private readonly packsHash: string;

  constructor(readonly root: string, readonly packs: Pack[], cache?: FactCache) {
    this.packsHash = packs.map((p) => `${p.id}:${p.hash}`).join(",");
    if (cache && cache.version === 2 && cache.packs === this.packsHash) this.files = { ...cache.files };
  }

  /** Relit ce qui a changé depuis le dernier rafraîchissement (ou depuis le cache). */
  refresh(): RefreshResult {
    const read: string[] = [];
    let reused = 0;
    const present = new Set<string>();
    this.listed = [];
    for (const { path } of listProjectFiles(this.root).sort((a, b) => a.path.localeCompare(b.path))) {
      if (basename(path).startsWith(".env")) continue;
      this.listed.push(path);
      const language = languageFor(path);
      if (!language && !this.packs.some((p) => p.files && packApplies(p, { path, source: "" }))) continue;
      let stat;
      try { stat = lstatSync(join(this.root, path)); } catch { continue; }
      present.add(path);
      const old = this.files[path];
      if (old && old.mtime === stat.mtimeMs && old.size === stat.size) { reused++; continue; }
      const source = readFileSync(join(this.root, path), "utf8");
      this.files[path] = { mtime: stat.mtimeMs, size: stat.size, facts: this.readFile({ path, ...(language ? { language } : {}), source }) };
      read.push(path);
    }
    const removed = Object.keys(this.files).filter((p) => !present.has(p));
    for (const p of removed) delete this.files[p];
    return { read, reused, removed };
  }

  /** Les faits d'un fichier : syntaxe générique, puis chaque pack qui s'applique. */
  private readFile(file: FileInput): FileFact[] {
    const lines = file.source.split("\n");
    const fact = (rel: string, args: Value[], line: number): FileFact => {
      const text = (lines[line - 1] ?? "").trim();
      const proof: Proof = { path: file.path, line, source: file.language ? "syntax" : "manifest", ...(text ? { text: text.length > LINE_MAX ? text.slice(0, LINE_MAX) : text } : {}) };
      return { rel, args, proof };
    };
    const out: FileFact[] = [];
    if (file.language) {
      const tree = parse(file.source, file.language);
      const root = tree.rootNode;
      const imports = new Map<string, { imported: string; raw: string }>();
      for (const n of root.namedChildren) for (const [k, v] of statementBindings(n)) imports.set(k, v);
      out.push(...syntaxFacts(file.path, root, fact), ...flowFacts(file.path, root, fact), ...contractFacts(file.path, root, fact));
      for (const pack of this.packs) if (packApplies(pack, file, imports)) out.push(...safely(pack, file.path, () => runPack(pack, { file, root, imports, fact }), fact));
    } else {
      for (const pack of this.packs) if (packApplies(pack, file)) out.push(...safely(pack, file.path, () => runPack(pack, { file, fact }), fact));
    }
    return out;
  }

  paths(): string[] { return Object.keys(this.files).sort(); }

  /** Les faits établis par les fichiers, dans l'ordre des fichiers. */
  facts(): FileFact[] { return this.paths().flatMap((p) => this.files[p]!.facts); }

  toCache(): FactCache { return { version: 2, packs: this.packsHash, files: this.files }; }

  /**
   * Les faits joints par les règles. S'ajoutent aux faits des fichiers ceux
   * qui demandent de connaître tout le dépôt :
   *   present(Fichier)                               chaque fichier du dépôt, lu ou non
   *   file(Fichier)                                  chaque fichier lu
   *   imports(Fichier, Local, Cible, Importé)        import résolu vers un fichier du dépôt
   *   imports_pkg(Fichier, Local, Paquet, Importé)   import d'un paquet
   *   depends(Fichier, Cible)                        le fichier importe la cible
   *   pkg_of(Fichier, Dossier)                       le paquet du fichier : le dossier du package.json le plus proche ("" à la racine)
   *   pack_failed(Pack, Fichier, Erreur)            un pack qui a échoué sur ce fichier (venu des faits du fichier) : le reste de la carte est fait sans lui
   *   unread_importer(Fichier)                       un composant (.svelte, .vue, .astro, .mdx) qu'aucun pack ne lit, mais qui importe du code
   */
  database(): Database {
    const db = new Database();
    const known = new Set(this.paths());
    const aliases = createAliasResolver(this.root, known);
    for (const p of this.listed) db.add("present", [p]);
    for (const p of this.paths()) db.add("file", [p]);
    const pkgDirs = new Set(this.listed.filter((p) => p === "package.json" || p.endsWith("/package.json")).map((p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "")));
    for (const p of this.listed) {
      let d = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      while (d && !pkgDirs.has(d)) d = d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : "";
      if (pkgDirs.has(d)) db.add("pkg_of", [p, d]);
      if (UNREAD_IMPORTERS.test(p) && !known.has(p)) db.add("unread_importer", [p]);
    }
    for (const f of this.facts()) {
      db.add(f.rel, f.args, [f.proof]);
      if (f.rel !== "import_raw") continue;
      const [from, local, raw, imported] = f.args as string[];
      const dep = dependencyFor(raw!, from!, known, aliases);
      if (!dep.external && known.has(dep.to)) {
        db.add("imports", [from!, local!, dep.to, imported!], [f.proof]);
        db.add("depends", [from!, dep.to], [f.proof]);
      } else if (dep.external) {
        db.add("imports_pkg", [from!, local!, packageName(raw!) ?? raw!, imported!], [f.proof]);
      }
    }
    db.run(this.packs.flatMap((p) => p.rules));
    return db;
  }
}
