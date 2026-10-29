import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { args, literal, unwrap, type Node } from "../arch/ast.js";
import { packageName } from "../stack/build.js";
import { collectionOf, splitPath } from "./firestore-path.js";

/**
 * Les fonctions exportées d'une codebase Cloud Functions, d'après l'API
 * documentée (https://firebase.google.com/docs/functions) :
 *
 *   v2   onCall, onRequest, onSchedule, onTaskDispatched, onDocumentCreated…,
 *        onObjectFinalized…, onMessagePublished, onValueWritten…, beforeUserCreated…
 *   v1   functions.https.onCall, functions.firestore.document(p).onCreate,
 *        functions.pubsub.schedule(s).onRun, functions.pubsub.topic(t).onPublish,
 *        functions.storage.object().onFinalize, functions.auth.user().onCreate,
 *        functions.database.ref(p).onWrite, functions.tasks.taskQueue().onDispatch
 *
 * Exportées par `export const x = …`, `export { x }` ou `exports.x = …`. Le nom
 * exporté est le nom déployé, donc la clé du point d'entrée.
 *
 * entrypoint(Fichier, Genre, Nom, Code, Ligne)
 * trigger_on(Fichier, Nom, Tech, Cible)   ce qui déclenche la fonction : une collection, un topic, une file
 * channel_topic(Fichier, Topic, Tech)     un topic Pub/Sub, une file de tâches
 * schedule(Fichier, Nom, Expression)
 */
type Kind = "rpc" | "http" | "schedule" | "message" | "event";

const script: PackScript = ({ file, root, imports, fact }) => {
  if (!root || !imports) return [];
  const fromFunctions = (id: string) => {
    const b = imports.get(id);
    return b !== undefined && packageName(b.raw) === "firebase-functions";
  };
  const out: FileFact[] = [];
  const line = (n: Node) => n.startPosition.row + 1;

  // Les déclarations du fichier, puis ce qui est exporté.
  const decls = new Map<string, Node>();
  const exported: [string, Node, Node][] = [];
  const named = new Set<string>();
  for (const stmt of root.namedChildren) {
    const isExport = stmt.type === "export_statement";
    const decl = isExport ? stmt.childForFieldName("declaration") : stmt;
    if (decl && (decl.type === "lexical_declaration" || decl.type === "variable_declaration")) {
      for (const d of decl.namedChildren) {
        const name = d.childForFieldName("name");
        const value = d.childForFieldName("value");
        if (name?.type !== "identifier" || !value) continue;
        decls.set(name.text, d);
        if (isExport) exported.push([name.text, value, d]);
      }
    }
    if (isExport && !decl && !stmt.childForFieldName("source")) {
      for (const spec of stmt.namedChildren.find((c) => c.type === "export_clause")?.namedChildren ?? []) {
        const local = spec.childForFieldName("name")?.text;
        if (local) named.add(`${local}\0${spec.childForFieldName("alias")?.text ?? local}`);
      }
    }
    // exports.x = …, module.exports.x = …
    if (stmt.type === "expression_statement") {
      const a = stmt.namedChildren[0];
      if (a?.type !== "assignment_expression") continue;
      const left = a.childForFieldName("left");
      const right = a.childForFieldName("right");
      if (left?.type !== "member_expression" || !right) continue;
      const obj = left.childForFieldName("object")?.text;
      const prop = left.childForFieldName("property")?.text;
      if (prop && (obj === "exports" || obj === "module.exports")) exported.push([prop, right, stmt]);
    }
  }
  for (const k of named) {
    const [local, alias] = k.split("\0") as [string, string];
    const d = decls.get(local);
    const v = d?.childForFieldName("value");
    if (d && v) exported.push([alias, v, d]);
  }

  for (const [name, value, at] of exported) {
    const call = unwrap(value);
    if (call?.type !== "call_expression") continue;
    const chain = chainOf(call);
    if (!chain || !fromFunctions(chain.root)) continue;
    const t = classify(chain.calls);
    if (!t) continue;
    const handler = unwrap(args(call).at(-1));
    const symbol = handler?.type === "identifier" ? handler.text : name;
    const hline = handler?.type === "identifier" ? line(at) : line(handler ?? at);
    out.push(fact("entrypoint", [file.path, t.kind, name, symbol, hline], line(at)));
    if (t.schedule) out.push(fact("schedule", [file.path, name, t.schedule], line(at)));
    if (t.tech === "pubsub" || t.tech === "cloudtasks") {
      const topic = t.target ?? name;
      out.push(fact("channel_topic", [file.path, topic, t.tech], line(at)));
      out.push(fact("trigger_on", [file.path, name, t.tech, topic], line(at)));
    } else if (t.tech) out.push(fact("trigger_on", [file.path, name, t.tech, t.target ?? ""], line(at)));
  }
  return out;
};

