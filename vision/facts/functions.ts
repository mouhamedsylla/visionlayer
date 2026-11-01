import type { ArchEdge, ArchNode, CodeFunction, Proof } from "../arch/types.js";
import { flowWalker, MAX_STEPS, type Rows } from "./flow.js";

const MAX_FUNCTIONS = 2000;

/**
 * Les fonctions de chaque déployable (écran Code) : pour chaque fonction de
 * premier niveau d'un fichier lu, hors tests, ce que fait son code, qui
 * l'appelle et ce qu'elle appelle. Gardée si elle fait quelque chose de
 * visible ou si une ligne du dépôt l'appelle : un utilitaire muet et seul
 * n'apprend rien. Rattachée au premier déployable dont elle fait partie.
 */
export function attributeFunctions(nodes: ArchNode[], edges: ArchEdge[], rows: Rows): void {
  const s = (v: unknown) => String(v);
  const { walk, spans, calls, resolves, methodOf, memberCalls } = flowWalker(edges, rows);
  const tests = new Set(rows("test_file").map((t) => s(t.args[0])));
  const exported = new Set(rows("export_fn").map((t) => `${s(t.args[0])}\0${s(t.args[1])}`));
  const enclosing = (path: string, line: number) => spans.get(path)?.find((sp) => sp.start <= line && sp.end >= line);

  // Qui appelle qui : la ligne d'appel, résolue jusqu'à la déclaration appelée. Un test n'est pas un appelant du produit.
  const callers = new Map<string, { proof: Proof; fn?: string }[]>();
  for (const t of rows("fn_calls")) {
    const [path, callee, line] = [s(t.args[0]), s(t.args[2]), Number(t.args[3])];
    if (tests.has(path)) continue;
    const to = resolves.get(`${path}\0${callee}`);
    const target = to && enclosing(to.path, to.line);
    if (!target) continue;
    const key = `${to.path}:${target.start}`;
    const proof = t.proof.find((p) => p.line === line) ?? { path, line, source: "syntax" as const };
    (callers.get(key) ?? callers.set(key, []).get(key)!).push({ proof, fn: enclosing(path, line)?.name });
  }

  // Et les appels de méthodes d'une classe du dépôt (methods.ts) : `OrderService.find()`, `this.mailer.send()`.
  const methodCalls = new Map<string, { name: string; proof: Proof; to: string }[]>();
  for (const [path, list] of memberCalls) {
    if (tests.has(path)) continue;
    for (const c of list) {
      const m = methodOf(path, c.line, c.root, c.chain);
      if (!m) continue;
      const key = `${m.path}:${m.start}`;
      const from = enclosing(path, c.line);
      (callers.get(key) ?? callers.set(key, []).get(key)!).push({ proof: c.proof, fn: from?.name });
      if (from) (methodCalls.get(`${path}\0${from.start}`) ?? methodCalls.set(`${path}\0${from.start}`, []).get(`${path}\0${from.start}`)!).push({ name: `${c.root}.${c.chain}`, proof: c.proof, to: key });
    }
  }

  const owner = new Map<string, ArchNode>();
  for (const n of nodes) if (n.level === "deployable") for (const f of n.files ?? []) if (!owner.has(f)) owner.set(f, n);
  let kept = 0;
  for (const [path, list] of spans) {
    const node = owner.get(path);
    if (!node || tests.has(path)) continue;
    for (const span of list) {
      if (kept >= MAX_FUNCTIONS) return;
      const id = `${path}:${span.start}`;
      const flow = walk(node.id, path, span, 0, new Set()).slice(0, MAX_STEPS);
      const from = callers.get(id) ?? [];
      if (!flow.length && !from.length) continue;
      // un nom appelé plusieurs fois ne compte qu'une fois, à sa première ligne
      const seen = new Set<string>();
      const out = (calls.get(`${path}\0${span.start}`) ?? []).filter((c) => !seen.has(c.callee) && !!seen.add(c.callee))
        .map((c) => {
          const to = resolves.get(`${path}\0${c.callee}`);
          const target = to && enclosing(to.path, to.line);
          return { name: c.callee, local: !!to, proof: c.proof, ...(target ? { to: `${to.path}:${target.start}` } : {}) };
        })
        .concat((methodCalls.get(`${path}\0${span.start}`) ?? []).filter((c) => !seen.has(c.name) && !!seen.add(c.name)).map((c) => ({ name: c.name, local: true, proof: c.proof, to: c.to })))
        .sort((a, b) => a.proof.line - b.proof.line);
      const fn: CodeFunction = {
        id, name: span.name, proof: { path, line: span.start, source: "syntax" }, end: span.end,
        ...(exported.has(`${path}\0${span.name}`) ? { exported: true } : {}),
        ...(flow.length ? { flow } : {}),
        ...(from.length ? { calledFrom: from } : {}),
        ...(out.length ? { calls: out } : {}),
      };
      (node.facets.functions ??= []).push(fn);
      kept++;
    }
  }
}
