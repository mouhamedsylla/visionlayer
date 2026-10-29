import type { FileFact } from "../facts/types.js";
import { args, isFunction, literal, resolveIdentifier, templateParts, unwrap, type Node } from "../arch/ast.js";

/**
 * Les colonnes et les contraintes d'une table Drizzle (formes C1 à C8 de docs/fonctionnement/packs/drizzle.md).
 * Toutes les colonnes sont rendues par leur nom en base : `userId: uuid("user_id")` → `user_id`.
 *
 * col_key(Fichier, Table, Clé, Colonne)                 la clé de l'objet et le nom en base
 * col_def(Fichier, Table, Colonne, Type, null|notnull)  une colonne, son type (la fonction qui la construit)
 * tbl_cons(Fichier, Table, Genre, Nom, Colonnes, Où)    primary, unique, index, check ; Colonnes séparées par des virgules ;
 *                                                       Où : la condition partielle d'un index, ou la condition d'un check
 * col_ref(Fichier, Table, Colonnes, Variable)           une clé étrangère vers la table de cette variable
 */
type Fact = (rel: string, args: (string | number)[], line: number) => FileFact;

export function tableColumns(file: string, table: string, call: Node, fact: Fact): FileFact[] {
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  let cols = unwrap(args(call)[1]);
  if (cols && isFunction(cols)) cols = unwrap(cols.childForFieldName("body"));
  if (cols?.type !== "object") return out;
  const dbName = new Map<string, string>();

  for (const p of cols.namedChildren) {
    if (p.type !== "pair") continue;
    const key = p.childForFieldName("key")?.text.replace(/['"]/g, "");
    if (!key) continue;
    const chain = columnChain(unwrap(p.childForFieldName("value")));
    if (!chain) continue;
    const name = chain.name ?? key;
    dbName.set(key, name);
    out.push(fact("col_key", [file, table, key, name], line(p)));
    const has = (m: string) => chain.calls.find((c) => c.method === m);
    out.push(fact("col_def", [file, table, name, chain.type, has("notNull") || has("primaryKey") ? "notnull" : "null"], line(p)));
    if (has("primaryKey")) out.push(fact("tbl_cons", [file, table, "primary", "", name, ""], line(p)));
    const uq = has("unique");
    if (uq) out.push(fact("tbl_cons", [file, table, "unique", literal(uq.args[0]) ?? "", name, ""], line(p)));
    const ref = has("references");
    const target = ref ? refTable(ref.args[0]) : undefined;
    if (target) out.push(fact("col_ref", [file, table, name, target], line(p)));
  }

  // Le troisième argument : (t) => [uniqueIndex(…).on(t.a), …], ou un objet de contraintes (forme plus ancienne).
  let extra = unwrap(args(call)[2]);
  if (extra && isFunction(extra)) extra = unwrap(extra.childForFieldName("body"));
  const items = extra?.type === "array" ? extra.namedChildren : extra?.type === "object" ? extra.namedChildren.map((p) => p.childForFieldName("value")) : [];
  const colsOf = (ns: Node[]) => ns.map((n) => {
    const m = unwrap(n);
    const k = m?.type === "member_expression" ? m.childForFieldName("property")?.text : undefined;
    return k ? dbName.get(k) ?? k : undefined;
  }).filter((x): x is string => !!x);
  for (const item of items) {
    const c = constraintChain(unwrap(item));
    if (!c) continue;
    const at = line(item!);
    const on = c.calls.find((x) => x.method === "on");
    const where = c.calls.find((x) => x.method === "where");
    if (c.head === "uniqueIndex" || c.head === "index" || c.head === "unique") {
      const kind = c.head === "index" ? "index" : "unique";
      out.push(fact("tbl_cons", [file, table, kind, literal(c.args[0]) ?? "", colsOf(on?.args ?? []).join(","), where ? sqlText(where.args[0]) : ""], at));
    } else if (c.head === "primaryKey") {
      out.push(fact("tbl_cons", [file, table, "primary", literal(pair(c.args[0], "name")) ?? "", colsOf(arrayOf(pair(c.args[0], "columns"))).join(","), ""], at));
    } else if (c.head === "check") {
      out.push(fact("tbl_cons", [file, table, "check", literal(c.args[0]) ?? "", "", sqlText(c.args[1])], at));
    } else if (c.head === "foreignKey") {
      const target = arrayOf(pair(c.args[0], "foreignColumns")).map((n) => unwrap(n)).find((n) => n?.type === "member_expression");
      const v = unwrap(target?.childForFieldName("object"));
      if (v?.type === "identifier") out.push(fact("col_ref", [file, table, colsOf(arrayOf(pair(c.args[0], "columns"))).join(","), v.text], at));
    }
  }
  return out;
}

/** text("email").notNull().unique() → { type: "text", name: "email", calls: [notNull, unique] } ; suit une fonction du fichier (`id()`). */
function columnChain(n: Node | undefined, depth = 0): { type: string; name?: string; calls: { method: string; args: Node[] }[] } | undefined {
  const calls: { method: string; args: Node[] }[] = [];
  let cur = n;
  while (cur?.type === "call_expression") {
    const fn = unwrap(cur.childForFieldName("function"));
    if (fn?.type === "member_expression") {
      calls.unshift({ method: fn.childForFieldName("property")?.text ?? "", args: args(cur) });
      cur = unwrap(fn.childForFieldName("object"));
      continue;
    }
    if (fn?.type !== "identifier") return undefined;
    const init = unwrap(resolveIdentifier(fn));
    if (init && isFunction(init) && depth < 2) {
      const inner = columnChain(unwrap(init.childForFieldName("body")), depth + 1);
      return inner && { ...inner, calls: [...inner.calls, ...calls] };
    }
    return { type: fn.text, name: literal(args(cur)[0]), calls };
  }
  // (t) => ({ id: t.text("id") }) : la fonction de colonne est un membre du paramètre.
  const head = calls.shift();
  return cur?.type === "identifier" && head ? { type: head.method, name: literal(head.args[0]), calls } : undefined;
}

/** uniqueIndex("n").on(t.a).where(sql`…`) → { head: "uniqueIndex", args: ["n"], calls: [on, where] }. */
function constraintChain(n: Node | undefined): { head: string; args: Node[]; calls: { method: string; args: Node[] }[] } | undefined {
  const calls: { method: string; args: Node[] }[] = [];
  let cur = n;
  while (cur?.type === "call_expression") {
    const fn = unwrap(cur.childForFieldName("function"));
    if (fn?.type === "identifier") return { head: fn.text, args: args(cur), calls };
    if (fn?.type !== "member_expression") return undefined;
    calls.unshift({ method: fn.childForFieldName("property")?.text ?? "", args: args(cur) });
    cur = unwrap(fn.childForFieldName("object"));
  }
  return undefined;
}

/** () => users.id → users. */
function refTable(n: Node | undefined): string | undefined {
  const f = unwrap(n);
  const body = f && isFunction(f) ? unwrap(f.childForFieldName("body")) : undefined;
  const v = body?.type === "member_expression" ? unwrap(body.childForFieldName("object")) : undefined;
  return v?.type === "identifier" ? v.text : undefined;
}

/** sql`status in ('pending', 'confirmed')` → le texte, une substitution rendue par son expression. */
function sqlText(n: Node | undefined): string {
  const c = unwrap(n);
  const tpl = c?.type === "call_expression" ? c.childForFieldName("arguments") : undefined;
  if (tpl?.type !== "template_string") return "";
  return templateParts(tpl).map((p) => ("text" in p ? p.text : p.expr.text)).join("").replace(/\s+/g, " ").trim();
}

function pair(n: Node | undefined, key: string): Node | undefined {
  const o = unwrap(n);
  if (o?.type !== "object") return undefined;
  for (const p of o.namedChildren) if (p.type === "pair" && p.childForFieldName("key")?.text === key) return p.childForFieldName("value") ?? undefined;
  return undefined;
}

function arrayOf(n: Node | undefined): Node[] {
  const a = unwrap(n);
  return a?.type === "array" ? a.namedChildren : [];
}
