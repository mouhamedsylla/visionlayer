import type Parser from "tree-sitter";

export type Node = Parser.SyntaxNode;

const FUNCTION_TYPES = new Set(["function_declaration", "arrow_function", "function_expression", "method_definition", "function"]);

export function isFunction(node: Node): boolean {
  return FUNCTION_TYPES.has(node.type);
}

/** Parcours complet, dans l'ordre du source. `visit` renvoie false pour ne pas descendre. */
export function walkAll(node: Node, visit: (n: Node) => boolean | void): void {
  for (const child of node.namedChildren) {
    if (visit(child) === false) continue;
    walkAll(child, visit);
  }
}

/** Retire les enveloppes sans effet sur la valeur : `await x`, `(x)`, `x as T`, `x!`, `x satisfies T`. */
export function unwrap(node: Node | null | undefined): Node | undefined {
  let n = node ?? undefined;
  while (n && ["await_expression", "parenthesized_expression", "as_expression", "non_null_expression", "satisfies_expression", "type_assertion"].includes(n.type)) {
    n = n.namedChildren[0];
  }
  return n;
}

export function args(call: Node): Node[] {
  return call.childForFieldName("arguments")?.namedChildren ?? [];
}

/** Valeur d'une chaîne littérale (`"x"`, `'x'`, `` `x` `` sans substitution). */
export function literal(node: Node | undefined): string | undefined {
  const n = unwrap(node);
  if (!n) return undefined;
  if (n.type === "string") return n.namedChildren.filter((c) => c.type === "string_fragment").map((c) => c.text).join("") || n.text.slice(1, -1);
  if (n.type === "template_string" && !n.namedChildren.some((c) => c.type === "template_substitution")) return n.text.slice(1, -1);
  return undefined;
}

/** Morceaux d'un gabarit : texte littéral ou expression substituée. */
export function templateParts(node: Node): ({ text: string } | { expr: Node })[] {
  const parts: ({ text: string } | { expr: Node })[] = [];
  const raw = node.text;
  let cursor = node.startIndex + 1;
  for (const c of node.namedChildren) {
    if (c.type !== "template_substitution") continue;
    if (c.startIndex > cursor) parts.push({ text: raw.slice(cursor - node.startIndex, c.startIndex - node.startIndex) });
    const expr = c.namedChildren[0];
    if (expr) parts.push({ expr });
    cursor = c.endIndex;
  }
  if (node.endIndex - 1 > cursor) parts.push({ text: raw.slice(cursor - node.startIndex, node.endIndex - 1 - node.startIndex) });
  return parts;
}

/** Nom de la fonction appelée : `f`, `a.b.c` → "c" avec l'objet `a.b`. */
export function callee(call: Node): { name: string; object?: Node } | undefined {
  const fn = unwrap(call.childForFieldName("function"));
  if (!fn) return undefined;
  if (fn.type === "identifier") return { name: fn.text };
  if (fn.type === "member_expression") {
    const prop = fn.childForFieldName("property");
    const obj = fn.childForFieldName("object");
    if (prop) return obj ? { name: prop.text, object: obj } : { name: prop.text };
  }
  return undefined;
}

/**
 * Valeur d'une variable locale : on remonte les blocs englobants jusqu'à la
 * déclaration `const|let|var nom = …` qui précède l'usage. Pas de flot de
 * données : la première initialisation fait foi.
 */
export function resolveIdentifier(ident: Node): Node | undefined {
  const name = ident.text;
  for (let scope: Node | null = ident.parent; scope; scope = scope.parent) {
    if (scope.type !== "statement_block" && scope.type !== "program" && scope.type !== "class_body") continue;
    for (const stmt of scope.namedChildren) {
      const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
      if (!decl || (decl.type !== "lexical_declaration" && decl.type !== "variable_declaration")) continue;
      for (const d of decl.namedChildren) {
        if (d.type !== "variable_declarator") continue;
        if (d.childForFieldName("name")?.text === name) {
          const value = d.childForFieldName("value");
          if (value && value.startIndex !== ident.startIndex) return value;
        }
      }
    }
  }
  return undefined;
}

