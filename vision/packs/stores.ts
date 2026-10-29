import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";
import { sqlTables, sqlTablesOfText, type SqlTable } from "./sql.js";

/**
 * Pilotes de stockage, d'après l'inventaire (docs/fonctionnement/packs/stores.md). Le script relève ce que
 * le langage dit ; les règles décident ce qui ouvre une connexion (store_make) et vers quelle technologie.
 *
 * db_conn(Fichier, Variable, Paquet, Chemin, Ligne)   new pg.Pool() → "Pool" ; new Redis() → "default" ;
 *                                                     mysql.createPool() → "createPool" ; MongoClient.connect() → "MongoClient.connect"
 * db_conn_opts(Fichier, Ligne)                       ses options sont écrites sur place, sans rien d'étalé : on sait ce qui manque
 * db_conn_opt(Fichier, Ligne, Clé, Valeur)            { connectionTimeoutMillis: 5000 }, { maxRetriesPerRequest: null }
 * db_derive(Fichier, Variable, Depuis, Ligne)         const client = await pool.connect() ; const db = client.db("app")
 * db_query(Fichier, Variable, read|write, Table, Ligne)   pool.query("SELECT … FROM users"), sql`…`, sql.unsafe("…")
 * db_coll(Fichier, Variable, Racine, Collection, Ligne)   const users = db.collection("users")
 * db_coll_op(Fichier, Racine, Collection, read|write, Ligne)   db.collection("orders").insertOne(…)
 * db_coll_var_op(Fichier, Variable, read|write, Ligne)   users.findOne(…)
 *
 * La variable vaut "default" pour `export default`, et "" quand la connexion n'est gardée nulle part.
 */
