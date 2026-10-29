import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, resolveIdentifier, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";
import { codeFileCandidates, codeFilePath, dirOf } from "./runs.js";

/**
 * node-cron, d'après son inventaire (docs/fonctionnement/packs/node-cron.md).
 *
 * cron_task(Fichier, "lit"|"ref", Expression|Constante, Code, LigneCode, Ligne)  cron.schedule("0 8 * * *", fn), createTask(DAILY, fn)
 * cron_member(Fichier, Expression|Constante, Objet, Méthode)  le code est jobs.clean
 * cron_file(Fichier, Expression|Constante, Candidat)          une tâche en arrière-plan : un fichier, peut-être .ts à la place du .js écrit
 * cron_option(Fichier, Expression|Constante, Option, Valeur)  { timezone: "Europe/Paris", name: "x" }
 * cron_dynamic(Fichier, Ligne)                                l'expression est calculée : non lue
 */
const PLAN = new Set(["schedule", "createTask"]);

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;
  const fromCron = (id: string) => { const b = imports.get(id); return b !== undefined && packageName(b.raw) === "node-cron" ? b.imported : undefined; };

  walkAll(root, (n) => {
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    let planned = false;
    if (fn?.type === "member_expression") {
      const obj = unwrap(fn.childForFieldName("object"));
      const imported = obj?.type === "identifier" ? fromCron(obj.text) : undefined;
      planned = (imported === "*" || imported === "default") && PLAN.has(fn.childForFieldName("property")?.text ?? "");
    } else if (fn?.type === "identifier") {
      planned = PLAN.has(fromCron(fn.text) ?? "");
    }
    if (!planned) return;
    const a = args(n);
    const expr = exprOf(a[0]);
    if (!expr) { out.push(fact("cron_dynamic", [file.path, line(n)], line(n))); return; }
    const x = "lit" in expr ? expr.lit : expr.ref;
    const kind = "lit" in expr ? "lit" : "ref";
    const h = unwrap(a[1]);
    if (!h) return;
    const path = codeFilePath(h);
    if (path) {
      out.push(fact("cron_task", [file.path, kind, x, path, line(h), line(n)], line(n)));
      for (const c of codeFileCandidates(posix.join(dirOf(file.path), path))) out.push(fact("cron_file", [file.path, x, c], line(n)));
    } else {
      const code = wrapped(h);
      const sym = code.type === "identifier" || code.type === "member_expression" ? code.text : "";
      out.push(fact("cron_task", [file.path, kind, x, sym, line(code), line(n)], line(n)));
      if (code.type === "member_expression") {
        const o = unwrap(code.childForFieldName("object")), m = code.childForFieldName("property")?.text;
        if (o?.type === "identifier" && m) out.push(fact("cron_member", [file.path, x, o.text, m], line(n)));
      }
    }
    const opts = unwrap(a[2]);
    if (opts?.type === "object") for (const p of opts.namedChildren) {
      if (p.type !== "pair") continue;
      const k = p.childForFieldName("key")?.text.replace(/['"]/g, ""), v = literal(p.childForFieldName("value") ?? undefined);
      if (k && v !== undefined) out.push(fact("cron_option", [file.path, x, k, v], line(p)));
    }
  });
  return out;
};

/** L'expression : un texte écrit, une constante du fichier, ou une constante importée (jointe par les règles). */
function exprOf(n: Node | undefined): { lit: string } | { ref: string } | undefined {
  const x = unwrap(n);
  if (!x) return undefined;
  const lit = literal(x);
  if (lit !== undefined) return { lit };
  if (x.type !== "identifier") return undefined;
  const v = resolveIdentifier(x);
  const vl = v ? literal(unwrap(v)) : undefined;
  return vl !== undefined ? { lit: vl } : { ref: x.text };
}

/** Le code passé à une enveloppe : `safe(fn)`, `safe("nom", fn)` → `fn`, en descendant dans le dernier argument. */
function wrapped(n: Node): Node {
  let cur = n;
  for (let i = 0; i < 5 && cur.type === "call_expression"; i++) {
    const last = unwrap(args(cur).at(-1));
    if (!last) break;
    cur = last;
  }
  return cur;
}
export default script;