/**
 * Déclaration d'une fonction nommée au niveau du fichier (function f / const f = () => …).
 * Avec `wrapped`, aussi la fonction passée en dernier à un appel qui l'emballe,
 * sous le nom de la constante : `export const pay = onCall(opts, async (req) => …)`,
 * `const h = asyncHandler(async (req, res) => …)`.
 */
export function topLevelFunctions(root: Node, wrapped = false): Map<string, Node> {
  const out = new Map<string, Node>();
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (!decl) continue;
    // export default async (job) => { … } : la fonction sans nom s'appelle « default », comme dans `defines`.
    if (stmt.type === "export_statement" && stmt.text.startsWith("export default") && isFunction(decl) && !decl.childForFieldName("name")) {
      out.set("default", decl);
      continue;
    }
    if (decl.type === "function_declaration") {
      const name = decl.childForFieldName("name")?.text;
      if (name) out.set(name, decl);
    } else if (decl.type === "lexical_declaration" || decl.type === "variable_declaration") {
      for (const d of decl.namedChildren) {
        const value = d.childForFieldName("value");
        const name = d.childForFieldName("name")?.text;
        if (name && value && isFunction(value)) out.set(name, value);
        else if (name && wrapped && value?.type === "call_expression") {
          const last = value.childForFieldName("arguments")?.namedChildren.at(-1);
          if (last && isFunction(last)) out.set(name, last);
        }
      }
    }
  }
  return out;
}

/**
 * Les méthodes des classes de premier niveau, nommées `Classe.méthode` : une méthode (`async find() {}`),
 * ou un champ qui porte une fonction (`find = async () => {}`). Le constructeur s'appelle `Classe.constructor`.
 */
export function classMembers(root: Node): Map<string, Node> {
  const out = new Map<string, Node>();
  for (const stmt of root.namedChildren) {
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (decl?.type !== "class_declaration" && decl?.type !== "abstract_class_declaration") continue;
    const cls = decl.childForFieldName("name")?.text;
    if (!cls) continue;
    for (const m of decl.childForFieldName("body")?.namedChildren ?? []) {
      const name = m.childForFieldName("name")?.text;
      if (!name) continue;
      if (m.type === "method_definition") out.set(`${cls}.${name}`, m);
      else if (m.type === "public_field_definition" || m.type === "field_definition") {
        const value = m.childForFieldName("value");
        if (value && isFunction(value)) out.set(`${cls}.${name}`, value);
      }
    }
  }
  return out;
}

/** Les fonctions de premier niveau, puis les méthodes des classes de premier niveau. */
export function functionsAndMethods(root: Node, wrapped = false): Map<string, Node> {
  return new Map([...topLevelFunctions(root, wrapped), ...classMembers(root), ...(wrapped ? [...objectMembers(root), ...registeredCallbacks(root)] : [])]);
}

/**
 * Les fonctions d'un objet de premier niveau, nommées `objet.membre` comme les méthodes d'une classe : c'est ainsi qu'on
 * écrit souvent un service. `export const svc = { list() {}, get: async () => {}, find: wrap(async () => {}), create, remove: removeOne }`
 * et `export default { … }`, qui s'appelle `default`.
 */
