import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, resolveIdentifier, topLevelFunctions, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";

/**
 * fetch et axios, d'après l'inventaire (docs/fonctionnement/packs/http-client.md).
 *
 * http_call(Fichier, Méthode, Chemin, Ligne)         fetch("/x", { method }), axios.post("/x"), axios({ url, method })
 * http_unread(Fichier, Ligne)                        fetch(url) : un appel dont l'adresse n'est pas écrite
 * axios_inst(Fichier, Variable, CheminDeBase)        const api = axios.create({ baseURL: "/api" })
 * http_member(Fichier, Objet, Méthode, Chemin, Ligne)  api.post("/x") : un appel si api est une instance
 * Enveloppes, pour les règles :
 * http_wrapper_url(F, Fonction, I)       son paramètre I va dans l'adresse d'un appel direct
 * http_wrapper_fixed(F, Fonction, M)     la méthode de cet appel est écrite (POST)
 * http_wrapper_method(F, Fonction, K)    la méthode vient de son paramètre K
 * fn_passes(F, Fonction, I, Appelée, J)  elle passe son paramètre I en argument J d'une autre fonction
 * fn_passes_member(F, Fonction, I, Objet, M)  … ou à objet.verbe() (une instance d'axios ?)
 * fn_passes_method(F, Fonction, Appelée, M)   … avec des options dont la méthode est écrite
 * http_arg(F, Fonction, J, Chemin, L), http_arg_verb(F, Fonction, J, M, L), http_opt(F, Fonction, M, L)
 *                                        ce qu'un appel passe à une fonction : un chemin, un verbe, des options
 *
 * Un morceau calculé du chemin devient `:param` ; une base devant le chemin est retirée ; la requête et l'ancre aussi.
 */
