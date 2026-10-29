import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf } from "./runs.js";

/**
 * firebase.json, tel que le décrit la documentation de Firebase
 * (https://firebase.google.com/docs/cli#the_firebasejson_file) :
 *
 * unit(Fichier, Nom, "function")             une codebase de Cloud Functions (`functions`, objet ou liste)
 * fn_source(Fichier, Nom, Dossier)           son dossier source (`source`, par défaut `functions`)
 * store_decl(Fichier, Tech, Rôle, Forme, Nom) Firestore, Storage, Realtime Database déclarés
 * rules_file(Fichier, Tech, Chemin)          le fichier de règles d'accès de chacun
 * hosting(Fichier, Cible, Dossier)           un site d'hébergement et le dossier qu'il sert
 * hosting_rewrite(Fichier, Cible, Source, Genre, Destination)
 *                                            une réécriture : vers une fonction, un service Cloud Run, une page
 */
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const script: PackScript = ({ file, fact }) => {
  let doc: Rec;
  try { doc = rec(JSON.parse(file.source)); } catch { return []; }
  const dir = dirOf(file.path);
  const lines = file.source.split("\n");
  const lineOf = (needle: string, from = 0) => {
    const i = lines.findIndex((l, n) => n >= from && l.includes(needle));
    return i < 0 ? 1 : i + 1;
  };
  const at = (p: string) => posix.normalize(posix.join(dir, p));
  const out: FileFact[] = [];

  const fnLine = lineOf('"functions"');
  for (const fn of list(doc.functions).map(rec)) {
    const codebase = str(fn.codebase) ?? "default";
    const name = codebase === "default" ? "functions" : codebase;
    const line = codebase === "default" ? fnLine : lineOf(`"${codebase}"`, fnLine - 1);
    out.push(fact("unit", [file.path, name, "function"], line));
    out.push(fact("fn_source", [file.path, name, at(str(fn.source) ?? "functions")], line));
  }

  const stores: [string, string, string, string, string][] = [
    ["firestore", "firestore", "store", "document", "Firestore"],
    ["storage", "firebasestorage", "store", "blob", "Cloud Storage"],
    ["database", "firebasedatabase", "store", "document", "Realtime Database"],
  ];
  for (const [key, tech, role, shape, name] of stores) {
    if (!(key in doc)) continue;
    const line = lineOf(`"${key}"`);
    out.push(fact("store_decl", [file.path, tech, role, shape, name], line));
    for (const s of list(doc[key]).map(rec)) {
      const rules = str(s.rules);
      if (rules) out.push(fact("rules_file", [file.path, tech, at(rules)], lineOf(rules, line - 1)));
    }
  }

  let from = 0;
  for (const h of list(doc.hosting).map(rec)) {
    const target = str(h.target) ?? str(h.site) ?? "hosting";
    const line = lineOf(str(h.target) || str(h.site) ? `"${target}"` : '"hosting"', from);
    from = line;
    out.push(fact("hosting", [file.path, target, at(str(h.public) ?? "public")], line));
    for (const r of list(h.rewrites).map(rec)) {
      const source = str(r.source) ?? str(r.regex) ?? "**";
      const rl = lineOf(`"${source}"`, line - 1);
      const fn = typeof r.function === "string" ? r.function : str(rec(r.function).functionId);
      if (fn) out.push(fact("hosting_rewrite", [file.path, target, source, "function", fn], rl));
      else if (str(rec(r.run).serviceId)) out.push(fact("hosting_rewrite", [file.path, target, source, "run", str(rec(r.run).serviceId)!], rl));
      else if (str(r.destination)) out.push(fact("hosting_rewrite", [file.path, target, source, "page", str(r.destination)!], rl));
    }
  }
  return out;
};
export default script;