export function objectMembers(root: Node): Map<string, Node> {
  const out = new Map<string, Node>();
  const tops = topLevelFunctions(root, true);
  const read = (name: string, obj: Node) => {
    for (const m of obj.namedChildren) {
      if (m.type === "method_definition") { const k = m.childForFieldName("name")?.text; if (k) out.set(`${name}.${k}`, m); continue; }
      if (m.type === "shorthand_property_identifier") { const f = tops.get(m.text); if (f) out.set(`${name}.${m.text}`, f); continue; }
      if (m.type !== "pair") continue;
      const k = m.childForFieldName("key")?.text.replace(/['"]/g, "");
      let v = m.childForFieldName("value");
      if (v?.type === "call_expression") v = v.childForFieldName("arguments")?.namedChildren.at(-1) ?? v;
      if (!k || !v) continue;
      if (isFunction(v)) out.set(`${name}.${k}`, v);
      else if (v.type === "identifier" && tops.get(v.text)) out.set(`${name}.${k}`, tops.get(v.text)!);
    }
  };
  for (const stmt of root.namedChildren) {
    if (stmt.type === "export_statement" && stmt.text.startsWith("export default")) {
      const v = stmt.childForFieldName("value") ?? stmt.namedChildren[0];
      if (v?.type === "object") read("default", v);
      continue;
    }
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (decl?.type !== "lexical_declaration" && decl?.type !== "variable_declaration") continue;
    for (const d of decl.namedChildren) {
      const name = d.childForFieldName("name")?.text, value = d.childForFieldName("value");
      if (name && value?.type === "object") read(name, value);
    }
  }
  return out;
}

/**
 * Les fonctions sans nom données à un enregistrement, là où elles sont écrites : `router.get("/", async (req, res) => …)`,
 * `app.post("/x", wrap(async () => …))`, `router.route("/x").get(async () => …)`, `cron.schedule("* * * * *", () => …)`.
 * Sans framework : une instruction `objet.méthode(…)` dont le premier argument est un nom écrit, ou qui suit un tel appel,
 * et dont le dernier argument est une fonction. Nommées comme elles sont écrites : `router.get("/")`.
 */
export function registeredCallbacks(root: Node): Map<string, Node> {
  const out = new Map<string, Node>();
  const named = (n: Node | undefined) => n?.type === "string" || n?.type === "template_string";
  const statement = (n: Node) => { let cur = n; while (cur.parent?.type === "member_expression" && cur.parent.parent?.type === "call_expression") cur = cur.parent.parent; return cur.parent?.type === "expression_statement" || cur.parent?.type === "await_expression"; };
  walkAll(root, (n) => {
    // new Worker("emails", async (job) => …) : la même chose, à la construction ; le dernier argument peut être des options.
    if (n.type === "new_expression") {
      const given = n.childForFieldName("arguments")?.namedChildren ?? [];
      const cb = given.find((x, i) => i > 0 && isFunction(x) && !x.childForFieldName("name"));
      if (cb && (named(given[0]) || given[0]?.type === "identifier" || given[0]?.type === "member_expression")) out.set(`new ${n.childForFieldName("constructor")?.text}(${given[0]!.text.replace(/\s+/g, " ").slice(0, 60)})`, cb);
      return;
    }
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "member_expression") return;
    const args = n.childForFieldName("arguments")?.namedChildren ?? [];
    // La fonction donnée : directement, ou enveloppée (`wrap(async () => …)`, `job("nom", () => …)`), en dernier ou avant des options.
    const fnOf = (x: Node) => (isFunction(x) ? x : x.type === "call_expression" ? x.childForFieldName("arguments")?.namedChildren.at(-1) : undefined);
    const last = args.slice(1).map(fnOf).reverse().find((x): x is Node => !!x && isFunction(x) && !x.childForFieldName("name")) ?? (args.length === 1 ? fnOf(args[0]!) : undefined);
    if (args.length < 1 || !last || !isFunction(last) || last.childForFieldName("name") || !statement(n)) return;
    const chained = fn.childForFieldName("object")?.type === "call_expression";
    // Le premier argument nomme ce qu'on enregistre : un texte, ou une constante (`cron.schedule(EVERY_MINUTE, …)`).
    if (!chained && (args.length < 2 || !(named(args[0]) || args[0]!.type === "identifier" || args[0]!.type === "member_expression"))) return;
    const head = args[0] && args.length > 1 ? args[0].text.replace(/\s+/g, " ").slice(0, 60) : "";
    const name = `${fn.text.replace(/\s+/g, "").slice(-40)}(${head})`;
    out.set(out.has(name) ? `${name}:${n.startPosition.row + 1}` : name, last);
  });
  return out;
}

/** Expressions renvoyées par une fonction (corps expression d'une flèche, ou chaque `return`). */
export function returnedExpressions(fn: Node): Node[] {
  const body = fn.childForFieldName("body");
  if (!body) return [];
  if (body.type !== "statement_block") return [body];
  const out: Node[] = [];
  walkAll(body, (n) => {
    if (isFunction(n)) return false;
    if (n.type === "return_statement" && n.namedChildren[0]) out.push(n.namedChildren[0]);
  });
  return out;
}

/** Nom local → specifier brut, pour chaque import du fichier. */
export function importBindings(root: Node): Map<string, { imported: string; raw: string }> {
  const bindings = new Map<string, { imported: string; raw: string }>();
  for (const node of root.namedChildren) for (const [k, v] of statementBindings(node)) bindings.set(k, v);
  return bindings;
}

/** Les liaisons d'une instruction `import` : nom local → nom importé et spécificateur. Vide pour toute autre instruction. */
export function statementBindings(node: Node): Map<string, { imported: string; raw: string }> {
  const bindings = new Map<string, { imported: string; raw: string }>();
  if (node.type === "lexical_declaration" || node.type === "variable_declaration") return requireBindings(node);
  if (node.type !== "import_statement") return bindings;
  const raw = literal(node.childForFieldName("source") ?? undefined);
  if (!raw) return bindings;
  walkAll(node, (n) => {
    if (n.type === "import_specifier") {
      const name = n.childForFieldName("name")?.text;
      const alias = n.childForFieldName("alias")?.text;
      if (name) bindings.set(alias ?? name, { imported: name, raw });
    } else if (n.type === "namespace_import") {
      const id = n.namedChildren.find((c) => c.type === "identifier")?.text;
      if (id) bindings.set(id, { imported: "*", raw });
    } else if (n.type === "identifier" && n.parent?.type === "import_clause") {
      bindings.set(n.text, { imported: "default", raw });
    }
  });
  return bindings;
}

/** `const cron = require("node-cron")` (le module entier), `const { schedule: s } = require("node-cron")` (un nom). */
function requireBindings(node: Node): Map<string, { imported: string; raw: string }> {
  const bindings = new Map<string, { imported: string; raw: string }>();
  for (const d of node.namedChildren) {
    if (d.type !== "variable_declarator") continue;
    const v = unwrap(d.childForFieldName("value") ?? undefined);
    if (v?.type !== "call_expression" || v.childForFieldName("function")?.text !== "require") continue;
    const raw = literal(args(v)[0]);
    const name = d.childForFieldName("name");
    if (!raw || !name) continue;
    if (name.type === "identifier") bindings.set(name.text, { imported: "*", raw });
    else if (name.type === "object_pattern") for (const p of name.namedChildren) {
      if (p.type === "shorthand_property_identifier_pattern") bindings.set(p.text, { imported: p.text, raw });
      else if (p.type === "pair_pattern") {
        const key = p.childForFieldName("key")?.text, val = p.childForFieldName("value");
        if (key && val?.type === "identifier") bindings.set(val.text, { imported: key, raw });
      }
    }
  }
  return bindings;
}

export function lineText(source: string, line: number): string {
  const l = source.split("\n")[line - 1] ?? "";
  const t = l.trim();
  return t.length > 200 ? `${t.slice(0, 197)}…` : t;
}

/** Symbole de plus haut niveau (fonction ou const) qui contient une ligne. */
export function enclosingTopLevel(root: Node, row: number): string | undefined {
  for (const stmt of root.namedChildren) {
    if (stmt.startPosition.row > row || stmt.endPosition.row < row) continue;
    const decl = stmt.type === "export_statement" ? stmt.childForFieldName("declaration") ?? stmt.namedChildren[0] : stmt;
    if (!decl) return undefined;
    if (decl.type === "function_declaration" || decl.type === "class_declaration") return decl.childForFieldName("name")?.text;
    if (decl.type === "lexical_declaration" || decl.type === "variable_declaration") return decl.namedChildren[0]?.childForFieldName("name")?.text;
    return undefined;
  }
  return undefined;
}
