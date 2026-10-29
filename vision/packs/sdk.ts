import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";

/**
 * Clients de SDK, d'après l'inventaire (docs/fonctionnement/packs/sdk.md). Le script relève ce que le
 * langage dit ; les règles décident ce qui est un client (external_pkg, sdk_make).
 *
 * made(Fichier, Site, Paquet, Comment, Ligne)    new Stripe(k) → "new" ; Stripe(k), require("stripe")(k) → "default" ;
 *                                                nodemailer.createTransport(…) → "createTransport"
 * site_var(Fichier, Site, Variable)              la variable de premier niveau qui le garde (export default : "default")
 * site_call(Fichier, Site, Chemin, Ligne)        stripe.customers.create(…) sur cette variable, dans ce fichier
 * fn_returns(Fichier, Fonction, Site)            une fonction de premier niveau qui rend ce client
 * fn_call_member(Fichier, Fonction, Chemin, Ligne)  getStripe().customers.list(), const s = getStripe(); s.customers.list()
 */
const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const siteOf = (decl: Node) => `${line(decl)}:${decl.childForFieldName("name")?.text ?? "default"}`;

  /** Ce qu'une expression crée : un paquet et la façon de le créer. */
  const creation = (n: Node | undefined): { pkg: string; how: string } | undefined => {
    const x = unwrap(n);
    if (!x) return undefined;
    if (x.type === "new_expression") {
      const c = x.childForFieldName("constructor");
      const b = c?.type === "identifier" ? imports.get(c.text) : undefined;
      const pkg = b ? packageName(b.raw) : undefined;
      return pkg && !/^[./]/.test(b!.raw) ? { pkg, how: "new" } : undefined;
    }
    if (x.type !== "call_expression") return undefined;
    const fn = unwrap(x.childForFieldName("function"));
    if (fn?.type === "call_expression" && fn.childForFieldName("function")?.text === "require") {
      const raw = literal(args(fn)[0]);
      return raw && !/^[./]/.test(raw) ? { pkg: packageName(raw) ?? raw, how: "default" } : undefined;
    }
    if (fn?.type === "identifier") {
      const b = imports.get(fn.text);
      if (!b || /^[./]/.test(b.raw)) return undefined;
      return { pkg: packageName(b.raw) ?? b.raw, how: b.imported === "*" ? "default" : b.imported };
    }
    if (fn?.type === "member_expression") {
      const o = unwrap(fn.childForFieldName("object"));
      const b = o?.type === "identifier" ? imports.get(o.text) : undefined;
      if (!b || /^[./]/.test(b.raw) || (b.imported !== "*" && b.imported !== "default")) return undefined;
      return { pkg: packageName(b.raw) ?? b.raw, how: fn.childForFieldName("property")?.text ?? "" };
    }
    return undefined;
  };

  // Les clients gardés dans une variable : sa valeur, ou une affectation plus loin (créé au premier appel).
  // Rangés par la position de la déclaration : tree-sitter ne rend pas toujours le même objet pour un même nœud.
  const sites = new Map<number, string>();
  walkAll(root, (n) => {
    if (n.type === "variable_declarator") {
      const c = creation(n.childForFieldName("value") ?? undefined);
      if (c) record(n, c, line(n));
    } else if (n.type === "assignment_expression" || n.type === "augmented_assignment_expression") {
      const left = n.childForFieldName("left");
      const c = creation(n.childForFieldName("right") ?? undefined);
      const d = left?.type === "identifier" ? declaratorOf(left) : undefined;
      if (c && d) record(d, c, line(n));
      else if (c) out.push(fact("made", [file.path, `${line(n)}:`, c.pkg, c.how, line(n)], line(n)));
    } else if (n.type === "public_field_definition" || (n.type === "export_statement" && n.text.startsWith("export default"))) {
      const v = n.type === "export_statement" ? n.namedChildren.at(-1) : n.childForFieldName("value");
      const c = creation(v ?? undefined);
      if (!c) return;
      const site = `${line(n)}:default`;
      out.push(fact("made", [file.path, site, c.pkg, c.how, line(n)], line(n)));
      if (n.type === "export_statement") out.push(fact("site_var", [file.path, site, "default"], line(n)));
    }
  });
  function record(decl: Node, c: { pkg: string; how: string }, at: number) {
    const site = siteOf(decl);
    if (!sites.has(decl.startIndex)) {
      sites.set(decl.startIndex, site);
      if (isTopLevel(decl)) { out.push(fact("site_var", [file.path, site, decl.childForFieldName("name")!.text], at)); }
    }
    out.push(fact("made", [file.path, site, c.pkg, c.how, at], at));
  }

  // Les fonctions de premier niveau qui rendent un client.
  for (const [name, body] of topLevelFns(root)) {
    walkAll(body, (n) => {
      const isBody = n.startIndex === body.startIndex && n.endIndex === body.endIndex;
      if (!isBody && /function|arrow_function|method_definition/.test(n.type)) return false;
      const ret = n.type === "return_statement" ? unwrap(n.namedChildren[0]) : isBody && body.type !== "statement_block" ? unwrap(body) : undefined;
      if (ret?.type !== "identifier") return;
      const d = declaratorOf(ret);
      const site = d ? sites.get(d.startIndex) : undefined;
      if (site) out.push(fact("fn_returns", [file.path, name, site], line(n)));
    });
  }

  // Les appels : sur une variable qui garde un client, ou sur ce que rend une fonction.
  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    let cur = unwrap(n.childForFieldName("function"));
    const parts: string[] = [];
    while (cur?.type === "member_expression") {
      parts.unshift(cur.childForFieldName("property")?.text ?? "");
      cur = unwrap(cur.childForFieldName("object"));
    }
    if (!parts.length || !cur) return;
    if (cur.type === "await_expression") cur = unwrap(cur.namedChildren[0]);
    const path = parts.join(".");
    if (cur?.type === "identifier") {
      const d = declaratorOf(cur);
      const site = d ? sites.get(d.startIndex) : undefined;
      if (site) { out.push(fact("site_call", [file.path, site, path, line(n)], line(n))); return; }
      // const s = getStripe() ; s.customers.list()
      const v = d ? unwrap(d.childForFieldName("value")) : undefined;
      const call = v?.type === "await_expression" ? unwrap(v.namedChildren[0]) : v;
      const f = call?.type === "call_expression" ? unwrap(call.childForFieldName("function")) : undefined;
      if (f?.type === "identifier") out.push(fact("fn_call_member", [file.path, f.text, path, line(n)], line(n)));
    } else if (cur?.type === "call_expression") {
      const f = unwrap(cur.childForFieldName("function"));
      if (f?.type === "identifier" && f.text !== "require") out.push(fact("fn_call_member", [file.path, f.text, path, line(n)], line(n)));
    }
  });
  return out;
};

