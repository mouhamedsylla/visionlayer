import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";

/**
 * Zod pour l'environnement, d'après l'inventaire (docs/fonctionnement/packs/zod-env.md). Les noms seulement.
 *
 * env_key(Fichier, Schéma, Clé, "yes"|"no", Ligne)  une clé de premier niveau d'un objet Zod, obligatoire ou non
 * schema_uses(Fichier, Schéma, Autre)               base.extend(…), a.merge(b), z.object({ ...base.shape })
 * env_parse(Fichier, Schéma)                        schema.parse(process.env), safeParse, parseAsync ; import.meta.env, Bun.env
 *
 * Un schéma est nommé par sa variable, ou par sa ligne (`@12`) quand il est écrit là où il est validé.
 */
const PARSE = new Set(["parse", "safeParse", "parseAsync", "safeParseAsync"]);
const OBJECT = new Set(["object", "strictObject", "looseObject"]);
const KEEP = new Set(["refine", "superRefine", "transform", "strict", "passthrough", "strip", "catchall", "describe", "brand", "readonly", "check"]);
const OPTIONAL = new Set(["optional", "nullish", "default", "catch", "prefault"]);
const SOURCES = new Set(["process.env", "import.meta.env", "Bun.env"]);

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const isZod = (n: Node | undefined) => { const b = n?.type === "identifier" ? imports.get(n.text) : undefined; return b !== undefined && packageName(b.raw) === "zod"; };

  /** Les clés de premier niveau d'un objet de schémas, et ce qu'il étale (`...base.shape`). */
  const keys = (obj: Node | undefined, s: string) => {
    const o = unwrap(obj);
    if (o?.type !== "object") return;
    for (const p of o.namedChildren) {
      if (p.type === "pair") {
        const k = p.childForFieldName("key")?.text.replace(/['"]/g, "");
        if (k) out.push(fact("env_key", [file.path, s, k, optional(p.childForFieldName("value") ?? undefined) ? "no" : "yes", line(p)], line(p)));
      } else if (p.type === "spread_element") {
        let x = unwrap(p.namedChildren[0]);
        if (x?.type === "member_expression" && x.childForFieldName("property")?.text === "shape") x = unwrap(x.childForFieldName("object"));
        if (x?.type === "identifier") out.push(fact("schema_uses", [file.path, s, x.text], line(p)));
      }
    }
  };

  /** Un schéma : z.object(…), puis ce qui l'enrichit ou le compose, jusqu'à un autre schéma nommé. */
  const visit = (e: Node | undefined, s: string): boolean => {
    const x = unwrap(e);
    if (!x) return false;
    if (x.type === "identifier") { out.push(fact("schema_uses", [file.path, s, x.text], line(x))); return true; }
    if (x.type !== "call_expression") return false;
    const fn = unwrap(x.childForFieldName("function"));
    if (fn?.type !== "member_expression") return false;
    const obj = unwrap(fn.childForFieldName("object"));
    const prop = fn.childForFieldName("property")?.text ?? "";
    const a = args(x);
    if (isZod(obj) && OBJECT.has(prop)) { keys(a[0], s); return true; }
    if (isZod(obj)) return false;
    if (prop === "extend" || prop === "safeExtend") { keys(a[0], s); return visit(obj, s); }
    if (prop === "merge" || prop === "and") { visit(a[0], s); return visit(obj, s); }
    if (KEEP.has(prop)) return visit(obj, s);
    return false;
  };

  walkAll(root, (n) => {
    if (n.type === "variable_declarator") {
      const name = n.childForFieldName("name");
      const v = unwrap(n.childForFieldName("value"));
      // Un schéma nommé ; pas un simple alias, ni une validation (traitée plus bas).
      if (name?.type === "identifier" && v?.type === "call_expression") visit(v, name.text);
      return;
    }
    if (n.type !== "call_expression") return;
    const fn = unwrap(n.childForFieldName("function"));
    if (fn?.type !== "member_expression" || !PARSE.has(fn.childForFieldName("property")?.text ?? "")) return;
    if (!SOURCES.has(unwrap(args(n)[0])?.text ?? "")) return;
    const target = unwrap(fn.childForFieldName("object"));
    if (target?.type === "identifier") { out.push(fact("env_parse", [file.path, target.text], line(n))); return; }
    const s = `@${line(n)}`;
    if (visit(target, s)) out.push(fact("env_parse", [file.path, s], line(n)));
  });

  /** Facultative : .optional(), .nullish(), .default(), .catch(), .prefault(), z.optional(…), où qu'ils soient dans la chaîne. */
  function optional(v: Node | undefined): boolean {
    let cur = unwrap(v);
    while (cur?.type === "call_expression") {
      const fn = unwrap(cur.childForFieldName("function"));
      if (fn?.type !== "member_expression") return false;
      const prop = fn.childForFieldName("property")?.text ?? "";
      const obj = unwrap(fn.childForFieldName("object"));
      if (OPTIONAL.has(prop)) return true;
      if (isZod(obj)) return false;
      cur = obj;
    }
    return false;
  }
  return out;
};
export default script;
