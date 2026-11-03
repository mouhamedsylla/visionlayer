import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, isFunction, literal, returnedExpressions, unwrap, walkAll, type Node } from "../arch/ast.js";

/**
 * Le client Prisma dans le code, d'après docs/fonctionnement/packs/prisma.md (formes C1 à C5).
 * Les écritures ne comptent que pour un modèle déclaré dans un schéma Prisma (règles du pack).
 *
 * prisma_set(Fichier, Entité, Champ, Valeur, Ligne)   x.order.create({ data: { status: "PENDING" } }) : une valeur littérale
 * prisma_set_any(Fichier, Entité, Champ, Ligne)       data: { status }, data: { stock: { decrement: n } } : une valeur calculée
 * tx_span(Fichier, Début, Fin)                        x.$transaction(async (tx) => …), x.$transaction([…]) : les lignes protégées
 */
const WRITES = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert"]);
const NUMBER = /^-?\d+(\.\d+)?$/;

const script: PackScript = ({ file, root, fact }) => {
  if (!root) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;

  /** Les objets écrits : un objet, chaque objet d'un tableau, l'objet que rend la fonction d'un .map(…). */
  const objectsOf = (v: Node | undefined): Node[] => {
    const n = unwrap(v);
    if (!n) return [];
    if (n.type === "object") return [n];
    if (n.type === "array") return n.namedChildren.flatMap((c) => objectsOf(c));
    if (n.type === "call_expression") {
      const fn = n.childForFieldName("function");
      const cb = unwrap(args(n)[0]);
      if (fn?.type === "member_expression" && fn.childForFieldName("property")?.text === "map" && cb && isFunction(cb)) return returnedExpressions(cb).flatMap((r) => objectsOf(r));
    }
    return [];
  };

  const fields = (entity: string, obj: Node) => {
    for (const p of obj.namedChildren) {
      if (p.type === "shorthand_property_identifier") { out.push(fact("prisma_set_any", [file.path, entity, p.text, line(p)], line(p))); continue; }
      if (p.type !== "pair") continue;
      const key = p.childForFieldName("key")?.text.replace(/['"]/g, "");
      if (!key) continue;
      const value = unwrap(p.childForFieldName("value"));
      const lit = literal(value) ?? (value && (NUMBER.test(value.text) || value.text === "true" || value.text === "false") ? value.text : undefined);
      if (lit !== undefined) out.push(fact("prisma_set", [file.path, entity, key, lit, line(p)], line(p)));
      else out.push(fact("prisma_set_any", [file.path, entity, key, line(p)], line(p)));
    }
  };

  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "member_expression") return;
    const op = fn.childForFieldName("property")?.text ?? "";
    if (op === "$transaction") {
      const a = unwrap(args(n)[0]);
      if (a && (isFunction(a) || a.type === "array")) out.push(fact("tx_span", [file.path, line(a), a.endPosition.row + 1], line(n)));
      return;
    }
    if (!WRITES.has(op)) return;
    const model = fn.childForFieldName("object");
    if (model?.type !== "member_expression") return;
    const entity = model.childForFieldName("property")?.text;
    const arg = unwrap(args(n)[0]);
    if (!entity || arg?.type !== "object") return;
    for (const p of arg.namedChildren) {
      if (p.type !== "pair") continue;
      const key = p.childForFieldName("key")?.text;
      if (key === "data" || (op === "upsert" && (key === "create" || key === "update"))) for (const o of objectsOf(p.childForFieldName("value") ?? undefined)) fields(entity, o);
    }
  });
  return out;
};

export default script;
