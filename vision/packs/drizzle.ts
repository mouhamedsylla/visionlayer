import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, isFunction, literal, resolveIdentifier, templateParts, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";
import { sqlTables } from "./sql.js";
import { commentOf, tableColumns } from "./drizzle-columns.js";

/**
 * Drizzle ORM, d'après son inventaire (docs/fonctionnement/packs/drizzle.md).
 *
 * table(Fichier, Variable, Nom, Fonction)       export const users = pgTable("users", …) ; app.table(…) ;
 *                                               un créateur de tables ; une vue. Fonction : pgTable, mysqlTable, sqliteTable
 * db_op(Fichier, read|write, Variable, Ligne)   x.select().from(users), x.insert(users), x.$count(users)…
 * db_op_ns(Fichier, read|write, Module, Membre, Ligne)   x.from(schema.users)
 * obj_member(Fichier, Objet, Clé, Variable)     export const schema = { users } : un membre d'un objet
 * tbl_member(Fichier, Objet, Membre, Texte)     schema.users employé comme une table, dans une requête
 * rq_op(Fichier, Clé, Ligne)                    x.query.users.findMany()
 * sql_table(Fichier, read|write, Nom, Ligne)    sql`SELECT … FROM slots` ; INSERT INTO, UPDATE, DELETE FROM : écriture
 * sql_table_var(Fichier, read|write, Variable, Ligne)    sql`DELETE FROM ${notes}`
 * col_enum(Fichier, Table, Colonne, Valeur, Ligne)   text("status", { enum: [...] }), pgEnum, mysqlEnum : une valeur permise, à sa ligne
 * col_default(Fichier, Table, Colonne, Valeur)       .default("pending")
 * db_set_val(Fichier, Table, Colonne, Valeur, Ligne)   .set({ status: "paid" }), .values({ status: "paid" })
 * db_set_any(Fichier, Table, Colonne, Ligne)         .set({ status: next }) : une valeur qu'on ne lit pas
 * db_set_whole(Fichier, Table, Ligne)                .set(patch), .values({ ...input }) : des colonnes qu'on ne voit pas
 * sql_write_lit(Fichier, Nom, Valeur)                sql`UPDATE orders SET status = 'paid'` : un texte d'une écriture SQL
 * upd_set(Fichier, Table, Colonne, Ligne)            .update(t).set({ status: … }) : une colonne mise à jour
 * tx_span(Fichier, Début, Fin)                       db.transaction(async (tx) => …) : les lignes de la fonction de la transaction
 * write_ctx(Fichier, Ligne, tx|param|conn)           l'écriture passe par la transaction, par un paramètre reçu, ou par une connexion
 * read_filter(Fichier, Table, Colonne, Ligne)        db.select().from(t).where(eq(t.status, …)) : à la ligne du select
 * read_locked(Fichier, Ligne)                        … .for("update") : la lecture verrouille ses lignes
 * upd_at(Fichier, Table, Ligne)                      db.update(t) : à la ligne du update
 * upd_where(Fichier, Table, Colonne, Ligne)          … .where(eq(t.id, …)) : une colonne de la condition d'une mise à jour
 * read_col(Fichier, Table, Colonne, Ligne)           db.select({ phone: users.phone }).from(users) : une colonne rendue, à la ligne du from (ou de la jointure)
 * read_whole(Fichier, Table, Ligne)                  db.select().from(users) : toutes les colonnes de la table
 *
 * La requête qui définit une vue n'est pas une lecture : elle n'émet rien.
 */
