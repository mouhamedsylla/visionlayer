import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import Parser from "tree-sitter";
import { minimatch } from "minimatch";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { Language } from "../model/types.js";
import { grammarFor } from "../parsers/parser.js";
import { importBindings, literal, resolveIdentifier, unwrap, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";
import { parseRules, type Rule, type Value } from "./datalog.js";
import type { FileFact, FileInput } from "./types.js";

/**
 * Un pack dit ce que veut dire un framework, comme des données (doc 07 §4.3) :
 * des motifs de l'arbre syntaxique (requêtes tree-sitter), filtrés par une
 * clause `where`, qui émettent des faits neutres ; et des règles qui les
 * joignent. Ce que les motifs ne savent pas dire passe par un script
 * TypeScript (`script:`), la porte décidée le 01/10/2026.
 *
 *   id: express
 *   when: { imports: [express] }
 *   match:
 *     - query: (call_expression function: (member_expression ...) @verb ...)
 *       where: { verb: [get, post] }
 *       emit: http_route($file, "{verb:upper} {path}", @handler:symbol, @handler:line)
 *   rules: |
 *     entrypoint(F, "http", K, H, L) :- http_route(F, K, H, L).
 */

const Where = z.union([
  z.array(z.string()),
  z.strictObject({ any: z.array(z.string()) }),
  z.strictObject({ not: z.array(z.string()) }),
  z.strictObject({ match: z.string() }),
  /** L'identifiant est créé par un appel à ce que fournit ce paquet : `const app = express()`, `Router()`. */
  z.strictObject({ bound_to: z.union([z.string(), z.array(z.string())]) }),
  /** L'identifiant est lui-même importé de ce paquet : `import cron from "node-cron"`. */
  z.strictObject({ import_of: z.union([z.string(), z.array(z.string())]) }),
]);

const Match = z.strictObject({
  id: z.string().optional(),
  query: z.string().min(1),
  where: z.record(z.string(), Where).optional(),
  /** La capture dont la ligne prouve le fait (par défaut, la première ligne du motif). */
  at: z.string().optional(),
  emit: z.union([z.string(), z.array(z.string())]),
});

const PackFile = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  /** Technologies du catalogue que ce pack sait lire (logos, et « pack manquant » dans la couverture). */
  tech: z.array(z.string()).default([]),
  languages: z.array(z.enum(["javascript", "typescript"])).optional(),
  /** Fichiers lus par ce pack, hors code (manifestes) : motifs glob. */
  files: z.array(z.string()).optional(),
  /** Ses manifestes disent comment une unité est lancée ou où elle tourne (écran Déploiement), pas seulement qu'elle existe. */
  deploys: z.boolean().optional(),
  when: z.strictObject({ imports: z.array(z.string()) }).optional(),
  match: z.array(Match).default([]),
  script: z.string().optional(),
  rules: z.string().optional(),
});

/** Ce qu'un script de pack reçoit pour un fichier, et ce qu'il renvoie. */
export interface ScriptContext {
  file: FileInput;
  /** Arbre syntaxique, pour un fichier de code. */
  root?: Node;
  /** Liaisons d'import du fichier (code). */
  imports?: Map<string, { imported: string; raw: string }>;
  /** Fabrique un fait prouvé par une ligne de ce fichier. */
  fact(rel: string, args: Value[], line: number): FileFact;
}
export type PackScript = (ctx: ScriptContext) => FileFact[];

export interface Pack {
  id: string;
  name: string;
  tech: string[];
  deploys?: boolean;
  languages?: Language[];
  files?: string[];
  imports?: string[];
  matches: { id: string; query: string; where: Record<string, z.infer<typeof Where>>; at?: string; emit: Emit[] }[];
  script?: PackScript;
  rules: Rule[];
  /** Empreinte du pack : un pack modifié invalide les faits mis en cache. */
  hash: string;
}

/* ----------------------------------------------------------------------- */
/* Chargement                                                               */
/* ----------------------------------------------------------------------- */

export const BUILTIN_PACKS = join(dirname(new URL(import.meta.url).pathname), "..", "packs");

export async function loadPacks(dir = BUILTIN_PACKS): Promise<Pack[]> {
  const files = readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort();
  const packs: Pack[] = [];
  for (const f of files) packs.push(await loadPack(join(dir, f)));
  return packs;
}