const VERBS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const HTTP_VERB = /^(get|post|put|patch|delete|head|options)$/i;

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const isAxios = (n: Node | undefined) => {
    const b = n?.type === "identifier" ? imports.get(n.text) : undefined;
    return b !== undefined && packageName(b.raw) === "axios" && (b.imported === "default" || b.imported === "*");
  };
  const isFetch = (f: Node | undefined) => f?.type === "identifier" ? f.text === "fetch"
    : f?.type === "member_expression" && f.childForFieldName("property")?.text === "fetch" && /^(globalThis|window|self)$/.test(f.childForFieldName("object")?.text ?? "");

  /** Un appel direct : son adresse, et sa méthode si elle est écrite ou vient d'une variable d'options. */
  const direct = (n: Node): { url?: Node; method?: string; methodNode?: Node } | undefined => {
    const f = unwrap(n.childForFieldName("function"));
    const a = args(n);
    if (isFetch(f)) {
      const first = unwrap(a[0]);
      if (first?.type === "new_expression" && first.childForFieldName("constructor")?.text === "Request") {
        const ra = args(first);
        return { url: ra[0], ...methodIn(ra[1]) };
      }
      return { url: a[0], ...methodIn(a[1]) };
    }
    if (isAxios(f)) return unwrap(a[0])?.type === "object" ? config(a[0]) : { url: a[0], ...methodIn(a[1]) };
    if (f?.type === "member_expression" && isAxios(unwrap(f.childForFieldName("object")))) {
      const p = f.childForFieldName("property")?.text ?? "";
      if (VERBS.has(p)) return { url: a[0], method: p.toUpperCase() };
      if (p === "request") return config(a[0]);
    }
    return undefined;
  };

  // Les instances d'axios de premier niveau.
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (decl?.type !== "lexical_declaration" && decl?.type !== "variable_declaration") continue;
    for (const d of decl.namedChildren) {
      const v = unwrap(d.childForFieldName("value"));
      const f = v?.type === "call_expression" ? unwrap(v.childForFieldName("function")) : undefined;
      if (f?.type !== "member_expression" || f.childForFieldName("property")?.text !== "create" || !isAxios(unwrap(f.childForFieldName("object")))) continue;
      const base = literal(pair(args(v!)[0], "baseURL"));
      const pre = base ? (base.replace(/^[a-z]+:\/\/[^/]*/i, "").replace(/\/+$/, "")) : "";
      const name = d.childForFieldName("name")?.text;
      if (name) out.push(fact("axios_inst", [file.path, name, pre.startsWith("/") ? pre : ""], line(d)));
    }
  }

  // Les enveloppes : ce que chaque fonction de premier niveau fait de ses paramètres. Leur appel est lu là où elles sont appelées.
  const wrapped = new Set<number>();
  for (const [name, decl] of topLevelFunctions(root)) {
    const fn = decl.type === "variable_declarator" ? unwrap(decl.childForFieldName("value")) : decl;
    const params = (fn?.childForFieldName("parameters")?.namedChildren ?? []).map((p) => (p.childForFieldName("pattern") ?? p).text);
    if (!fn || !params.length) continue;
    const idx = (n: Node | undefined) => params.findIndex((p) => /^[A-Za-z_$][\w$]*$/.test(p) && mentions(n, p));
    const seen = new Set<string>();
    const emit = (rel: string, a: (string | number)[]) => { const k = `${rel}${a.join("\0")}`; if (!seen.has(k)) { seen.add(k); out.push(fact(rel, [file.path, name, ...a], line(decl))); } };
    walkAll(fn, (n) => {
      if (n.type !== "call_expression") return;
      const d = direct(n);
      if (d) {
        const i = idx(d.url);
        if (i < 0) return;
        wrapped.add(n.startIndex);
        emit("http_wrapper_url", [i]);
        if (d.method) emit("http_wrapper_fixed", [d.method]);
        else if (d.methodNode) { const k = idx(d.methodNode); if (k >= 0) emit("http_wrapper_method", [k]); }
        return;
      }
      const f = unwrap(n.childForFieldName("function"));
      const a = args(n);
      if (f?.type === "identifier") {
        a.forEach((x, j) => { const i = idx(x); if (i >= 0 && unwrap(x)?.type !== "object") emit("fn_passes", [i, f.text, j]); });
        for (const x of a) { const m = methodIn(x).method; if (m) emit("fn_passes_method", [f.text, m]); }
      } else if (f?.type === "member_expression") {
        const o = unwrap(f.childForFieldName("object")), p = f.childForFieldName("property")?.text ?? "";
        const i = idx(a[0]);
        if (o?.type === "identifier" && VERBS.has(p) && i >= 0) emit("fn_passes_member", [i, o.text, p.toUpperCase()]);
      }
    });
  }

  // Les appels.
  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    const d = direct(n);
    if (d) {
      const path = pathOf(d.url);
      if (path) out.push(fact("http_call", [file.path, d.method ?? "GET", path, line(n)], line(n)));
      // Une adresse qu'on ne sait pas lire : ni un chemin, ni une adresse complète écrite.
      else if (!wrapped.has(n.startIndex) && !/^\s*[`'"]?[a-z][a-z0-9+.-]*:/i.test(urlNode(d.url)?.text ?? "")) out.push(fact("http_unread", [file.path, line(n)], line(n)));
      return;
    }
    const f = unwrap(n.childForFieldName("function"));
    const a = args(n);
    if (f?.type === "member_expression") {
      const o = unwrap(f.childForFieldName("object")), p = f.childForFieldName("property")?.text ?? "";
      if (o?.type !== "identifier") return;
      if (VERBS.has(p)) { const path = pathOf(a[0]); if (path) out.push(fact("http_member", [file.path, o.text, p.toUpperCase(), path, line(n)], line(n))); }
      else if (p === "request") { const c = config(a[0]); const path = pathOf(c.url); if (path) out.push(fact("http_member", [file.path, o.text, c.method ?? "GET", path, line(n)], line(n))); }
      return;
    }
    if (f?.type !== "identifier") return;
    a.forEach((x, j) => {
      const path = pathOf(x);
      if (path) out.push(fact("http_arg", [file.path, f.text, j, path, line(n)], line(n)));
      const v = literal(unwrap(x));
      if (v && HTTP_VERB.test(v)) out.push(fact("http_arg_verb", [file.path, f.text, j, v.toUpperCase(), line(n)], line(n)));
      const m = methodIn(x).method;
      if (m) out.push(fact("http_opt", [file.path, f.text, m, line(n)], line(n)));
    });
  });
  return out;
};

/** La méthode d'un objet d'options, écrit sur place ou dans une variable : écrite, ou un nœud (paramètre). */
function methodIn(n: Node | undefined): { method?: string; methodNode?: Node } {
  let o = unwrap(n);
  if (o?.type === "identifier") o = unwrap(resolveIdentifier(o));
  if (o?.type !== "object") return {};
  for (const p of o.namedChildren) {
    if (p.type === "shorthand_property_identifier" && p.text === "method") return { methodNode: p };
    if (p.type !== "pair" || p.childForFieldName("key")?.text.replace(/['"]/g, "") !== "method") continue;
    const v = p.childForFieldName("value") ?? undefined;
    const lit = literal(v);
    return lit ? { method: lit.toUpperCase() } : { methodNode: v };
  }
  return {};
}

/** axios({ url, method }) */
function config(n: Node | undefined): { url?: Node; method?: string; methodNode?: Node } {
  return { url: pair(n, "url"), ...methodIn(n) };
}

function pair(n: Node | undefined, key: string): Node | undefined {
  const o = unwrap(n);
  if (o?.type !== "object") return undefined;
  for (const p of o.namedChildren) if (p.type === "pair" && p.childForFieldName("key")?.text.replace(/['"]/g, "") === key) return p.childForFieldName("value") ?? undefined;
  return undefined;
}

function mentions(n: Node | undefined, name: string): boolean {
  if (!n) return false;
  let hit = (n.type === "identifier" || n.type === "shorthand_property_identifier") && n.text === name;
  walkAll(n, (c) => { if ((c.type === "identifier" || c.type === "shorthand_property_identifier") && c.text === name) hit = true; });
  return hit;
}

/** L'adresse elle-même, ou la valeur de la constante qui la garde (`const GEN_URL = \`${BACKEND}/generate\``). */
function urlNode(n: Node | undefined): Node | undefined {
  const u = unwrap(n);
  if (u?.type !== "identifier") return u;
  const v = unwrap(resolveIdentifier(u));
  return v && v.type !== "identifier" ? v : u;
}

/**
 * `"/payments"`, `` `/bookings/${id}` `` → `/bookings/:param` ; `` `${API}/x` ``, `API + "/x"`, `new URL("/x", base)` → `/x`.
 * La requête et l'ancre sont retirées. Rien si ce n'est pas un chemin (une adresse complète, un nom calculé).
 */
function pathOf(n: Node | undefined): string | undefined {
  const u = urlNode(n);
  if (!u) return undefined;
  if (u.type === "new_expression" && u.childForFieldName("constructor")?.text === "URL") return pathOf(args(u)[0]);
  const parts: ({ text: string } | { calc: true })[] = [];
  const flat = (x: Node | undefined): void => {
    const y = unwrap(x);
    if (!y) return;
    const lit = literal(y);
    if (lit !== undefined) { parts.push({ text: lit }); return; }
    if (y.type === "template_string") {
      for (const c of y.children) {
        if (c.type === "template_substitution") parts.push({ calc: true });
        else if (c.type === "string_fragment") parts.push({ text: c.text });
      }
      return;
    }
    if (y.type === "binary_expression" && y.childForFieldName("operator")?.text === "+") { flat(y.childForFieldName("left") ?? undefined); flat(y.childForFieldName("right") ?? undefined); return; }
    parts.push({ calc: true });
  };
  flat(u);
  // Une base calculée devant un morceau qui commence par « / » : retirée.
  if ("calc" in (parts[0] ?? {}) && parts[1] && "text" in parts[1] && parts[1].text.startsWith("/")) parts.shift();
  const s = parts.map((p) => ("text" in p ? p.text : ":param")).join("").split(/[?#]/)[0]!;
  return s.startsWith("/") ? s : undefined;
}

export default script;