/** La déclaration d'une variable visible d'un identifiant, avec ou sans valeur. */
function declaratorOf(ident: Node): Node | undefined {
  for (let scope: Node | null = ident.parent; scope; scope = scope.parent) {
    if (scope.type !== "statement_block" && scope.type !== "program") continue;
    for (const stmt of scope.namedChildren) {
      const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
      if (!decl || (decl.type !== "lexical_declaration" && decl.type !== "variable_declaration")) continue;
      for (const d of decl.namedChildren) if (d.type === "variable_declarator" && d.childForFieldName("name")?.text === ident.text) return d;
    }
  }
  return undefined;
}

function isTopLevel(decl: Node): boolean {
  let p = decl.parent?.parent;
  if (p?.type === "export_statement") p = p.parent;
  return p?.type === "program";
}

/** function f() {…}, const f = () => …, const f = function () {…} : le corps de chaque fonction de premier niveau. */
function topLevelFns(root: Node): Map<string, Node> {
  const out = new Map<string, Node>();
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (!decl) continue;
    if (decl.type === "function_declaration") {
      const name = decl.childForFieldName("name")?.text, body = decl.childForFieldName("body");
      if (name && body) out.set(name, body);
    } else if (decl.type === "lexical_declaration" || decl.type === "variable_declaration") {
      for (const d of decl.namedChildren) {
        const v = unwrap(d.childForFieldName("value"));
        const name = d.childForFieldName("name")?.text, body = v?.childForFieldName("body");
        if (name && body && (v?.type === "arrow_function" || v?.type === "function_expression" || v?.type === "function")) out.set(name, body);
      }
    }
  }
  return out;
}
export default script;