const DIALECT: Record<string, string> = {
  pgTable: "pgTable", pgView: "pgTable", pgMaterializedView: "pgTable", pgSchema: "pgTable", pgTableCreator: "pgTable",
  mysqlTable: "mysqlTable", mysqlView: "mysqlTable", mysqlSchema: "mysqlTable", mysqlTableCreator: "mysqlTable",
  sqliteTable: "sqliteTable", sqliteView: "sqliteTable", sqliteTableCreator: "sqliteTable",
};
const WRITE = new Set(["insert", "update", "delete"]);
const READ = new Set(["from", "innerJoin", "leftJoin", "rightJoin", "fullJoin", "crossJoin", "$count"]);

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const drizzleFn = (id: string) => {
    const b = imports.get(id);
    return b !== undefined && packageName(b.raw) === "drizzle-orm" ? b.imported : undefined;
  };
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const views: [number, number][] = [];

  /** Ce que fabrique un appel : une table (son nom, sa fonction), ou rien. */
  const tableOf = (call: Node): { name: string; fn: string; view?: Node } | undefined => {
    let cur = unwrap(call);
    let viewCall: Node | undefined;
    // pgView("x").as(…) / pgView("x", cols).existing() : le nom est sur l'appel intérieur.
    if (cur?.type === "call_expression" && cur.childForFieldName("function")?.type === "member_expression") {
      const inner = unwrap(cur.childForFieldName("function")!.childForFieldName("object"));
      const prop = cur.childForFieldName("function")!.childForFieldName("property")?.text;
      if (inner?.type === "call_expression" && (prop === "as" || prop === "existing")) { viewCall = cur; cur = inner; }
    }
    if (cur?.type !== "call_expression") return undefined;
    const fn = cur.childForFieldName("function");
    const name = literal(args(cur)[0]);
    if (name === undefined || !fn) return undefined;
    if (fn.type === "identifier") {
      const imported = drizzleFn(fn.text);
      if (imported && DIALECT[imported] && !imported.endsWith("Schema") && !imported.endsWith("Creator")) return { name, fn: DIALECT[imported]!, view: viewCall };
      // Un créateur de tables : const shopTable = pgTableCreator((n) => `shop_${n}`).
      const init = unwrap(resolveIdentifier(fn));
      const creator = init?.type === "call_expression" ? init.childForFieldName("function") : undefined;
      const cimp = creator?.type === "identifier" ? drizzleFn(creator.text) : undefined;
      if (init && cimp?.endsWith("TableCreator")) return { name: applyCreator(args(init)[0], name), fn: DIALECT[cimp]! };
      return undefined;
    }
    // app.table("x") où const app = pgSchema("app").
    if (fn.type === "member_expression" && fn.childForFieldName("property")?.text === "table") {
      const obj = unwrap(fn.childForFieldName("object"));
      const init = obj?.type === "identifier" ? unwrap(resolveIdentifier(obj)) : undefined;
      const sfn = init?.type === "call_expression" ? init.childForFieldName("function") : undefined;
      const simp = sfn?.type === "identifier" ? drizzleFn(sfn.text) : undefined;
      const schema = init ? literal(args(init)[0]) : undefined;
      if (simp?.endsWith("Schema") && schema) return { name: `${schema}.${name}`, fn: DIALECT[simp]! };
    }
    return undefined;
  };

  /** Une table nommée : `users`, ou `schema.users` (un module entier, ou un objet de tables), rendu par son texte. */
  const tableRef = (t: Node): string | undefined => {
    if (t.type === "identifier") return t.text;
    if (t.type !== "member_expression") return undefined;
    const o = unwrap(t.childForFieldName("object")), p = t.childForFieldName("property")?.text;
    if (o?.type !== "identifier" || !p) return undefined;
    out.push(fact("tbl_member", [file.path, o.text, p, t.text], line(t)));
    return t.text;
  };

  walkAll(root, (n) => {
    if (n.type !== "variable_declarator") return;
    const v = n.childForFieldName("name");
    const value = n.childForFieldName("value");
    if (v?.type !== "identifier" || !value) return;
    // export const schema = { users, commandes: orders } : un objet de tables.
    const lit = unwrap(value);
    if (lit?.type === "object") for (const p of lit.namedChildren) {
      if (p.type === "shorthand_property_identifier") out.push(fact("obj_member", [file.path, v.text, p.text, p.text], line(p)));
      else if (p.type === "pair" && unwrap(p.childForFieldName("value") ?? undefined)?.type === "identifier") out.push(fact("obj_member", [file.path, v.text, p.childForFieldName("key")!.text.replace(/['"]/g, ""), unwrap(p.childForFieldName("value") ?? undefined)!.text], line(p)));
    }
    const t = tableOf(value);
    if (!t) return;
    out.push(fact("table", [file.path, v.text, t.name, t.fn], line(n)));
    // Ce que l'auteur dit de la table : au-dessus de sa déclaration (export const x = pgTable(…)).
    let stmt: typeof n | null = n.parent;
    if (stmt?.parent?.type === "export_statement") stmt = stmt.parent;
    const said = stmt ? commentOf(stmt) : "";
    if (said) out.push(fact("tbl_comment", [file.path, v.text, said], line(n)));
    if (t.view) { views.push([t.view.startIndex, t.view.endIndex]); return; }
    // Les colonnes : leurs noms, types et contraintes ; leurs valeurs permises et leur valeur par défaut.
    const call = unwrap(value);
    if (call?.type === "call_expression") out.push(...tableColumns(file.path, v.text, call, fact));
    let cols = call?.type === "call_expression" ? unwrap(args(call)[1]) : undefined;
    if (cols && isFunction(cols)) cols = unwrap(cols.childForFieldName("body"));
    if (cols?.type !== "object") return;
    for (const p of cols.namedChildren) {
      if (p.type !== "pair") continue;
      const col = p.childForFieldName("key")?.text.replace(/['"]/g, "");
      if (!col) continue;
      let cur = unwrap(p.childForFieldName("value"));
      while (cur?.type === "call_expression" && cur.childForFieldName("function")?.type === "member_expression" && unwrap(cur.childForFieldName("function")!.childForFieldName("object"))?.type === "call_expression") {
        const f = cur.childForFieldName("function")!;
        if (f.childForFieldName("property")?.text === "default") { const d = literal(args(cur)[0]); if (d !== undefined) out.push(fact("col_default", [file.path, v.text, col, d], line(cur))); }
        cur = unwrap(f.childForFieldName("object"));
      }
      for (const val of enumValues(cur)) out.push(fact("col_enum", [file.path, v.text, col, val.text, line(val.node)], line(val.node)));
    }
  });
  const inView = (n: Node) => views.some(([a, b]) => n.startIndex >= a && n.endIndex <= b);

  /** Les valeurs permises d'une colonne : text(…, { enum }), t.varchar(…, { enum }), un type énuméré du fichier, mysqlEnum(…, [...]). */
  function enumValues(col: Node | undefined): { text: string; node: Node }[] {
    if (col?.type !== "call_expression") return [];
    const fn = unwrap(col.childForFieldName("function"));
    const a = args(col);
    const name = fn?.type === "identifier" ? drizzleFn(fn.text) : fn?.type === "member_expression" ? fn.childForFieldName("property")?.text : undefined;
    if (name === "text" || name === "varchar" || name === "char") return arrayValues(pairValue(a[1], "enum"));
    if (name === "mysqlEnum") return arrayValues(a[1]);
    if (fn?.type === "identifier" && !name) {
      const init = unwrap(resolveIdentifier(fn));
      const f = init?.type === "call_expression" ? init.childForFieldName("function") : undefined;
      if (f?.type === "identifier" && drizzleFn(f.text) === "pgEnum") return arrayValues(args(init!)[1]);
    }
    return [];
  }

  walkAll(root, (n) => {
    if (inView(n)) return;
    if (n.type === "call_expression") {
      const fn = n.childForFieldName("function");
      if (fn?.type !== "member_expression") return;
      const op = fn.childForFieldName("property")?.text ?? "";
      // x.query.users.findMany()
      if (op === "findMany" || op === "findFirst") {
        const owner = fn.childForFieldName("object");
        const q = owner?.type === "member_expression" ? owner.childForFieldName("object") : undefined;
        const key = owner?.type === "member_expression" ? owner.childForFieldName("property")?.text : undefined;
        if (key && q?.type === "member_expression" && q.childForFieldName("property")?.text === "query") out.push(fact("rq_op", [file.path, key, line(n)], line(n)));
        return;
      }
      // .set({ … }) sur x.update(t), .values({ … }) sur x.insert(t) : les valeurs écrites.
      if (op === "set" || op === "values") {
        const target = unwrap(fn.childForFieldName("object"));
        const tf = target?.type === "call_expression" ? target.childForFieldName("function") : undefined;
        const want = op === "set" ? "update" : "insert";
        const table = tf?.type === "member_expression" && tf.childForFieldName("property")?.text === want ? unwrap(args(target!)[0]) : undefined;
        if (table && tableRef(table)) {
          const a = unwrap(args(n)[0]);
          const objs = a?.type === "array" ? a.namedChildren.map((x) => unwrap(x)) : [a];
          for (const o of objs) {
            if (o?.type !== "object" || o.namedChildren.some((c) => c.type === "spread_element")) { out.push(fact("db_set_whole", [file.path, table.text, line(n)], line(n))); continue; }
            for (const p of o.namedChildren) {
              const col = p.type === "pair" ? p.childForFieldName("key")?.text.replace(/['"]/g, "") : p.type === "shorthand_property_identifier" ? p.text : undefined;
              if (!col) continue;
              const val = p.type === "pair" ? literal(p.childForFieldName("value") ?? undefined) : undefined;
              if (val !== undefined) out.push(fact("db_set_val", [file.path, table.text, col, val, line(p)], line(p)));
              else out.push(fact("db_set_any", [file.path, table.text, col, line(p)], line(p)));
              if (op === "set") out.push(fact("upd_set", [file.path, table.text, col, line(p)], line(p)));
            }
          }
        }
      }
      // Une transaction : les lignes de sa fonction.
      if (op === "transaction") {
        const cb = unwrap(args(n)[0]);
        if (cb && isFunction(cb)) out.push(fact("tx_span", [file.path, line(cb), cb.endPosition.row + 1], line(n)));
      }
      // Une condition : sur une lecture (select … from t) ou sur une mise à jour (update t).
      if (op === "where") {
        const chain = chainOf(fn.childForFieldName("object"));
        const from = chain.find((c) => c.prop === "from"), upd = chain.find((c) => c.prop === "update");
        const tv = unwrap(args((upd ?? from)?.call ?? n)[0]);
        if (tv && tableRef(tv) && (from || upd)) {
          const cols = columnsOf(args(n)[0], tv.text);
          if (upd) for (const c of cols) out.push(fact("upd_where", [file.path, tv.text, c, upd.line], upd.line));
          else {
            const at = chain.find((c) => c.prop === "select")?.line ?? from!.line;
            for (const c of cols) out.push(fact("read_filter", [file.path, tv.text, c, at], at));
            let up: Node | null = n.parent;
            while (up?.type === "member_expression" || up?.type === "call_expression") {
              if (up.type === "member_expression" && up.childForFieldName("property")?.text === "for") { out.push(fact("read_locked", [file.path, at], at)); break; }
              up = up.parent;
            }
          }
        }
      }
      if (op === "update") {
        const tv = unwrap(args(n)[0]);
        const at = (fn.childForFieldName("property")?.startPosition.row ?? 0) + 1;
        if (tv && tableRef(tv)) out.push(fact("upd_at", [file.path, tv.text, at], at));
      }
      // Ce qu'une lecture rend : les colonnes nommées dans select({ … }), ou toute la ligne pour select() ; jointures comprises.
      if (READ.has(op) && op !== "$count") {
        const tv = unwrap(args(n)[0]);
        const sel = chainOf(fn.childForFieldName("object")).find((c) => c.prop === "select" || c.prop === "selectDistinct");
        if (tv && tableRef(tv) && sel) {
          // select(colonnes), une constante du fichier : son objet.
          const given = unwrap(args(sel.call)[0]);
          const shape = given?.type === "identifier" ? unwrap(resolveIdentifier(given)) : given;
          // select() ou select({ user: users }) : la ligne entière de la table.
          const whole = !shape || (shape.type === "object" && shape.namedChildren.some((p) => p.type === "pair" && unwrap(p.childForFieldName("value") ?? undefined)?.text === tv.text));
          if (whole) out.push(fact("read_whole", [file.path, tv.text, line(n)], line(n)));
          else for (const c of columnsOf(shape, tv.text)) out.push(fact("read_col", [file.path, tv.text, c, line(n)], line(n)));
        }
      }
      const kind = WRITE.has(op) ? "write" : READ.has(op) ? "read" : undefined;
      const a = unwrap(args(n)[0]);
      if (!kind || !a) return;
      if (kind === "write") out.push(fact("write_ctx", [file.path, line(n), receiverKind(fn.childForFieldName("object"))], line(n)));
      if (a.type === "identifier") out.push(fact("db_op", [file.path, kind, a.text, line(n)], line(n)));
      if (op === "delete" && a.type === "identifier") out.push(fact("db_delete", [file.path, a.text, line(n)], line(n)));
      else if (a.type === "member_expression") {
        const o = a.childForFieldName("object");
        const p = a.childForFieldName("property")?.text;
        if (o?.type === "identifier" && p) out.push(fact("db_op_ns", [file.path, kind, o.text, p, line(n)], line(n)));
        if (op === "delete" && o?.type === "identifier" && p) out.push(fact("db_delete_ns", [file.path, o.text, p, line(n)], line(n)));
      }
      return;
    }
    // sql`…` : le gabarit étiqueté par `sql` de drizzle-orm.
    if (n.type === "call_expression" || n.type !== "template_string") return;
    const tag = n.parent?.type === "call_expression" ? n.parent.childForFieldName("function") : undefined;
    if (tag?.type !== "identifier" || drizzleFn(tag.text) !== "sql") return;
    const quoted = [...n.text.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
    for (const t of sqlTables(n)) {
      if ("name" in t && t.op === "write") for (const q of quoted) out.push(fact("sql_write_lit", [file.path, t.name, q], line(n)));
      if ("name" in t) out.push(fact("sql_table", [file.path, t.op, t.name, line(n)], line(n)));
      else out.push(fact("sql_table_var", [file.path, t.op, t.var, line(n)], line(n)));
    }
  });
  return out;
};

/** La chaîne sous un appel : db.select().from(t) → [from, select], chacun avec sa ligne (celle de son nom). */
function chainOf(n: Node | null | undefined): { prop: string; call: Node; line: number }[] {
  const out: { prop: string; call: Node; line: number }[] = [];
  let cur = unwrap(n);
  while (cur?.type === "call_expression") {
    const f = cur.childForFieldName("function");
    if (f?.type !== "member_expression") break;
    const p = f.childForFieldName("property");
    out.push({ prop: p?.text ?? "", call: cur, line: (p?.startPosition.row ?? 0) + 1 });
    cur = unwrap(f.childForFieldName("object"));
  }
  return out;
}

/** Les colonnes d'une table nommées dans une condition : eq(t.status, …), and(…), inArray(t.id, …). */
function columnsOf(n: Node | undefined, table: string): string[] {
  const cols = new Set<string>();
  if (!n) return [];
  walkAll(n, (x) => {
    if (x.type !== "member_expression") return;
    if (unwrap(x.childForFieldName("object"))?.text === table) { const c = x.childForFieldName("property")?.text; if (c) cols.add(c); }
  });
  return [...cols];
}

/** Par où passe une écriture : le paramètre de la fonction d'une transaction, un paramètre reçu, ou une connexion. */
function receiverKind(obj: Node | null | undefined): "tx" | "param" | "conn" {
  let root = unwrap(obj);
  while (root?.type === "member_expression" || root?.type === "call_expression") root = unwrap(root.type === "call_expression" ? root.childForFieldName("function") : root.childForFieldName("object"));
  if (root?.type !== "identifier") return "conn";
  for (let up: Node | null = root.parent; up; up = up.parent) {
    if (!isFunction(up)) continue;
    const params = (up.childForFieldName("parameters")?.namedChildren ?? (up.childForFieldName("parameter") ? [up.childForFieldName("parameter")!] : [])).map((p) => (p.childForFieldName("pattern") ?? p).text.split(":")[0]!.trim());
    if (!params.includes(root.text)) continue;
    const call = up.parent?.type === "arguments" ? up.parent.parent : null;
    const callee = call?.type === "call_expression" ? call.childForFieldName("function") : null;
    return callee?.type === "member_expression" && callee.childForFieldName("property")?.text === "transaction" ? "tx" : "param";
  }
  return "conn";
}

function pairValue(n: Node | undefined, key: string): Node | undefined {
  const o = unwrap(n);
  if (o?.type !== "object") return undefined;
  for (const p of o.namedChildren) if (p.type === "pair" && p.childForFieldName("key")?.text.replace(/['"]/g, "") === key) return p.childForFieldName("value") ?? undefined;
  return undefined;
}

/** Les textes d'un tableau écrit sur place, ou gardé dans une constante du fichier (`as const` compris). */
function arrayValues(n: Node | undefined): { text: string; node: Node }[] {
  let a = unwrap(n);
  if (a?.type === "identifier") a = unwrap(resolveIdentifier(a));
  if (a?.type !== "array") return [];
  return a.namedChildren.flatMap((x) => { const t = literal(x); return t === undefined ? [] : [{ text: t, node: x }]; });
}

/** (n) => `shop_${n}` appliqué à "products" → "shop_products". */
function applyCreator(fn: Node | undefined, name: string): string {
  const f = unwrap(fn);
  const param = f?.childForFieldName("parameters")?.namedChildren[0]?.text ?? f?.childForFieldName("parameter")?.text;
  const body = unwrap(f?.childForFieldName("body"));
  if (!param || body?.type !== "template_string") return name;
  let s = "";
  for (const part of templateParts(body)) s += "text" in part ? part.text : part.expr?.text === param ? name : "{}";
  return s.includes("{}") ? name : s;
}

export default script;
