import type { Proof } from "../arch/types.js";
import type { Tuple, Value } from "./datalog.js";
import { methodResolver } from "./methods.js";

/**
 * Le graphe d'exécution du dépôt, au niveau des fonctions de premier niveau :
 * qui appelle qui, d'après la syntaxe seule. Il sert à dire ce qu'un point
 * d'entrée exécute vraiment (sa portée), et à regrouper les fichiers d'un
 * déployable en composants.
 *
 * Un nœud est une fonction (`fichier:première ligne`, l'`id` d'une
 * `CodeFunction`). Trois formes d'appel en partent, toutes résolues jusqu'à
 * une déclaration du dépôt (`resolves`) :
 *
 *   fn_calls(F, Fn, Nom, L)              `price(items)` : la fonction appelée ;
 *   member_call(F, Racine, Chemin, L)    `db.select()`, `wallet.debit()` : si la racine est une fonction, elle ;
 *                                         sinon une valeur de premier niveau (un client, un objet, une classe) :
 *                                         son fichier est exécuté, sans fonction précise ;
 *   instantiates(F, Fn, Classe, L)       `new SmtpSender()` : le fichier de la classe.
 *
 * Ce qui n'est pas vu : une fonction passée en valeur (`items.map(format)`),
 * ou à travers une variable locale qu'aucun type ne nomme. Les méthodes des classes sont des fonctions
 * (`Classe.méthode`), reliées par methods.ts.
 */

export interface FnSpan { path: string; name: string; start: number; end: number }

/** Un appel d'une fonction vers une autre fonction (`to`) ou vers un fichier exécuté par sa valeur (`file`). */
export interface FnCall { to?: string; file?: string; proof: Proof }

export interface FnGraph {
  /** Les fonctions de chaque fichier, dans l'ordre des lignes. */
  spans: Map<string, FnSpan[]>;
  /** Une fonction par son id. */
  byId: Map<string, FnSpan>;
  /** Ce que chaque fonction appelle, par son id. */
  calls: Map<string, FnCall[]>;
  /** Les fichiers de test : jamais du code du produit. */
  tests: Set<string>;
  /** La fonction qui contient une ligne. */
  enclosing(path: string, line: number): FnSpan | undefined;
}

export const fnId = (sp: FnSpan) => `${sp.path}:${sp.start}`;

export function fnGraph(rows: (rel: string) => readonly Tuple[]): FnGraph {
  const s = (v: Value | undefined) => String(v);
  const spans = new Map<string, FnSpan[]>();
  for (const t of rows("fn_span")) {
    const sp: FnSpan = { path: s(t.args[0]), name: s(t.args[1]), start: Number(t.args[2]), end: Number(t.args[3]) };
    (spans.get(sp.path) ?? spans.set(sp.path, []).get(sp.path)!).push(sp);
  }
  for (const list of spans.values()) list.sort((a, b) => a.start - b.start);
  const byId = new Map([...spans.values()].flat().map((sp) => [fnId(sp), sp]));
  const enclosing = (path: string, line: number) => spans.get(path)?.find((sp) => sp.start <= line && sp.end >= line);
  const resolves = new Map<string, { path: string; line: number }>();
  for (const t of rows("resolves")) {
    const k = `${s(t.args[0])}\0${s(t.args[1])}`;
    if (!resolves.has(k)) resolves.set(k, { path: s(t.args[2]), line: Number(t.args[3]) });
  }
  const proofOf = (t: Tuple, path: string, line: number): Proof => t.proof.find((p) => p.line === line) ?? t.proof[0] ?? { path, line, source: "syntax" };
  const calls = new Map<string, FnCall[]>();
  const add = (from: FnSpan | undefined, call: FnCall) => {
    if (!from) return;
    const id = fnId(from);
    if (call.to === id) return;
    (calls.get(id) ?? calls.set(id, []).get(id)!).push(call);
  };
  // Le nom résolu : la fonction qui le déclare, ou, pour une valeur de premier niveau, son fichier.
  const target = (path: string, name: string): Omit<FnCall, "proof"> | undefined => {
    const to = resolves.get(`${path}\0${name}`);
    if (!to) return undefined;
    const sp = enclosing(to.path, to.line);
    return sp ? { to: fnId(sp) } : { file: to.path };
  };

  for (const t of rows("fn_calls")) {
    const [path, start, callee, line] = [s(t.args[0]), Number(t.args[1]), s(t.args[2]), Number(t.args[3])];
    const to = resolves.get(`${path}\0${callee}`);
    const sp = to && enclosing(to.path, to.line);
    if (sp) add(spans.get(path)?.find((x) => x.start === start), { to: fnId(sp), proof: proofOf(t, path, line) });
  }
  const methodOf = methodResolver(rows);
  for (const t of rows("member_call")) {
    const [path, root, chain, line] = [s(t.args[0]), s(t.args[1]), s(t.args[2]), Number(t.args[3])];
    // Une méthode d'une classe du dépôt (methods.ts) : la méthode elle-même, pas seulement le fichier de la classe.
    const m = methodOf(path, line, root, chain);
    if (m) { add(enclosing(path, line), { to: `${m.path}:${m.start}`, proof: proofOf(t, path, line) }); continue; }
    const to = target(path, root);
    // Une valeur du même fichier (`const queue = new Queue()` puis `queue.add()`) n'apprend rien de plus.
    if (to && to.file !== path) add(enclosing(path, line), { ...to, proof: proofOf(t, path, line) });
  }
  for (const t of rows("instantiates")) {
    const [path, cls, line] = [s(t.args[0]), s(t.args[2]), Number(t.args[3])];
    const to = target(path, cls);
    if (to && to.file !== path) add(enclosing(path, line), { ...to, proof: proofOf(t, path, line) });
  }
  const tests = new Set(rows("test_file").map((t) => s(t.args[0])));
  return { spans, byId, calls, tests, enclosing };
}

/** Ce qu'exécute un code qui commence par ces fonctions : elles, et ce qu'elles appellent de proche en proche. */
export interface Reach {
  /** Les fonctions exécutées (ids). */
  fns: Set<string>;
  /** Les fichiers exécutés : ceux de ces fonctions, et ceux dont une valeur de premier niveau est employée. */
  files: Set<string>;
}

export function reachOf(graph: FnGraph, start: FnSpan, calls: FnCall[] = graph.calls.get(fnId(start)) ?? [], within?: Set<string>): Reach {
  const fns = new Set([fnId(start)]);
  const files = new Set([start.path]);
  const queue: FnCall[] = [...calls];
  while (queue.length) {
    const c = queue.shift()!;
    if (c.file) {
      if (!within || within.has(c.file)) files.add(c.file);
      continue;
    }
    const sp = graph.byId.get(c.to!);
    if (!sp || fns.has(c.to!) || graph.tests.has(sp.path) || (within && !within.has(sp.path))) continue;
    fns.add(c.to!);
    files.add(sp.path);
    queue.push(...(graph.calls.get(c.to!) ?? []));
  }
  return { fns, files };
}
