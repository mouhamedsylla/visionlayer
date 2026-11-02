import type { Value } from "./datalog.js";
import { functionsAndMethods, isFunction, literal, statementBindings, walkAll, type Node } from "../arch/ast.js";
import type { FileFact } from "./types.js";

/**
 * Lecteur générique d'un fichier JS/TS : ce que dit la syntaxe seule, sans
 * rien savoir d'un framework. Les packs ajoutent le sens.
 *
 *   import_raw(Fichier, Local, Spécificateur, Importé)   import { a as b } from "./x" ; aussi les ré-exports :
 *                                                         export { a as b } from "./x", export * from "./x" (Local "*") ;
 *                                                         import "./x" et import("./x") (Local "") ; const x = require("./x") (Importé "*")
 *   defines(Fichier, Nom, Ligne)                          function f / const f = … / class C
 *   const_str(Fichier, Nom, Valeur)                       const EMAIL_QUEUE = "emails" (premier niveau, texte littéral)
 *   export_fn(Fichier, Nom, Ligne)                        export function f, export const f = () => …, function f … export { f }
 *   used_here(Fichier, Nom)                               une fonction exportée que son propre fichier emploie aussi
 *   fn_span(Fichier, Nom, Début, Fin)                     les lignes d'une fonction de premier niveau
 *   test_file(Fichier)                                    x.test.ts, x.spec.ts, __tests__/, tests/
 *   config_file(Fichier)                                  vite.config.ts, eslint.config.js
 *   top_dir(Fichier, Dossier)                             src/import/csv.ts → src
 *   env(Fichier, Nom)                                     process.env.NOM, import.meta.env.NOM
 *   member_call(Fichier, Racine, Chemin, Ligne)           emailQueue.add(…) → ("emailQueue", "add") ;
 *                                                         stripe.paymentIntents.create(…) → ("stripe", "paymentIntents.create")
 *   member_upper(Fichier, Racine, NOM, Ligne)             env.EMAIL_PROVIDER : un nom en MAJUSCULES lu sur un objet
 *   env_required(Fichier, NOM, "no")                      process.env.LOG_LEVEL ?? "info" : lue avec une valeur de repli
 *   interface_def(Fichier, Nom, Ligne)                    interface EmailSender { … }
 *   interface_member(Fichier, Interface, Membre, Ligne)   send(message): Promise<…>
 *   implements(Fichier, Classe, Interface, Ligne)         class ResendSender implements EmailSender
 *   instantiates(Fichier, Fonction, Classe, Ligne)        new SmtpSender(…) dans la fonction getSender
 *   section(Fichier, Titre, Ligne)                        // ── Paiements ──── : un commentaire de séparation au premier niveau
 */
