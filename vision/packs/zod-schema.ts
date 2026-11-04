import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, importBindings, literal, unwrap, walkAll, type Node } from "../arch/ast.js";

/**
 * Zod pour les données reçues : les champs d'un schéma, d'après la documentation de Zod (docs/fonctionnement/packs/zod-schema.md).
 *
 * schema_def(Fichier, Schéma)                                const s = z.object({ … })
 * schema_field(Fichier, Schéma, Champ, Type, yes|no, Ligne)  name: z.string().min(1) → "string, min 1", requis
 * schema_parse(Fichier, Schéma, Ligne, body|query|params)                       s.parse(req.body), s.safeParse(request.body) dans une fonction
 */
const OBJECT = new Set(["object", "strictObject", "looseObject"]);
const OPTIONAL = new Set(["optional", "nullish", "default", "catch", "prefault"]);
const PARSE = new Set(["parse", "safeParse", "parseAsync", "safeParseAsync"]);
const SHOWN = new Set(["min", "max", "length", "email", "url", "uuid", "regex", "int", "positive", "nullable"]);

/** La chaîne d'appels d'une expression : `z.string().min(1)` → racine `z`, [string(), min(1)]. */
function chainOf(n: Node | undefined): { root?: Node; calls: { name: string; node: Node }[] } {
  const calls: { name: string; node: Node }[] = [];
  let cur = unwrap(n);
  while (cur) {
    if (cur.type === "call_expression") {
      const f = cur.childForFieldName("function");
      if (f?.type === "member_expression") { calls.unshift({ name: f.childForFieldName("property")?.text ?? "", node: cur }); cur = f.childForFieldName("object") ?? undefined; continue; }
      return { calls };
    }
    if (cur.type === "member_expression") { cur = cur.childForFieldName("object") ?? undefined; continue; }
    return { ...(cur.type === "identifier" ? { root: cur } : {}), calls };
  }
  return { calls };
}

function describe(n: Node | undefined): { type: string; required: boolean } {
  const { root, calls } = chainOf(n);
  const isZod = root?.text === "z" || root?.text === "zod";
  const head = isZod ? calls[0] : undefined;
  const rest = isZod ? calls.slice(1) : calls;
  let type = isZod ? head?.name ?? "?" : root?.text ?? "?";
  if (head?.name === "array") type = `${describe(args(head.node)[0]).type}[]`;
  if (head?.name === "enum") {
    const list = unwrap(args(head.node)[0]);
    const values = list?.type === "array" ? list.namedChildren.map((x) => literal(x) ?? x.text) : [];
    type = values.length ? `enum(${values.slice(0, 4).join(", ")}${values.length > 4 ? `, +${values.length - 4}` : ""})` : "enum";
  }
  if (isZod && OBJECT.has(type)) type = "object";
  let required = true;
  const notes: string[] = [];
  for (const c of rest) {
    if (OPTIONAL.has(c.name)) required = false;
    if (c.name === "default") notes.push(`défaut ${args(c.node)[0]?.text ?? ""}`);
    if (SHOWN.has(c.name)) { const a = args(c.node)[0]; notes.push(a && c.name !== "regex" ? `${c.name} ${a.text}` : c.name); }
    if (c.name === "array") type = `${type}[]`;
  }
  return { type: [type, ...notes].join(", "), required };
}

const script: PackScript = ({ file, root, fact }) => {
  if (!root) return [];
  const bindings = importBindings(root);
  const zod = [...bindings].filter(([, v]) => v.raw === "zod").map(([k]) => k);
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  walkAll(root, (n) => {
    if (n.type === "variable_declarator" && zod.length) {
      const name = n.childForFieldName("name");
      const { root: r, calls } = chainOf(n.childForFieldName("value") ?? undefined);
      if (name?.type !== "identifier" || !r || !zod.includes(r.text) || !OBJECT.has(calls[0]?.name ?? "")) return;
      const obj = unwrap(args(calls[0]!.node)[0]);
      if (obj?.type !== "object") return;
      out.push(fact("schema_def", [file.path, name.text], line(n)));
      for (const p of obj.namedChildren) {
        if (p.type !== "pair") continue;
        const key = p.childForFieldName("key")?.text.replace(/['"]/g, "");
        if (!key) continue;
        const d = describe(p.childForFieldName("value") ?? undefined);
        out.push(fact("schema_field", [file.path, name.text, key, d.type, d.required ? "yes" : "no", line(p)], line(p)));
      }
      return;
    }
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "member_expression" || !PARSE.has(fn.childForFieldName("property")?.text ?? "")) return;
    const given = args(n)[0]?.text ?? "";
    const { root: r } = chainOf(fn.childForFieldName("object") ?? undefined);
    const part = /\bbody\b/.test(given) ? "body" : /\bquery\b/.test(given) ? "query" : /\bparams\b/.test(given) ? "params" : "";
    if (r && part) out.push(fact("schema_parse", [file.path, r.text, line(n), part], line(n)));
  });
  return out;
};

export default script;
