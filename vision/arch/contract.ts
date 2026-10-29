import type { SystemModel } from "../model/types.js";
import { findCallSites } from "../model/callers.js";
import type { ArchAnalyzer } from "./analyze.js";
import { enclosingTopLevel, walkAll, type Node } from "./ast.js";
import type { Evidence } from "./types.js";

/**
 * Le contrat d'un module à adaptateurs (maquette 27, Couche IA) : l'interface
 * que plusieurs classes implémentent, l'opération qu'elle promet et ses
 * champs commentés, chaque implémentation et l'API native qu'elle appelle, la
 * fabrique qui choisit, la boucle qui appelle le contrat, et la vie d'un appel
 * de la feature au fournisseur. Tout est lu dans le code, ligne à l'appui ;
 * rien n'est deviné. Calculé à la demande, jamais écrit.
 */

export interface ContractField {
  name: string;
  type: string;
  optional: boolean;
  comment?: string;
  line: number;
}

export interface ContractShape {
  name: string;
  path: string;
  line: number;
  fields: ContractField[];
}

export interface ContractImpl {
  name: string;
  path: string;
  line: number;
  /** Ligne de l'opération dans cette classe. */
  opLine?: number;
  /** Appels vers l'API native faits par l'opération (et les méthodes de la classe qu'elle appelle). */
  calls: { text: string; line: number; path: string }[];
  /** Où la réponse native redevient le résultat neutre. */
  returns?: Evidence;
}

export interface LifeStep {
  title: string;
  /** Code de la ligne, ou résumé extrait du code. */
  code?: string;
  /** Le commentaire du développeur au-dessus de la ligne (ou dans la branche), s'il existe. */
  comment?: string;
  /** Ce que la ligne implique, lu dans le code (pas un commentaire) : « lit AI_PROVIDER_<SURFACE>, sinon AI_PROVIDER ». */
  note?: string;
  from: Lane;
  to: Lane;
  back?: boolean;
  ev: Evidence;
}

export type Lane = "feature" | "engine" | "impl" | "native" | "tools";

export interface ModuleContract {
  dir: string;
  summary?: { text: string; path: string; line: number };
  /** Paquets de fournisseur importés dans le module ; ceux qui sont aussi importés ailleurs (fuites). */
  sealed: { packages: string[]; leaks: Evidence[] };
  contract: { name: string; path: string; line: number; methods: { name: string; signature: string; comment?: string; line: number }[] };
  op?: { name: string; line: number; request?: ContractShape; result?: ContractShape };
  impls: ContractImpl[];
  factory?: { name: string; path: string; line: number; surfaces: string[]; env: { name: string; pattern?: string; path: string; line: number }[] };
  engine?: { name: string; path: string; line: number };
  lanes: Record<Lane, { name: string; sub?: string }>;
  steps: LifeStep[];
}

const PLAIN = new Set(["push", "map", "filter", "join", "slice", "forEach", "then", "catch", "trim", "includes", "find", "some", "every", "reduce", "concat", "split", "replace", "toString", "set", "get", "has", "add", "delete", "keys", "values", "entries", "log", "warn", "error", "stringify", "parse", "min", "max", "floor", "round", "now", "toLowerCase", "toUpperCase", "startsWith", "endsWith", "indexOf", "sort", "flatMap", "assign", "from", "isArray", "resolve", "reject", "all", "json", "text", "abort", "unshift", "pop", "shift", "fill", "test", "match", "exec", "call", "apply", "bind"]);