/** Le titre d'un commentaire de séparation : `// ── Paiements ──`, `/* ==== Comptes ==== *\/`, `// --- Catalogue`. */
const SEPARATOR = /^(?:\/\/+|\/\*+)\s*[─━═=\-~#*]{2,}\s*([^─━═=~#*\n]*?[\p{L}][^─━═=~#*\n]*?)\s*[─━═=\-~#*]*\s*(?:\*+\/)?$/u;
export function sectionTitle(comment: string): string | undefined {
  return SEPARATOR.exec(comment.trim())?.[1]?.trim() || undefined;
}

const VITE_BUILTINS = new Set(["MODE", "DEV", "PROD", "SSR", "BASE_URL"]);

export function syntaxFacts(path: string, root: Node, fact: (rel: string, args: Value[], line: number) => FileFact): FileFact[] {
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;

  for (const node of root.namedChildren) {
    for (const [local, b] of statementBindings(node)) out.push(fact("import_raw", [path, local, b.raw, b.imported], line(node)));
    for (const [local, b] of reexports(node)) out.push(fact("import_raw", [path, local, b.raw, b.imported], line(node)));
    // import "./x" : aucun nom, mais le fichier en dépend.
    if (node.type === "import_statement" && !node.namedChildren.some((c) => c.type === "import_clause")) {
      const raw = literal(node.childForFieldName("source") ?? undefined);
      if (raw) out.push(fact("import_raw", [path, "", raw, ""], line(node)));
    }
  }
  // require("./x") et import("./x"), où qu'ils soient : le nom lié s'il y en a un.
  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "import" && fn?.text !== "require") return;
    const arg = n.childForFieldName("arguments")?.namedChildren[0];
    const raw = arg ? literal(arg) : undefined;
    if (!raw) return;
    const decl = n.parent?.type === "variable_declarator" ? n.parent.childForFieldName("name") : null;
    out.push(fact("import_raw", [path, decl?.type === "identifier" ? decl.text : "", raw, decl?.type === "identifier" ? "*" : ""], line(n)));
  });

  for (const stmt of root.namedChildren) {
    const isExport = stmt.type === "export_statement";
    const decl = isExport ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (!decl) continue;
    // export default async (job) => { … } : une fonction sans nom, que ses importateurs appellent par le nom qu'ils lui donnent.
    if (isExport && stmt.text.startsWith("export default") && isFunction(decl) && !decl.childForFieldName("name")) {
      out.push(fact("defines", [path, "default", line(decl)], line(decl)));
      continue;
    }
    if (decl.type === "function_declaration" || decl.type === "class_declaration" || decl.type === "abstract_class_declaration" || decl.type === "interface_declaration") {
      const name = decl.childForFieldName("name")?.text;
      if (name) out.push(fact("defines", [path, name, line(decl)], line(decl)));
      if (isExport && stmt.text.startsWith("export default") && name) out.push(fact("defines", [path, "default", line(decl)], line(decl)));
      if (decl.type === "interface_declaration" && name) {
        out.push(fact("interface_def", [path, name, line(decl)], line(decl)));
        for (const m of decl.childForFieldName("body")?.namedChildren ?? []) {
          const member = m.childForFieldName("name")?.text;
          if (member && (m.type === "method_signature" || m.type === "property_signature")) out.push(fact("interface_member", [path, name, member, line(m)], line(m)));
        }
      }
      if ((decl.type === "class_declaration" || decl.type === "abstract_class_declaration") && name) {
        const heritage = decl.namedChildren.find((c) => c.type === "class_heritage");
        for (const clause of heritage?.namedChildren ?? []) {
          if (clause.type !== "implements_clause") continue;
          for (const t of clause.namedChildren) {
            const iface = (t.type === "generic_type" ? t.namedChildren[0] : t)?.text;
            if (iface && /^[A-Za-z_$][\w$]*$/.test(iface)) out.push(fact("implements", [path, name, iface, line(decl)], line(decl)));
          }
        }
      }
    } else if (decl.type === "lexical_declaration" || decl.type === "variable_declaration") {
      for (const d of decl.namedChildren) {
        const name = d.type === "variable_declarator" ? d.childForFieldName("name") : null;
        if (name?.type === "identifier") out.push(fact("defines", [path, name.text, line(d)], line(d)));
        const value = d.type === "variable_declarator" ? d.childForFieldName("value") : null;
        const str = value && (value.type === "string" || value.type === "template_string") ? literal(value) : undefined;
        if (name?.type === "identifier" && str !== undefined) out.push(fact("const_str", [path, name.text, str], line(d)));
      }
    }
  }

  if (/(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) out.push(fact("test_file", [path], 1));
  if (/\.config\.[cm]?[jt]s$/.test(path)) out.push(fact("config_file", [path], 1));
  if (path.includes("/")) out.push(fact("top_dir", [path, path.slice(0, path.indexOf("/"))], 1));

  // Les fonctions exportées par leur nom, et celles que leur propre fichier emploie.
  const fns = new Map<string, Node>();
  for (const stmt of root.namedChildren) {
    const d = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (d?.type === "function_declaration" || d?.type === "generator_function_declaration") { const id = d.childForFieldName("name"); if (id) fns.set(id.text, id); }
    else if (d?.type === "lexical_declaration" || d?.type === "variable_declaration") for (const v of d.namedChildren) {
      const id = v.childForFieldName("name"), val = v.childForFieldName("value");
      if (id?.type === "identifier" && val && ["arrow_function", "function_expression", "function"].includes(val.type)) fns.set(id.text, id);
    }
  }
  const exported = new Map<string, Node>();
  for (const stmt of root.namedChildren) {
    if (stmt.type !== "export_statement" || stmt.text.startsWith("export default") || stmt.childForFieldName("source")) continue;
    const d = stmt.childForFieldName("declaration");
    if (d) { for (const [name, id] of fns) if (id.startIndex >= d.startIndex && id.endIndex <= d.endIndex) exported.set(name, id); continue; }
    // export { f } : une fonction du fichier, exportée sous son nom.
    for (const spec of stmt.namedChildren.find((c) => c.type === "export_clause")?.namedChildren ?? []) {
      const name = spec.childForFieldName("name")?.text;
      if (name && !spec.childForFieldName("alias") && fns.has(name)) exported.set(name, fns.get(name)!);
    }
  }
  for (const [name, id] of exported) out.push(fact("export_fn", [path, name, line(id)], line(id)));
  for (const [name, decl] of functionsAndMethods(root, true)) out.push(fact("fn_span", [path, name, line(decl), decl.endPosition.row + 1], line(decl)));
  for (const c of root.namedChildren) {
    const title = c.type === "comment" ? sectionTitle(c.text) : undefined;
    if (title) out.push(fact("section", [path, title, line(c)], line(c)));
  }
  if (exported.size) {
    const here = new Set<string>();
    walkAll(root, (n) => {
      if (n.type !== "identifier" || !exported.has(n.text) || n.startIndex === exported.get(n.text)!.startIndex) return;
      if (n.parent?.type === "export_specifier") return;
      here.add(n.text);
    });
    for (const name of here) out.push(fact("used_here", [path, name], line(exported.get(name)!)));
  }

  // new X(…) dans une fonction de premier niveau : qui fabrique quoi.
  for (const [fn, body] of functionsAndMethods(root)) {
    walkAll(body, (n) => {
      if (n.type !== "new_expression") return;
      const cls = n.childForFieldName("constructor");
      if (cls?.type === "identifier") out.push(fact("instantiates", [path, fn, cls.text, line(n)], line(n)));
    });
  }

  out.push(...typedFacts(path, root, fact));

  const seen = new Set<string>();
  walkAll(root, (n) => {
    if (n.type === "call_expression") {
      const parts: string[] = [];
      let cur = n.childForFieldName("function");
      while (cur?.type === "member_expression") {
        const prop = cur.childForFieldName("property");
        if (!prop) break;
        parts.unshift(prop.text);
        cur = cur.childForFieldName("object");
      }
      if ((cur?.type === "identifier" || cur?.type === "this") && parts.length) out.push(fact("member_call", [path, cur.text, parts.join("."), line(n)], line(n)));
    }
    if (n.type !== "member_expression") return;
    const obj = n.childForFieldName("object")?.text;
    const prop = n.childForFieldName("property")?.text;
    if (!prop || !/^[A-Z][A-Z0-9_]*$/.test(prop)) return;
    if (obj && /^[A-Za-z_$][\w$]*$/.test(obj)) out.push(fact("member_upper", [path, obj, prop, line(n)], line(n)));
    if (obj !== "process.env" && obj !== "import.meta.env") return;
    // Les valeurs que Vite fournit lui-même ne sont pas des variables d'environnement.
    if (obj === "import.meta.env" && VITE_BUILTINS.has(prop)) return;
    const k = `${prop}:${line(n)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(fact("env", [path, prop], line(n)));
    // process.env.LOG_LEVEL ?? "info", || "info" : une valeur de repli, donc facultative.
    const up = n.parent;
    if (up?.type === "binary_expression" && up.childForFieldName("left")?.startIndex === n.startIndex && /^(\?\?|\|\|)$/.test(up.childForFieldName("operator")?.text ?? "")) out.push(fact("env_required", [path, prop, "no"], line(n)));
  });
  return out;
}

/** Ce qu'un ré-export fait venir d'un autre fichier : `export { a as b } from "./x"` → b ← a ; `export * from "./x"` → * ← *. */
function reexports(node: Node): Map<string, { imported: string; raw: string }> {
  const out = new Map<string, { imported: string; raw: string }>();
  if (node.type !== "export_statement") return out;
  const src = node.childForFieldName("source");
  const raw = src ? literal(src) : undefined;
  if (!raw) return out;
  const clause = node.namedChildren.find((c) => c.type === "export_clause");
  if (!clause) {
    const ns = node.namedChildren.find((c) => c.type === "namespace_export");
    const id = ns?.namedChildren.find((c) => c.type === "identifier" || c.type === "string")?.text;
    out.set(id ?? "*", { imported: "*", raw });
    return out;
  }
  for (const spec of clause.namedChildren) {
    if (spec.type !== "export_specifier") continue;
    const name = spec.childForFieldName("name")?.text;
    const alias = spec.childForFieldName("alias")?.text;
    if (name) out.set(alias ?? name, { imported: name, raw });
  }
  return out;
}

/**
 * typed(Fichier, Portée, Nom, Type, Ligne) : le type qu'un nom porte, quand il est une classe ou une interface
 * nommée. Portée = la classe pour un de ses champs (`private search: SearchService`, ou un paramètre du
 * constructeur marqué `private`), vide pour un paramètre, une variable ou une valeur `const x = new C()`.
 * C'est ce qui relie `ctrl.find`, `this.search.query()` ou `service.run()` à la méthode d'une classe.
 */
function typedFacts(path: string, root: Node, fact: (rel: string, args: Value[], line: number) => FileFact): FileFact[] {
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const typeName = (ann: Node | null | undefined): string | undefined => {
    const t = ann?.type === "type_annotation" ? ann.namedChildren[0] : ann;
    if (t?.type === "type_identifier") return t.text;
    if (t?.type === "generic_type") return t.childForFieldName("name")?.text;
    return undefined;
  };
  const classOf = (n: Node): string | undefined => {
    for (let c: Node | null = n.parent; c; c = c.parent) if (c.type === "class_declaration" || c.type === "abstract_class_declaration") return c.childForFieldName("name")?.text;
    return undefined;
  };
  walkAll(root, (n) => {
    if (n.type === "required_parameter" || n.type === "optional_parameter") {
      const name = n.childForFieldName("pattern");
      const type = typeName(n.childForFieldName("type"));
      if (name?.type !== "identifier" || !type) return;
      const field = n.namedChildren.some((c) => c.type === "accessibility_modifier" || c.text === "readonly");
      out.push(fact("typed", [path, field ? classOf(n) ?? "" : "", name.text, type, line(n)], line(n)));
    }
    if (n.type === "public_field_definition" || n.type === "field_definition") {
      const name = n.childForFieldName("name")?.text;
      const type = typeName(n.childForFieldName("type"));
      const value = n.childForFieldName("value");
      const made = value?.type === "new_expression" ? value.childForFieldName("constructor") : undefined;
      const t = type ?? (made?.type === "identifier" ? made.text : undefined);
      if (name && t) out.push(fact("typed", [path, classOf(n) ?? "", name, t, line(n)], line(n)));
    }
    if (n.type === "variable_declarator") {
      const name = n.childForFieldName("name");
      const value = n.childForFieldName("value");
      // La valeur construite par `new`, même enveloppée : `globalThis.x ?? new Client()` (un client partagé).
      let built: Node | null | undefined = value?.type === "new_expression" ? value : undefined;
      if (!built && value && !isFunction(value)) walkAll(value, (x) => { if (built) return false; if (isFunction(x)) return false; if (x.type === "new_expression") { built = x; return false; } });
      const made = built?.childForFieldName("constructor");
      const t = typeName(n.childForFieldName("type")) ?? (made?.type === "identifier" ? made.text : undefined);
      if (name?.type === "identifier" && t) out.push(fact("typed", [path, "", name.text, t, line(n)], line(n)));
      // made_with(Fichier, Nom, Classe, L) : la valeur est construite par cette classe, pas seulement annotée.
      if (name?.type === "identifier" && made?.type === "identifier") out.push(fact("made_with", [path, name.text, made.text, line(n)], line(n)));
    }
  });
  return out;
}