interface Call { name: string; args: Node[] }

/** `functions.region("x").firestore.document("p").onCreate(h)` → racine `functions`, appels et propriétés dans l'ordre. */
function chainOf(call: Node): { root: string; calls: Call[] } | undefined {
  const calls: Call[] = [];
  let cur: Node | null = call;
  for (let i = 0; cur && i < 12; i++) {
    if (cur.type === "call_expression") {
      const fn: Node | null = cur.childForFieldName("function");
      const a = args(cur);
      if (fn?.type === "identifier") { calls.unshift({ name: fn.text, args: a }); return { root: fn.text, calls }; }
      if (fn?.type !== "member_expression") return undefined;
      calls.unshift({ name: fn.childForFieldName("property")?.text ?? "", args: a });
      cur = fn.childForFieldName("object");
    } else if (cur.type === "member_expression") {
      calls.unshift({ name: cur.childForFieldName("property")?.text ?? "", args: [] });
      cur = cur.childForFieldName("object");
    } else if (cur.type === "identifier") {
      return { root: cur.text, calls };
    } else return undefined;
  }
  return undefined;
}

/** Valeur d'un argument : une chaîne, ou la propriété `key` d'un objet d'options. */
function option(a: Node[], key: string): string | undefined {
  const first = unwrap(a[0]);
  if (!first) return undefined;
  const lit = literal(first);
  if (lit !== undefined) return lit;
  if (first.type !== "object") return undefined;
  for (const p of first.namedChildren) {
    if (p.type === "pair" && p.childForFieldName("key")?.text.replace(/['"]/g, "") === key) return literal(p.childForFieldName("value") ?? undefined);
  }
  return undefined;
}

function classify(calls: Call[]): { kind: Kind; tech?: string; target?: string; schedule?: string } | undefined {
  const last = calls.at(-1);
  if (!last) return undefined;
  const m = last.name;
  const seg = (n: string) => calls.find((c) => c.name === n);
  const doc = (p: string | undefined) => (p ? collectionOf(splitPath(p)) : undefined);

  // v2
  if (m === "onCall" || m === "onCallGenkit") return { kind: "rpc" };
  if (m === "onRequest") return { kind: "http" };
  if (m === "onSchedule") return { kind: "schedule", schedule: option(last.args, "schedule") };
  if (m === "onTaskDispatched") return { kind: "message", tech: "cloudtasks" };
  if (/^onDocument(Created|Updated|Deleted|Written)(WithAuthContext)?$/.test(m)) return { kind: "event", tech: "firestore", target: doc(option(last.args, "document")) };
  if (/^onObject(Finalized|Deleted|Archived|MetadataUpdated)$/.test(m)) return { kind: "event", tech: "firebasestorage", target: option(last.args, "bucket") };
  if (m === "onMessagePublished") return { kind: "message", tech: "pubsub", target: option(last.args, "topic") };
  if (/^onValue(Created|Updated|Deleted|Written)$/.test(m)) return { kind: "event", tech: "firebasedatabase", target: option(last.args, "ref") };
  if (/^before(User\w+|Email\w+|Sms\w+)$/.test(m)) return { kind: "event", tech: "firebaseauth" };

  // v1
  if (seg("https") && m === "onCall") return { kind: "rpc" };
  if (seg("https") && m === "onRequest") return { kind: "http" };
  if (seg("schedule") && m === "onRun") return { kind: "schedule", schedule: literal(seg("schedule")!.args[0]) };
  if (seg("topic") && m === "onPublish") return { kind: "message", tech: "pubsub", target: literal(seg("topic")!.args[0]) };
  if (seg("taskQueue") && m === "onDispatch") return { kind: "message", tech: "cloudtasks" };
  if (seg("document") && /^on(Create|Update|Delete|Write)$/.test(m)) return { kind: "event", tech: "firestore", target: doc(literal(seg("document")!.args[0])) };
  if (seg("object") && /^on(Finalize|Delete|Archive|MetadataUpdate)$/.test(m)) return { kind: "event", tech: "firebasestorage", target: seg("bucket") ? literal(seg("bucket")!.args[0]) : undefined };
  if (seg("user") && seg("auth") && /^on(Create|Delete)$/.test(m)) return { kind: "event", tech: "firebaseauth" };
  if (seg("ref") && seg("database") && /^on(Create|Update|Delete|Write)$/.test(m)) return { kind: "event", tech: "firebasedatabase", target: literal(seg("ref")!.args[0]) };
  if (/^before(Create|SignIn)$/.test(m)) return { kind: "event", tech: "firebaseauth" };

  // Les autres déclencheurs documentés (alertes, Remote Config, Test Lab, Eventarc).
  if (/^on[A-Z]\w+$/.test(m)) return { kind: "event" };
  return undefined;
}
export default script;