export async function loadPack(path: string): Promise<Pack> {
  const text = readFileSync(path, "utf8");
  let raw: unknown;
  try { raw = parseYaml(text); } catch (e) { throw new Error(`${path} : ${(e as Error).message.split("\n")[0]}`); }
  const parsed = PackFile.safeParse(raw);
  if (!parsed.success) throw new Error(`${path} : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  const p = parsed.data;
  let script: PackScript | undefined;
  let scriptText = "";
  if (p.script) {
    const scriptPath = join(dirname(path), p.script);
    scriptText = readFileSync(scriptPath, "utf8");
    script = ((await import(pathToFileURL(scriptPath).href)) as { default: PackScript }).default;
  }
  const languages = p.languages?.flatMap((l): Language[] => (l === "typescript" ? ["typescript", "tsx"] : ["javascript", "jsx"]));
  return {
    id: p.id,
    name: p.name,
    tech: p.tech,
    ...(p.deploys ? { deploys: true } : {}),
    ...(languages ? { languages } : {}),
    ...(p.files ? { files: p.files } : {}),
    ...(p.when ? { imports: p.when.imports } : {}),
    matches: p.match.map((m, i) => ({
      id: m.id ?? `${p.id}#${i + 1}`,
      query: m.query,
      where: m.where ?? {},
      ...(m.at ? { at: m.at } : {}),
      emit: (Array.isArray(m.emit) ? m.emit : [m.emit]).map((e) => parseEmit(e, `${path} (${m.id ?? i + 1})`)),
    })),
    ...(script ? { script } : {}),
    rules: p.rules ? parseRules(p.rules, path) : [],
    hash: hashText(text + scriptText),
  };
}

