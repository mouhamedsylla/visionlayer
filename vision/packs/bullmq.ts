import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, resolveIdentifier, unwrap, walkAll, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";
import { codeFileCandidates, codeFilePath, dirOf } from "./runs.js";

/**
 * BullMQ, d'après son inventaire (docs/fonctionnement/packs/bullmq.md).
 *
 * queue_def(Fichier, Variable, File)          const emails = new Queue("emails")
 * queue_def_ref(Fichier, Variable, Constante) new Queue(EMAIL_QUEUE) : le nom vient d'une constante, peut-être importée
 * worker_new(Fichier, File, Code, LigneCode, Ligne)       new Worker("emails", sendEmail)
 * worker_ref(Fichier, Constante, Code, LigneCode, Ligne)  new Worker(EMAIL_QUEUE, …)
 * worker_file(Fichier, File, Candidat)        un processeur isolé : un fichier, peut-être .ts à la place du .js écrit
 * flow_def(Fichier, Variable)                 const flow = new FlowProducer()
 * flow_job(Fichier, Variable, File, Ligne)    flow.add({ queueName: "orders", children: [{ queueName: "mails" }] })
 * job_schedule(Fichier, Variable, Rythme, Ligne)  add(…, { repeat: { pattern } }), upsertJobScheduler(…, { every })
 */
const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const fromBull = (id: string, name: string) => { const b = imports.get(id); return b !== undefined && packageName(b.raw) === "bullmq" && b.imported === name; };
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;

  walkAll(root, (n) => {
    if (n.type === "new_expression") {
      const ctor = n.childForFieldName("constructor");
      if (ctor?.type !== "identifier") return;
      const a = args(n);
      const decl = n.parent?.type === "variable_declarator" ? n.parent.childForFieldName("name")?.text : undefined;
      if (fromBull(ctor.text, "Queue") && decl) {
        const name = nameOf(a[0]);
        if (name && "lit" in name) out.push(fact("queue_def", [file.path, decl, name.lit], line(n)));
        else if (name) out.push(fact("queue_def_ref", [file.path, decl, name.ref], line(n)));
      }
      if (fromBull(ctor.text, "FlowProducer") && decl) out.push(fact("flow_def", [file.path, decl], line(n)));
      if (fromBull(ctor.text, "Worker")) {
        const given = unwrap(a[0]);
        const h = unwrap(a[1]);
        if (!given || !h) return;
        // Un nom calculé (`job.name`) reste une file consommée : on garde ce qui est écrit.
        const name = nameOf(a[0]) ?? { ref: given.text };
        const processor = codeFilePath(h);
        const sym = processor ?? (h.type === "identifier" ? h.text : "");
        const hl = line(h);
        if ("lit" in name) out.push(fact("worker_new", [file.path, name.lit, sym, hl, line(n)], line(n)));
        else out.push(fact("worker_ref", [file.path, name.ref, sym, hl, line(n)], line(n)));
        if (processor) {
          const topic = "lit" in name ? name.lit : name.ref;
          for (const c of codeFileCandidates(posix.join(dirOf(file.path), processor))) out.push(fact("worker_file", [file.path, topic, c], line(n)));
        }
      }
      return;
    }
    if (n.type !== "call_expression") return;
    const fn = n.childForFieldName("function");
    if (fn?.type !== "member_expression") return;
    const obj = unwrap(fn.childForFieldName("object"));
    const method = fn.childForFieldName("property")?.text;
    if (obj?.type !== "identifier") return;
    const a = args(n);
    if (method === "add" || method === "addBulk") {
      // Un flux : chaque queueName du parent et de ses enfants.
      walkAll(a[0] ?? n, (x) => {
        if (x.type !== "pair" || x.childForFieldName("key")?.text.replace(/['"]/g, "") !== "queueName") return;
        const q = literal(x.childForFieldName("value") ?? undefined);
        if (q) out.push(fact("flow_job", [file.path, obj.text, q, line(x)], line(n)));
      });
      const repeat = findPair(a[2], "repeat");
      const pattern = repeat ? literal(findPair(repeat, "pattern")) ?? findPair(repeat, "every")?.text : undefined;
      if (pattern) out.push(fact("job_schedule", [file.path, obj.text, pattern, line(n)], line(n)));
    }
    if (method === "upsertJobScheduler") {
      const pattern = literal(findPair(a[1], "pattern")) ?? findPair(a[1], "every")?.text;
      if (pattern) out.push(fact("job_schedule", [file.path, obj.text, pattern, line(n)], line(n)));
    }
  });
  return out;
};

/** Le nom d'une file : un texte écrit, une constante du fichier, ou une constante importée (jointe par les règles). */
function nameOf(n: Node | undefined): { lit: string } | { ref: string } | undefined {
  const x = unwrap(n);
  if (!x) return undefined;
  const lit = literal(x);
  if (lit !== undefined) return { lit };
  if (x.type !== "identifier") return undefined;
  const v = resolveIdentifier(x);
  const vl = v ? literal(unwrap(v)) : undefined;
  return vl !== undefined ? { lit: vl } : { ref: x.text };
}

function findPair(n: Node | undefined, key: string): Node | undefined {
  const x = unwrap(n);
  if (x?.type !== "object") return undefined;
  for (const p of x.namedChildren) if (p.type === "pair" && p.childForFieldName("key")?.text.replace(/['"]/g, "") === key) return p.childForFieldName("value") ?? undefined;
  return undefined;
}
export default script;
