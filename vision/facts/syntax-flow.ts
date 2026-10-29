import type { Value } from "./datalog.js";
import { topLevelFunctions, walkAll, type Node } from "../arch/ast.js";
import type { FileFact } from "./types.js";

/**
 * Ce que la syntaxe dit du déroulé d'une fonction de premier niveau, sans
 * rien savoir d'un framework. `Fn` est la première ligne de la fonction,
 * comme dans `fn_span`.
 *
 *   fn_param(Fichier, Fn, Rang, Nom)                    (req, res) → (0, "req"), (1, "res")
 *   fn_calls(Fichier, Fn, Appelé, Ligne, Condition)     requireUser(req) dans la fonction ; la condition du `if`
 *                                                       ou du `case` qui l'entoure, "" sinon
 *   throws(Fichier, Fn, Ligne, Classe, Code, Texte, Condition, Contexte)
 *                                                       if (booking.status !== "pending") throw new HttpError(409, "not_pending")
 *                                                       → ("HttpError", "409", "not_pending", "booking.status !== \"pending\"", "if") ;
 *                                                       Contexte "catch" dans un catch ou un .catch(() => …), "" sinon
 *   returns_early(Fichier, Fn, Ligne, Condition)        if (existing) { …; return res.json(…) } : un retour avant la fin
 *   param_call(Fichier, Fn, Rang, Chemin, Nombre, Ligne) res.status(409).json(…) → (1, "status.json", "409") :
 *                                                       un appel sur un paramètre, le premier nombre écrit en argument
 *   note(Fichier, Fn, Début, Fin, Texte)                // un commentaire dans la fonction, rattaché à l'instruction
 *                                                       qui le suit (ses lignes Début à Fin)
 */

const COND_MAX = 120;

const condText = (n: Node) => {
  const inner = n.type === "parenthesized_expression" ? n.namedChildren[0] ?? n : n;
  const t = inner.text.replace(/\s+/g, " ").trim();
  return t.length > COND_MAX ? "" : t;
};

/**
 * Le `if` dont `n` est dans la branche « alors », ou le `case` qui le contient
 * (sans traverser une autre fonction) : sa condition, `event.type === "payment_intent.succeeded"`.
 */
function enclosingIf(n: Node, fn: Node, cases = true): string {
  for (let cur: Node | null = n, up = n.parent; up && up.startIndex >= fn.startIndex && !isFn(up); cur = up, up = up.parent) {
    if (up.type === "if_statement" && up.childForFieldName("consequence")?.startIndex === cur!.startIndex) return condText(up.childForFieldName("condition")!);
    if (up.type === "switch_case") {
      if (!cases) return "";
      const value = up.childForFieldName("value");
      const subject = up.parent?.parent?.childForFieldName("value");
      return value && subject ? condText({ ...subject, text: `${condText(subject)} === ${value.text}` } as Node) : "";
    }
  }
  return "";
}

const isFn = (n: Node) => ["arrow_function", "function_expression", "function_declaration", "function", "method_definition"].includes(n.type);

/** Dans un `catch`, ou dans la fonction passée à `.catch(…)`. */
function inCatch(n: Node, fn: Node): boolean {
  for (let up = n.parent; up && up.startIndex >= fn.startIndex && up !== fn; up = up.parent) {
    if (up.type === "catch_clause") return true;
    if (isFn(up)) {
      const call = up.parent?.parent;
      const callee = call?.type === "call_expression" ? call.childForFieldName("function") : null;
      if (callee?.type === "member_expression" && callee.childForFieldName("property")?.text === "catch") return true;
    }
  }
  return false;
}

const strip = (c: string) => c.replace(/^\/\/+\s?|^\/\*+\s?|\s?\*+\/$/g, "").replace(/^\s*\*\s?/gm, "").trim();

export function flowFacts(path: string, root: Node, fact: (rel: string, args: Value[], line: number) => FileFact): FileFact[] {
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  for (const [, fn] of topLevelFunctions(root, true)) {
    const at = line(fn);
    const params = (fn.childForFieldName("parameters")?.namedChildren ?? []).map((p) => (p.childForFieldName("pattern") ?? p).text);
    if (!params.length && fn.childForFieldName("parameter")) params.push(fn.childForFieldName("parameter")!.text);
    params.forEach((name, i) => /^[A-Za-z_$][\w$]*$/.test(name) && out.push(fact("fn_param", [path, at, i, name], at)));

    const body = fn.childForFieldName("body");
    if (!body) continue;
    let pending: Node[] = [];
    walkAll(body, (n) => {
      if (n.type === "comment") { pending.push(n); return; }
      if (pending.length && n.parent && /statement|declaration|^expression_statement$/.test(n.type)) {
        const text = pending.map((c) => strip(c.text)).filter(Boolean).join(" ");
        if (text) out.push(fact("note", [path, at, line(n), n.endPosition.row + 1, text], line(pending[0]!)));
        pending = [];
      }
      if (n.type === "call_expression") {
        const callee = n.childForFieldName("function");
        if (callee?.type === "identifier") out.push(fact("fn_calls", [path, at, callee.text, line(n), enclosingIf(n, fn)], line(n)));
        paramCall(n, params, (i, chain, num) => out.push(fact("param_call", [path, at, i, chain, num, line(n)], line(n))));
      }
      if (n.type === "throw_statement") {
        const made = n.namedChildren[0];
        const ctor = made?.type === "new_expression" ? made.childForFieldName("constructor")?.text ?? "" : "";
        const args = made?.type === "new_expression" ? made.childForFieldName("arguments")?.namedChildren ?? [] : [];
        const code = args.find((a) => a.type === "number")?.text ?? "";
        const str = args.find((a) => a.type === "string")?.text.slice(1, -1) ?? "";
        const ctx = inCatch(n, fn) ? "catch" : enclosingIf(n, fn) ? "if" : "";
        out.push(fact("throws", [path, at, line(n), ctor, code, str, enclosingIf(n, fn), ctx], line(n)));
      }
      if (n.type === "return_statement") {
        // Un `return` dans un `case` termine la branche, pas la fonction avant l'heure.
        const cond = enclosingIf(n, fn, false);
        if (cond) out.push(fact("returns_early", [path, at, line(n), cond], line(n)));
      }
    });
  }
  return out;
}

/** `res.status(409).json(…)` sur le paramètre `res` : son rang, `status.json`, et `409`. Seulement l'appel le plus extérieur. */
function paramCall(n: Node, params: string[], emit: (i: number, chain: string, num: string) => void): void {
  const up = n.parent;
  if (up?.type === "member_expression" && up.parent?.type === "call_expression") return;
  const parts: string[] = [];
  let num = "";
  let cur: Node | null = n;
  while (cur?.type === "call_expression") {
    const callee: Node | null = cur.childForFieldName("function");
    if (callee?.type !== "member_expression") return;
    const first = cur.childForFieldName("arguments")?.namedChildren[0];
    if (first?.type === "number") num = first.text;
    parts.unshift(callee.childForFieldName("property")?.text ?? "");
    cur = callee.childForFieldName("object");
  }
  const i = cur?.type === "identifier" ? params.indexOf(cur.text) : -1;
  if (i >= 0) emit(i, parts.join("."), num);
}