function hashText(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

/* ----------------------------------------------------------------------- */
/* Émission : `rel($file, @cap, @cap:symbol, "{cap:upper} {other}", 3, mot)` */
/* ----------------------------------------------------------------------- */

type Arg =
  | { kind: "const"; value: Value }
  | { kind: "file" }
  | { kind: "line" }
  | { kind: "capture"; name: string; mod: Mod }
  | { kind: "template"; parts: ({ text: string } | { name: string; mod: Mod })[] };
type Mod = "text" | "raw" | "upper" | "lower" | "symbol" | "line" | "pkg";
interface Emit { rel: string; args: Arg[] }

const MODS = new Set<Mod>(["text", "raw", "upper", "lower", "symbol", "line", "pkg"]);

function parseEmit(src: string, origin: string): Emit {
  const m = src.trim().match(/^([a-z_][a-z0-9_]*)\((.*)\)$/s);
  if (!m) throw new Error(`${origin} : émission illisible « ${src} »`);
  const args: Arg[] = [];
  for (const raw of splitArgs(m[2]!)) {
    const a = raw.trim();
    const mod = (s?: string): Mod => {
      const v = (s ?? "text") as Mod;
      if (!MODS.has(v)) throw new Error(`${origin} : modificateur inconnu « ${s} »`);
      return v;
    };
    if (a === "$file") args.push({ kind: "file" });
    else if (a === "$line") args.push({ kind: "line" });
    else if (a.startsWith("@")) { const [name, md] = a.slice(1).split(":"); args.push({ kind: "capture", name: name!, mod: mod(md) }); }
    else if (a.startsWith('"')) {
      const body = a.slice(1, -1);
      const parts: ({ text: string } | { name: string; mod: Mod })[] = [];
      let last = 0;
      for (const t of body.matchAll(/\{([a-z_][a-z0-9_]*)(?::([a-z]+))?\}/gi)) {
        if (t.index! > last) parts.push({ text: body.slice(last, t.index) });
        parts.push({ name: t[1]!, mod: mod(t[2]) });
        last = t.index! + t[0].length;
      }
      if (last < body.length) parts.push({ text: body.slice(last) });
      args.push(parts.every((p) => "text" in p) ? { kind: "const", value: body } : { kind: "template", parts });
    } else if (/^-?\d+$/.test(a)) args.push({ kind: "const", value: Number(a) });
    else if (/^[a-z_][a-z0-9_-]*$/.test(a)) args.push({ kind: "const", value: a });
    else throw new Error(`${origin} : argument illisible « ${a} »`);
  }
  return { rel: m[1]!, args };
}

function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = false, cur = "";
  for (const c of s) {
    if (c === '"') quote = !quote;
    if (!quote && c === "(") depth++;
    if (!quote && c === ")") depth--;
    if (!quote && depth === 0 && c === ",") { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/* ----------------------------------------------------------------------- */
/* Application d'un pack à un fichier                                       */
/* ----------------------------------------------------------------------- */

const queryCache = new Map<string, Parser.Query>();

function compiled(query: string, language: Language): Parser.Query {
  const k = `${language}\0${query}`;
  let q = queryCache.get(k);
  if (!q) {
    q = new Parser.Query(grammarFor(language) as ConstructorParameters<typeof Parser.Query>[0], query);
    queryCache.set(k, q);
  }
  return q;
}

/** Ce paquet est-il importé par le fichier ? `express` couvre `express/lib/router`. */
function importsAny(imports: Map<string, { raw: string }>, mods: string[]): boolean {
  for (const b of imports.values()) if (mods.includes(packageName(b.raw) ?? b.raw)) return true;
  return false;
}

export function packApplies(pack: Pack, file: FileInput, imports?: Map<string, { raw: string }>): boolean {
  if (pack.files) return pack.files.some((g) => minimatch(file.path, g, { dot: true, matchBase: !g.includes("/") }));
  if (!pack.languages || !file.language || !pack.languages.includes(file.language)) return false;
  return !pack.imports || (imports !== undefined && importsAny(imports, pack.imports));
}

export function runPack(pack: Pack, ctx: ScriptContext): FileFact[] {
  const out: FileFact[] = [];
  const { root, imports, file } = ctx;
  if (root && imports && file.language) {
    for (const m of pack.matches) {
      for (const match of compiled(m.query, file.language).matches(root)) {
        const caps = new Map<string, Node>();
        for (const c of match.captures) if (!caps.has(c.name)) caps.set(c.name, c.node);
        if (!Object.entries(m.where).every(([name, w]) => satisfies(caps.get(name), w, imports))) continue;
        const at = m.at ? caps.get(m.at) : undefined;
        const line = at ? at.startPosition.row + 1 : Math.min(...[...caps.values()].map((n) => n.startPosition.row + 1));
        for (const e of m.emit) {
          const args = e.args.map((a) => argValue(a, caps, file, line, imports));
          if (args.some((a) => a === undefined)) continue;
          const f = ctx.fact(e.rel, args as Value[], line);
          out.push({ ...f, proof: { ...f.proof, source: "pack", pack: pack.id } });
        }
      }
    }
  }
  if (pack.script) for (const f of pack.script(ctx)) out.push(f.proof.source === "pack" ? f : { ...f, proof: { ...f.proof, source: f.proof.source === "manifest" ? "manifest" : "pack", pack: pack.id } });
  return out;
}

type Imports = Map<string, { imported: string; raw: string }>;

function argValue(a: Arg, caps: Map<string, Node>, file: FileInput, line: number, imports: Imports): Value | undefined {
  switch (a.kind) {
    case "const": return a.value;
    case "file": return file.path;
    case "line": return line;
    case "capture": { const n = caps.get(a.name); return n ? modValue(n, a.mod, imports) : undefined; }
    case "template": {
      let s = "";
      for (const p of a.parts) {
        if ("text" in p) { s += p.text; continue; }
        const n = caps.get(p.name);
        if (!n) return undefined;
        const v = modValue(n, p.mod, imports);
        if (v === undefined) return undefined;
        s += String(v);
      }
      return s;
    }
  }
}

/**
 * Valeur d'une capture. `text` : la valeur d'une chaîne littérale, sinon le
 * code ; `pkg` : le paquet d'où vient un identifiant importé (sinon, pas de fait).
 */
function modValue(n: Node, mod: Mod, imports: Imports): Value | undefined {
  switch (mod) {
    case "pkg": { const b = imports.get(n.text); return b && !/^[./]/.test(b.raw) ? packageName(b.raw) : undefined; }
    case "raw": return n.text;
    case "upper": return text(n).toUpperCase();
    case "lower": return text(n).toLowerCase();
    case "line": return target(n).startPosition.row + 1;
    case "symbol": { const t = target(n); return t.type === "identifier" || t.type === "member_expression" ? t.text : ""; }
    default: return text(n);
  }
}

function text(n: Node): string { return literal(n) ?? n.text; }

/**
 * Ce qu'une enveloppe appelle vraiment : `route(signup)` → `signup`,
 * `asyncHandler(async (req) => …)` → la fonction. On descend dans le dernier
 * argument tant que c'est un appel.
 */
function target(n: Node): Node {
  let cur = unwrap(n) ?? n;
  for (let i = 0; i < 5 && cur.type === "call_expression"; i++) {
    const last = cur.childForFieldName("arguments")?.namedChildren.at(-1);
    if (!last) break;
    cur = unwrap(last) ?? last;
  }
  return cur;
}

function satisfies(n: Node | undefined, w: z.infer<typeof Where>, imports: Map<string, { imported: string; raw: string }>): boolean {
  if (!n) return false;
  const v = text(n);
  if (Array.isArray(w)) return w.includes(v);
  if ("any" in w) return w.any.includes(v);
  if ("not" in w) return !w.not.includes(v);
  if ("match" in w) return new RegExp(w.match).test(v);
  const mods = (x: string | string[]) => (Array.isArray(x) ? x : [x]);
  const fromPkg = (name: string, list: string[]) => {
    const b = imports.get(name);
    return b !== undefined && list.includes(packageName(b.raw) ?? b.raw);
  };
  if ("import_of" in w) return n.type === "identifier" && fromPkg(n.text, mods(w.import_of));
  // bound_to : `const app = express()`, `const r = express.Router()`, `const r = Router()`, `new Queue(…)`.
  if (n.type !== "identifier") return false;
  if (fromPkg(n.text, mods(w.bound_to))) return false;
  let init = unwrap(resolveIdentifier(n));
  if (init?.type === "new_expression") init = init.childForFieldName("constructor") ?? undefined;
  else if (init?.type === "call_expression") init = init.childForFieldName("function") ?? undefined;
  else return false;
  while (init?.type === "member_expression") init = init.childForFieldName("object") ?? undefined;
  return init?.type === "identifier" && fromPkg(init.text, mods(w.bound_to));
}

export { importBindings };