const DERIVE = new Set(["connect", "getConnection", "promise", "db"]);
const QUERY = new Set(["query", "execute", "unsafe"]);
const COLL_READ = new Set(["find", "findOne", "aggregate", "countDocuments", "estimatedDocumentCount", "distinct", "watch"]);
const COLL_WRITE = /^(insert|update|replace|delete|findOneAnd|bulkWrite$|drop$)/;

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;

  // Les noms tirés d'un module importé : import pg from "pg"; const { Pool } = pg.
  const picked = new Map<string, { pkg: string; path: string }>();
  const external = (id: string): { pkg: string; path: string } | undefined => {
    const b = imports.get(id);
    if (b && !/^[./]/.test(b.raw)) return { pkg: packageName(b.raw) ?? b.raw, path: b.imported === "*" || b.imported === "default" ? "" : b.imported };
    return picked.get(id);
  };
  walkAll(root, (n) => {
    if (n.type !== "variable_declarator" || n.childForFieldName("name")?.type !== "object_pattern") return;
    const v = unwrap(n.childForFieldName("value"));
    const from = v?.type === "identifier" ? external(v.text) : undefined;
    if (!from || from.path) return;
    for (const p of n.childForFieldName("name")!.namedChildren) {
      if (p.type === "shorthand_property_identifier_pattern") picked.set(p.text, { pkg: from.pkg, path: p.text });
      else if (p.type === "pair_pattern") {
        const key = p.childForFieldName("key")?.text, val = p.childForFieldName("value");
        if (key && val?.type === "identifier") picked.set(val.text, { pkg: from.pkg, path: key });
      }
    }
  });

  /** Ce qu'une expression crée avec un paquet : `new A.B()`, `f()`, `m.f()`, sous la forme paquet + chemin. */
  const creation = (n: Node | undefined): { pkg: string; path: string; args: Node[] } | undefined => {
    const x = unwrap(n);
    const target = x?.type === "new_expression" ? x.childForFieldName("constructor") : x?.type === "call_expression" ? x.childForFieldName("function") : undefined;
    const members: string[] = [];
    let cur = unwrap(target);
    while (cur?.type === "member_expression") {
      members.unshift(cur.childForFieldName("property")?.text ?? "");
      cur = unwrap(cur.childForFieldName("object"));
    }
    if (cur?.type !== "identifier") return undefined;
    const b = external(cur.text);
    if (!b) return undefined;
    const path = [b.path, ...members].filter(Boolean).join(".");
    return { pkg: b.pkg, path: path || "default", args: args(x!) };
  };

  const nameOf = (decl: Node) => { const id = decl.childForFieldName("name"); return id?.type === "identifier" ? id.text : undefined; };
  /** La racine d'une chaîne : client.db("app").collection("x") → client. */
  const rootOf = (n: Node | undefined): string | undefined => {
    let cur = unwrap(n);
    while (cur?.type === "call_expression" || cur?.type === "member_expression") cur = unwrap(cur.type === "call_expression" ? cur.childForFieldName("function") : cur.childForFieldName("object"));
    return cur?.type === "identifier" ? cur.text : undefined;
  };
  /** `X.collection("users")` : sa racine et le nom de la collection. */
  const collection = (n: Node | undefined): { root: string; name: string } | undefined => {
    const x = unwrap(n);
    if (x?.type !== "call_expression") return undefined;
    const fn = x.childForFieldName("function");
    if (fn?.type !== "member_expression" || fn.childForFieldName("property")?.text !== "collection") return undefined;
    const name = literal(args(x)[0]);
    const r = rootOf(fn.childForFieldName("object") ?? undefined);
    return name && r ? { root: r, name } : undefined;
  };

  /** Une connexion, et ses options quand elles sont écrites sur place, sans rien d'étalé. */
  const conn = (v: string, c: { pkg: string; path: string; args: Node[] }, at: number) => {
    out.push(fact("db_conn", [file.path, v, c.pkg, c.path, at], at));
    const objs = c.args.map((a) => unwrap(a)).filter((a) => a?.type === "object") as Node[];
    if (objs.length !== 1) return;
    const o = objs[0]!;
    if (o.namedChildren.some((p) => p.type === "spread_element")) return;
    out.push(fact("db_conn_opts", [file.path, at], at));
    for (const p of o.namedChildren) {
      const key = p.type === "pair" ? p.childForFieldName("key")?.text.replace(/['"]/g, "") : p.type === "shorthand_property_identifier" ? p.text : undefined;
      if (key) out.push(fact("db_conn_opt", [file.path, at, key, p.type === "pair" ? p.childForFieldName("value")?.text ?? "" : p.text], at));
    }
  };

  walkAll(root, (n) => {
    // Une connexion : gardée dans une variable, exportée par défaut, affectée, ou seulement ouverte.
    if (n.type === "variable_declarator") {
      const value = n.childForFieldName("value") ?? undefined;
      const v = nameOf(n);
      const c = creation(value);
      if (c) conn(v ?? "", c, line(n));
      const x = unwrap(value);
      const fn = x?.type === "call_expression" ? x.childForFieldName("function") : undefined;
      const from = fn?.type === "member_expression" ? unwrap(fn.childForFieldName("object")) : undefined;
      if (v && from?.type === "identifier" && DERIVE.has(fn!.childForFieldName("property")?.text ?? "")) out.push(fact("db_derive", [file.path, v, from.text, line(n)], line(n)));
      const coll = collection(value);
      if (v && coll) out.push(fact("db_coll", [file.path, v, coll.root, coll.name, line(n)], line(n)));
      return;
    }
    if (n.type === "export_statement" && n.text.startsWith("export default")) {
      const c = creation(n.namedChildren.at(-1));
      if (c) conn("default", c, line(n));
      return;
    }
    if (n.type === "assignment_expression") {
      const left = n.childForFieldName("left");
      const c = creation(n.childForFieldName("right") ?? undefined);
      if (c) conn(left?.type === "identifier" ? left.text : "", c, line(n));
      return;
    }
    if (n.type === "expression_statement") {
      const c = creation(n.namedChildren[0]);
      if (c) conn("", c, line(n));
    }

    // Postgres.js : sql`SELECT …`.
    if (n.type === "template_string" && n.parent?.type === "call_expression" && n.parent.childForFieldName("function")?.type === "identifier") {
      const tag = n.parent.childForFieldName("function")!.text;
      for (const t of named(sqlTables(n))) out.push(fact("db_query", [file.path, tag, t.op, t.name, line(n)], line(n)));
      return;
    }
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "member_expression") return;
    const method = fn.childForFieldName("property")?.text ?? "";
    const obj = unwrap(fn.childForFieldName("object"));
    const op = COLL_READ.has(method) ? "read" : COLL_WRITE.test(method) ? "write" : undefined;

    // Une requête SQL écrite : en texte, ou dans un objet { text } / { sql }.
    if (QUERY.has(method) && obj?.type === "identifier") {
      const sql = sqlText(args(n)[0]);
      if (sql !== undefined) for (const t of named(sqlTablesOfText(sql))) out.push(fact("db_query", [file.path, obj.text, t.op, t.name, line(n)], line(n)));
      return;
    }
    // Une collection : nommée sur place, ou gardée dans une variable.
    if (!op) return;
    const coll = collection(obj);
    if (coll) out.push(fact("db_coll_op", [file.path, coll.root, coll.name, op, line(n)], line(n)));
    else if (obj?.type === "identifier") out.push(fact("db_coll_var_op", [file.path, obj.text, op, line(n)], line(n)));
  });
  return out;
};

/** Le texte d'une requête : une chaîne, un gabarit sans substitution, ou la clé text / sql d'un objet. */
function sqlText(n: Node | undefined): string | undefined {
  const x = unwrap(n);
  if (x?.type !== "object") return literal(x);
  for (const p of x.namedChildren) {
    if (p.type !== "pair") continue;
    const key = p.childForFieldName("key")?.text.replace(/['"]/g, "");
    if (key === "text" || key === "sql") return literal(p.childForFieldName("value") ?? undefined);
  }
  return undefined;
}

const named = (ts: SqlTable[]) => ts.filter((t): t is { op: "read" | "write"; name: string } => "name" in t);
export default script;