const lineOf = (n: Node) => n.startPosition.row + 1;
const unexport = (n: Node) => (n.type === "export_statement" ? n.namedChildren.find((c) => c.type !== "comment" && c.type !== "decorator") ?? n : n);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Le commentaire juste au-dessus d'un nœud (JSDoc ou lignes //), sans les filets décoratifs. */
function commentAbove(n: Node): string | undefined {
  const parts: string[] = [];
  let p = n.previousNamedSibling;
  let row = n.startPosition.row;
  while (p && p.type === "comment" && row - p.endPosition.row <= 1) {
    parts.unshift(p.text);
    row = p.startPosition.row;
    p = p.previousNamedSibling;
  }
  if (!parts.length) return undefined;
  const text = parts
    .join("\n")
    .replace(/^\s*\/\*\*?|\*\/\s*$/gm, "")
    .split("\n")
    .map((l) => l.replace(/^\s*(\*|\/\/)\s?/, "").trim())
    .filter((l) => l && !/^[-=*#\s]+$/.test(l))
    .join(" ");
  return clean(text) || undefined;
}

/** Le commentaire en fin de ligne (`champ: T; // …`). */
function trailingComment(n: Node): string | undefined {
  const next = n.nextNamedSibling;
  if (next?.type === "comment" && next.startPosition.row === n.endPosition.row) return clean(next.text.replace(/^\/\/\s?|^\/\*|\*\/$/g, ""));
  return undefined;
}

function fieldsOf(body: Node): ContractField[] {
  return body.namedChildren
    .filter((c) => c.type === "property_signature" || c.type === "method_signature")
    .map((c) => ({
      name: c.childForFieldName("name")?.text ?? c.text,
      type: clean((c.childForFieldName("type")?.text ?? `${c.childForFieldName("parameters")?.text ?? "()"}${c.childForFieldName("return_type")?.text ?? ""}`).replace(/^:\s*/, "")),
      optional: c.children.some((x) => x.type === "?"),
      comment: commentAbove(c) ?? trailingComment(c),
      line: lineOf(c),
    }));
}

interface Decl {
  path: string;
  node: Node;
  kind: "interface" | "type" | "class" | "function";
  name: string;
}

/** Les déclarations de haut niveau des fichiers du module. */
function declarations(an: ArchAnalyzer, files: string[]): Decl[] {
  const out: Decl[] = [];
  for (const path of files) {
    const root = an.treeOf(path);
    if (!root) continue;
    for (const top of root.namedChildren) {
      const n = unexport(top);
      const name = n.childForFieldName("name")?.text;
      if (!name) continue;
      const kind = n.type === "interface_declaration" ? "interface" : n.type === "type_alias_declaration" ? "type" : n.type === "class_declaration" ? "class" : n.type === "function_declaration" ? "function" : undefined;
      if (kind) out.push({ path, node: n, kind, name });
    }
  }
  return out;
}

function implemented(cls: Node): string[] {
  const out: string[] = [];
  walkAll(cls, (c) => {
    if (c.type === "class_body") return false;
    if (c.type === "implements_clause") for (const t of c.namedChildren) out.push(t.type === "generic_type" ? t.namedChildren[0]?.text ?? t.text : t.text);
    return undefined;
  });
  return out;
}

function methodsOf(cls: Node): Map<string, Node> {
  const body = cls.childForFieldName("body");
  const out = new Map<string, Node>();
  for (const m of body?.namedChildren ?? []) if (m.type === "method_definition") out.set(m.childForFieldName("name")?.text ?? "", m);
  return out;
}

/** Type sans enveloppe : `Promise<TurnResult>` → `TurnResult`. */
const bare = (t: string) => clean(t.replace(/^:\s*/, "")).replace(/^Promise<(.+)>$/, "$1");

/** Appels natifs d'une méthode : chaînes `a.b.c(` hors `this.méthode(`, et `fetch(url)`. */
function nativeCalls(path: string, method: Node, cls: Node): { text: string; line: number; path: string }[] {
  const own = methodsOf(cls);
  const seen = new Map<string, { text: string; line: number; path: string }>();
  const visit = (fn: Node, depth: number) => {
    walkAll(fn, (c) => {
      if (c.type !== "call_expression") return undefined;
      const f = c.childForFieldName("function");
      if (!f) return undefined;
      if (f.type === "identifier" && f.text === "fetch") {
        const arg = c.childForFieldName("arguments")?.namedChildren[0]?.text ?? "";
        const route = arg.match(/\/[\w/.-]+(?=[`'"])/)?.[0];
        const k = `fetch ${route ?? ""}`.trim();
        if (!seen.has(k)) seen.set(k, { text: route ? `POST ${route}` : "fetch", line: lineOf(c), path });
        return undefined;
      }
      if (f.type !== "member_expression") return undefined;
      const prop = f.childForFieldName("property")?.text ?? "";
      const obj = f.childForFieldName("object");
      if (obj?.type === "this") {
        const m = own.get(prop);
        if (m && depth < 2 && m !== method) visit(m, depth + 1);
        return undefined;
      }
      // un client gardé par la classe : `this.client.messages.create(`
      const chain = f.text.replace(/\s+/g, "");
      if (PLAIN.has(prop) || !chain.startsWith("this.") || chain.split(".").length < 4) return undefined;
      const segs = chain.split(".");
      const k = segs.slice(-2).join(".");
      if (k && !seen.has(k)) seen.set(k, { text: k, line: lineOf(c), path });
      return undefined;
    });
  };
  visit(method, 0);
  return [...seen.values()].slice(0, 4);
}

/** Dernier `return` d'une méthode (la réponse remise au contrat). */
function lastReturn(path: string, fn: Node, source: string): Evidence | undefined {
  let last: Node | undefined;
  walkAll(fn, (c) => {
    if (c.type === "arrow_function" || c.type === "function_expression") return false;
    if (c.type === "return_statement") last = c;
    return undefined;
  });
  if (!last) return undefined;
  const line = lineOf(last);
  // un objet renvoyé se lit par ses clés : « renvoie { text, content, sources… } »
  const obj = last.namedChildren[0];
  if (obj?.type === "object") {
    const keys = obj.namedChildren.map((k) => k.childForFieldName("key")?.text ?? (k.type === "shorthand_property_identifier" ? k.text : undefined)).filter(Boolean);
    if (keys.length) return { path, line, text: `return { ${keys.join(", ")} }` };
  }
  return { path, line, text: (source.split("\n")[line - 1] ?? "").trim() };
}

/** Les commentaires `//` juste au-dessus d'une ligne du source. */
function lineComment(source: string, line: number): string | undefined {
  const all = source.split("\n");
  const out: string[] = [];
  for (let i = line - 2; i >= 0 && /^\s*\/\//.test(all[i] ?? ""); i--) out.unshift((all[i] ?? "").replace(/^\s*\/\/\s?/, ""));
  return clean(out.join(" ")) || undefined;
}

/** `entries` : noms des points d'entrée du système ; la feature montrée en exemple est l'un d'eux si possible. */
export function buildModuleContract(root: string, model: SystemModel, an: ArchAnalyzer, dir: string, entries: string[] = []): ModuleContract | undefined {
  void root;
  const inDir = (p: string) => p.startsWith(`${dir}/`);
  const files = an.files().filter(inDir);
  const decls = declarations(an, files);
  const byName = new Map(decls.map((d) => [d.name, d]));

  // le contrat : l'interface implémentée par le plus de classes du module (au moins deux)
  const impls = new Map<string, Decl[]>();
  for (const d of decls) if (d.kind === "class") for (const i of implemented(d.node)) impls.set(i, [...(impls.get(i) ?? []), d]);
  const [cName, cImpls] = [...impls].filter(([n, xs]) => xs.length >= 2 && byName.get(n)?.kind === "interface").sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  const c = cName ? byName.get(cName) : undefined;
  if (!c || !cImpls) return undefined;
  const cBody = c.node.childForFieldName("body");
  const methods = (cBody?.namedChildren ?? [])
    .filter((m) => m.type === "method_signature" || m.type === "property_signature")
    .map((m) => ({ name: m.childForFieldName("name")?.text ?? "", signature: clean(m.text.replace(/;$/, "")), comment: commentAbove(m), line: lineOf(m) }));

  // l'opération : la méthode dont la requête et le résultat sont des types du module
  const shape = (name: string): ContractShape | undefined => {
    const d = byName.get(name);
    const body = d?.kind === "interface" ? d.node.childForFieldName("body") : d?.kind === "type" ? d.node.childForFieldName("value") : undefined;
    if (!d || !body || (body.type !== "object_type" && body.type !== "interface_body")) return undefined;
    return { name, path: d.path, line: lineOf(d.node), fields: fieldsOf(body) };
  };
  let op: ModuleContract["op"];
  for (const m of cBody?.namedChildren ?? []) {
    if (m.type !== "method_signature") continue;
    const params = m.childForFieldName("parameters")?.namedChildren ?? [];
    const pType = params.map((p) => bare(p.childForFieldName("type")?.text ?? "")).find((t) => shape(t));
    const rType = bare(m.childForFieldName("return_type")?.text ?? "");
    const request = pType ? shape(pType) : undefined;
    const result = shape(rType);
    const score = (request?.fields.length ?? 0) + (result?.fields.length ?? 0);
    if (score && score > ((op?.request?.fields.length ?? 0) + (op?.result?.fields.length ?? 0))) op = { name: m.childForFieldName("name")?.text ?? "", line: lineOf(m), request, result };
  }

  const implFacts: ContractImpl[] = cImpls.map((d) => {
    const m = op ? methodsOf(d.node).get(op.name) : undefined;
    const source = an.sourceOf(d.path) ?? "";
    return {
      name: d.name,
      path: d.path,
      line: lineOf(d.node),
      opLine: m ? lineOf(m) : undefined,
      calls: m ? nativeCalls(d.path, m, d.node) : [],
      returns: m ? lastReturn(d.path, m, source) : undefined,
    };
  });

  // la fabrique : la fonction du module qui renvoie le contrat
  const fDecl = decls.find((d) => d.kind === "function" && bare(d.node.childForFieldName("return_type")?.text ?? "") === c.name);
  let factory: ModuleContract["factory"];
  if (fDecl) {
    const surfaces: string[] = [];
    for (const p of fDecl.node.childForFieldName("parameters")?.namedChildren ?? []) {
      const t = byName.get(bare(p.childForFieldName("type")?.text ?? ""));
      const v = t?.kind === "type" ? t.node.childForFieldName("value") : undefined;
      if (v?.type === "union_type") walkAll(v, (x) => { if (x.type === "string_fragment") surfaces.push(x.text); });
    }
    // variables d'environnement lues dans le module : `process.env.X`, et `process.env[`${base}_${…}`]` appelée avec une base littérale
    const env: NonNullable<ModuleContract["factory"]>["env"] = [];
    for (const path of files) {
      const r = an.treeOf(path);
      const src = an.sourceOf(path) ?? "";
      if (!r) continue;
      const scoped = new Set<string>();
      walkAll(r, (x) => {
        if (x.type === "member_expression" && x.childForFieldName("object")?.text === "process.env") {
          const name = x.childForFieldName("property")?.text;
          if (name && !env.some((e) => e.name === name)) env.push({ name, path, line: lineOf(x) });
        }
        if (x.type === "subscript_expression" && x.childForFieldName("object")?.text === "process.env" && /^`\$\{(\w+)\}_\$\{/.test(x.childForFieldName("index")?.text ?? "")) {
          const fn = enclosingTopLevel(r, x.startPosition.row);
          if (fn) scoped.add(fn);
        }
        return undefined;
      });
      if (!scoped.size) continue;
      walkAll(r, (x) => {
        if (x.type !== "call_expression" || !scoped.has(x.childForFieldName("function")?.text ?? "")) return undefined;
        const base = x.childForFieldName("arguments")?.namedChildren[0];
        const name = base?.type === "string" ? base.text.slice(1, -1) : undefined;
        if (name && !env.some((e) => e.name === name)) env.push({ name, pattern: `${name}_<SURFACE>`, path, line: lineOf(x) });
        return undefined;
      });
      void src;
    }
    factory = { name: fDecl.name, path: fDecl.path, line: lineOf(fDecl.node), surfaces, env };
  }

  // la boucle : la fonction exportée du module qui appelle l'opération du contrat
  let engine: ModuleContract["engine"];
  let contractCall: Evidence | undefined;
  const branches: { value: string; ev: Evidence; comment?: string }[] = [];
  let engineReturn: Evidence | undefined;
  if (op) {
    for (const d of decls) {
      if (d.kind !== "function" || d === fDecl) continue;
      let hit: Node | undefined;
      walkAll(d.node, (x) => {
        if (!hit && x.type === "call_expression" && x.childForFieldName("function")?.text.endsWith(`.${op!.name}`)) hit = x;
        return undefined;
      });
      if (!hit) continue;
      const src = an.sourceOf(d.path) ?? "";
      engine = { name: d.name, path: d.path, line: lineOf(d.node) };
      contractCall = { path: d.path, line: lineOf(hit), text: (src.split("\n")[lineOf(hit) - 1] ?? "").trim() };
      walkAll(d.node, (x) => {
        if (x.type !== "if_statement") return undefined;
        const cond = x.childForFieldName("condition")?.text ?? "";
        const v = cond.match(/stopReason\s*===\s*['"](\w+)['"]/)?.[1];
        if (v && !branches.some((b) => b.value === v)) {
          const line = lineOf(x);
          const block = x.childForFieldName("consequence");
          // le premier commentaire écrit dans la branche (une ou plusieurs lignes qui se suivent)
          let inner: string | undefined;
          if (block) {
            const cs: Node[] = [];
            walkAll(block, (y) => {
              if (y.type === "if_statement" && y !== x) return false;
              if (y.type === "comment" && (!cs.length || y.startPosition.row === cs[cs.length - 1]!.endPosition.row + 1)) cs.push(y);
              return undefined;
            });
            inner = cs.length ? clean(cs.map((y) => y.text.replace(/^\/\/\s?|^\/\*+|\*\/$/g, "")).join(" ")) : undefined;
          }
          branches.push({ value: v, ev: { path: d.path, line, text: clean(cond.replace(/^\(|\)$/g, "")) }, comment: lineComment(src, line) ?? inner });
        }
        return undefined;
      });
      engineReturn = lastReturn(d.path, d.node, src);
      break;
    }
  }

  // la feature : un appel de la boucle hors du module, dans un fichier qui appelle aussi la fabrique
  const sym = (name: string, path: string) => model.files.find((f) => f.path === path)?.symbols.find((s) => s.name === name);
  const read = (p: string) => an.sourceOf(p);
  const engineSites = engine ? (sym(engine.name, engine.path) ? findCallSites(model, sym(engine.name, engine.path)!, read).filter((s) => !inDir(s.path)) : []) : [];
  const factorySites = factory && sym(factory.name, factory.path) ? findCallSites(model, sym(factory.name, factory.path)!, read).filter((s) => !inDir(s.path)) : [];
  const nameAt = (s: { path: string; line: number }) => {
    const r = an.treeOf(s.path);
    return r ? enclosingTopLevel(r, s.line - 1) : undefined;
  };
  const paired = engineSites.filter((s) => factorySites.some((f) => f.path === s.path));
  const site = paired.find((s) => entries.includes(nameAt(s) ?? "")) ?? paired[0] ?? engineSites[0];
  const fSite = site ? factorySites.filter((f) => f.path === site.path).sort((a, b) => Math.abs(a.line - site.line) - Math.abs(b.line - site.line))[0] : undefined;
  const featureName = site ? nameAt(site) : undefined;

  // la ligne d'en-tête du module : son premier commentaire, dans le fichier d'entrée (index), le premier paragraphe qui dit une règle
  let summary: ModuleContract["summary"];
  const index = files.find((f) => /\/index\.[jt]sx?$/.test(f) && f.split("/").length === dir.split("/").length + 1);
  const idxRoot = index ? an.treeOf(index) : undefined;
  const first = idxRoot?.namedChildren[0];
  if (index && first?.type === "comment") {
    const lines = first.text.split("\n");
    const paras: { text: string; line: number }[] = [];
    let cur: { text: string; line: number } | undefined;
    lines.forEach((l, i) => {
      const t = l.replace(/^\s*(\/\*\*?|\*\/|\*)\s?/, "").replace(/\*\/\s*$/, "").trim();
      if (!t) {
        if (cur) paras.push(cur);
        cur = undefined;
      } else cur = cur ? { text: `${cur.text} ${t}`, line: cur.line } : { text: t, line: lineOf(first) + i };
    });
    if (cur) paras.push(cur);
    const p = paras.find((x) => x.text.length > 80 && /[.!]$/.test(x.text)) ?? paras[0];
    if (p) summary = { text: clean(p.text), path: index, line: p.line };
  }

  // étanchéité : les paquets externes importés par les implémentations (les SDK), et leurs imports hors du module
  const implFiles = new Set(implFacts.map((i) => i.path));
  const pkgs = new Set(model.dependencies.filter((d) => d.external && implFiles.has(d.from) && !d.raw.startsWith("node:") && !d.raw.startsWith(".")).map((d) => d.raw.split("/").slice(0, d.raw.startsWith("@") ? 2 : 1).join("/")));
  const leaks: Evidence[] = [];
  for (const d of model.dependencies) {
    if (!d.external || inDir(d.from)) continue;
    const pkg = d.raw.split("/").slice(0, d.raw.startsWith("@") ? 2 : 1).join("/");
    if (!pkgs.has(pkg)) continue;
    const src = an.sourceOf(d.from) ?? "";
    const i = src.split("\n").findIndex((l) => l.includes(`'${d.raw}'`) || l.includes(`"${d.raw}"`));
    leaks.push({ path: d.from, line: i + 1, text: (src.split("\n")[i] ?? "").trim() });
  }

  const nImpl = implFacts.length;
  const lanes: ModuleContract["lanes"] = {
    feature: { name: featureName ?? "la feature", sub: "une feature" },
    engine: { name: engine?.name ?? "la boucle", sub: engine?.path.split("/").pop() },
    impl: { name: "Adaptateur", sub: factory?.name },
    native: { name: "API native", sub: `${nImpl} fournisseurs` },
    tools: { name: "Outils clients", sub: op?.request?.fields.some((f) => f.name === "tools") ? "tools" : undefined },
  };

  const steps: LifeStep[] = [];
  const srcAt = (e: { path: string; line: number }) => ((an.sourceOf(e.path) ?? "").split("\n")[e.line - 1] ?? "").trim();
  if (fSite && factory) {
    const sel = factory.env.find((e) => e.pattern);
    steps.push({ title: "La feature obtient son adaptateur", code: srcAt(fSite), note: sel ? `lit ${sel.pattern}, sinon ${sel.name}` : undefined, from: "feature", to: "feature", ev: { path: fSite.path, line: fSite.line, text: srcAt(fSite) } });
  }
  if (site && engine) steps.push({ title: `Elle lance ${engine.name} : une requête neutre`, code: srcAt(site), comment: lineComment(an.sourceOf(site.path) ?? "", site.line), from: "feature", to: "engine", ev: { path: site.path, line: site.line, text: srcAt(site) } });
  if (contractCall && op) steps.push({ title: `La boucle appelle le contrat : ${op.name}`, code: contractCall.text, comment: lineComment(an.sourceOf(contractCall.path) ?? "", contractCall.line), from: "engine", to: "impl", ev: contractCall });
  const firstCall = implFacts.flatMap((i) => i.calls)[0];
  if (firstCall) steps.push({ title: "L'adaptateur traduit en requête native", code: [...new Set(implFacts.flatMap((i) => i.calls.slice(0, 1).map((x) => x.text)))].join(" · "), from: "impl", to: "native", ev: { path: firstCall.path, line: firstCall.line, text: srcAt(firstCall) } });
  const ret = implFacts.find((i) => i.returns)?.returns;
  if (ret && op?.result) steps.push({ title: `La réponse native redevient un ${op.result.name} neutre`, code: op.result.fields.slice(0, 3).map((f) => f.name).join(", "), comment: lineComment(an.sourceOf(ret.path) ?? "", ret.line), from: "native", to: "engine", back: true, ev: ret });
  for (const b of branches) {
    const tools = b.value === "tool_use";
    steps.push({ title: tools ? "Un outil demandé : la boucle l'exécute, puis relance un tour" : `${b.value} : la boucle relance un tour`, code: b.ev.text, comment: b.comment, from: "engine", to: tools ? "tools" : "impl", ev: b.ev });
  }
  if (engineReturn) steps.push({ title: `Fin : ${engine?.name ?? "la boucle"} rend son résultat à la feature`, code: engineReturn.text, comment: lineComment(an.sourceOf(engineReturn.path) ?? "", engineReturn.line), from: "engine", to: "feature", back: true, ev: engineReturn });

  return {
    dir,
    summary,
    sealed: { packages: [...pkgs].sort(), leaks },
    contract: { name: c.name, path: c.path, line: lineOf(c.node), methods },
    op,
    impls: implFacts,
    factory,
    engine,
    lanes,
    steps,
  };
}
