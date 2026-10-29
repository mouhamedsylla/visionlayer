import type { ArchEdge, ArchNode, Entrypoint, FlowStep, Proof } from "../arch/types.js";
import type { Tuple, Value } from "./datalog.js";

/**
 * Le déroulé de chaque point d'entrée (écran Features) : ce que son code fait,
 * dans l'ordre des lignes. Les liens de la carte donnent les lectures,
 * écritures, appels et mises en file ; la syntaxe donne les refus, les retours
 * anticipés, les réponses et les commentaires de l'auteur. Une fonction du
 * dépôt appelée est dépliée là où elle est appelée, jusqu'à trois crans, si
 * elle fait quelque chose de visible.
 *
 * Rien n'est résumé : chaque étape est une ligne, et son texte est cette ligne.
 */

const MAX_DEPTH = 3;
export const MAX_STEPS = 200;

export type Rows = (rel: string) => readonly Tuple[];
export interface Span { name: string; start: number; end: number }

export function attributeFlows(nodes: ArchNode[], edges: ArchEdge[], rows: Rows): void {
  const { walk, spans } = flowWalker(edges, rows);
  const entries = nodes.flatMap((node) => (node.facets.entrypoints ?? []).map((entry) => ({ node, entry })));
  const at = handlerSpans(entries.map((x) => x.entry), spans);
  for (const { node, entry } of entries) {
    const h = entry.handler;
    const found = at.get(entry);
    // Plusieurs points d'entrée écrits à l'intérieur d'une même fonction (`createServer((req, res) => { if (url === …) … })`) :
    // son déroulé est celui de toutes ses branches à la fois, aucun n'est le sien.
    if (!h || !found || found.shared) continue;
    const flow = walk(node.id, h.path, found.span, 0, new Set()).slice(0, MAX_STEPS);
    if (flow.length) entry.flow = flow;
  }
}

/**
 * La fonction de chaque point d'entrée : celle qui commence à la ligne du
 * gestionnaire, celle qui la contient (`inside`), ou celle de son nom déclarée
 * à partir de cette ligne (`const pay = onCall(…, async () => …)`). `shared` :
 * plusieurs points d'entrée sont écrits à l'intérieur de la même fonction.
 */
export function handlerSpans(entries: Entrypoint[], spans: Map<string, Span[]>): Map<Entrypoint, { span: Span; inside: boolean; shared: boolean }> {
  const out = new Map<Entrypoint, { span: Span; inside: boolean; shared: boolean }>();
  const count = new Map<string, number>();
  for (const e of entries) {
    const h = e.handler;
    if (!h) continue;
    const own = spans.get(h.path);
    const start = own?.find((sp) => sp.start === h.line);
    const around = start ? undefined : own?.find((sp) => sp.start <= h.line && sp.end >= h.line);
    const named = start || around ? undefined : own?.find((sp) => sp.name === h.name && sp.start >= h.line);
    const span = start ?? around ?? named;
    if (!span) continue;
    out.set(e, { span, inside: !!around, shared: false });
    if (around) count.set(`${h.path}:${span.start}`, (count.get(`${h.path}:${span.start}`) ?? 0) + 1);
  }
  for (const [e, x] of out) if (x.inside && (count.get(`${e.handler!.path}:${x.span.start}`) ?? 0) > 1) x.shared = true;
  return out;
}

/**
 * Le parcours d'une fonction : ce que fait son code, ligne à ligne, les
 * fonctions du dépôt qu'elle appelle dépliées. Le même pour un point d'entrée
 * (son gestionnaire) et pour une fonction ouverte seule (écran Code).
 */
export function flowWalker(edges: ArchEdge[], rows: Rows) {
  const s = (v: Value | undefined) => String(v);
  const group = <T>(rel: string, key: (t: Tuple) => string, map: (t: Tuple) => T) => {
    const out = new Map<string, T[]>();
    for (const t of rows(rel)) (out.get(key(t)) ?? out.set(key(t), []).get(key(t))!).push(map(t));
    return out;
  };
  const fnKey = (t: Tuple) => `${s(t.args[0])}\0${s(t.args[1])}`;
  const proofOf = (t: Tuple, line: number): Proof => t.proof.find((p) => p.line === line) ?? t.proof[0] ?? { path: s(t.args[0]), line, source: "syntax" };

  const spans = group("fn_span", (t) => s(t.args[0]), (t): Span => ({ name: s(t.args[1]), start: Number(t.args[2]), end: Number(t.args[3]) }));
  const resolves = new Map(rows("resolves").map((t) => [`${s(t.args[0])}\0${s(t.args[1])}`, { path: s(t.args[2]), line: Number(t.args[3]) }]));
  const throws = group("throws", fnKey, (t): FlowStep => {
    const line = Number(t.args[2]);
    return {
      kind: "refuse", depth: 0, proof: proofOf(t, line), name: s(t.args[3]) || undefined, status: s(t.args[4]) || undefined,
      code: s(t.args[5]) || undefined, when: s(t.args[6]) || undefined, ...(s(t.args[7]) === "catch" ? { onError: true } : {}),
    };
  });
  const returns = group("returns_early", fnKey, (t): FlowStep => ({ kind: "return", depth: 0, proof: proofOf(t, Number(t.args[2])), when: s(t.args[3]) }));
  const replies = group("http_reply", fnKey, (t): FlowStep => ({
    kind: "reply", depth: 0, proof: proofOf(t, Number(t.args[2])), name: s(t.args[3]), status: s(t.args[4]) || undefined,
  }));
  const notes = group("note", fnKey, (t) => ({ start: Number(t.args[2]), end: Number(t.args[3]), text: s(t.args[4]), proof: t.proof[0]! }));
  const calls = group("fn_calls", fnKey, (t) => ({ callee: s(t.args[2]), line: Number(t.args[3]), when: s(t.args[4]), proof: proofOf(t, Number(t.args[3])) }));
  const methods = new Map(rows("sdk_call").map((t) => [`${s(t.args[0])}\0${s(t.args[3])}`, s(t.args[2])]));
  const links = new Map<string, FlowStep[]>();
  for (const e of edges) for (const o of e.occurrences) {
    const target = { node: e.to, ...(e.target?.entity ? { entity: e.target.entity } : {}), ...(e.target?.topic ? { topic: e.target.topic } : {}) };
    const name = e.kind === "request" ? methods.get(`${o.path}\0${o.line}`) : undefined;
    // Une occurrence porte aussi ses points d'entrée : l'étape n'en garde que la preuve.
    const { entrypoints: _, ...proof } = o;
    (links.get(o.path) ?? links.set(o.path, []).get(o.path)!).push({ kind: e.kind, depth: 0, proof, target, ...(name ? { name } : {}) });
  }

  // `owner` : le bloc du point d'entrée ; un lien vers lui-même (Stripe qui appelle l'API) n'est pas une étape de son code.
  const walk = (owner: string, path: string, span: Span, depth: number, seen: Set<string>): FlowStep[] => {
    const key = `${path}\0${span.start}`;
    const inside = (p: Proof) => p.line >= span.start && p.line <= span.end;
    const own: FlowStep[] = [
      ...(links.get(path) ?? []).filter((x) => inside(x.proof) && x.target?.node !== owner),
      ...(throws.get(key) ?? []), ...(returns.get(key) ?? []), ...(depth === 0 ? replies.get(key) ?? [] : []),
    ].map((x) => ({ ...x, depth }));
    // Un retour qui répond : une seule étape, la réponse, avec la condition du retour.
    const replyLines = new Set(own.filter((x) => x.kind === "reply").map((x) => x.proof.line));
    for (const r of own) if (r.kind === "reply") r.when = own.find((x) => x.kind === "return" && x.proof.line === r.proof.line)?.when;
    const steps: { line: number; list: FlowStep[] }[] = dedupe(own.filter((x) => !(x.kind === "return" && replyLines.has(x.proof.line)))).map((x) => ({ line: x.proof.line, list: [x] }));

    if (depth < MAX_DEPTH) for (const c of calls.get(key) ?? []) {
      const to = resolves.get(`${path}\0${c.callee}`);
      const target = to && spans.get(to.path)?.find((sp) => sp.start <= to.line && sp.end >= to.line);
      if (!to || !target || seen.has(`${to.path}\0${target.start}`)) continue;
      const sub = walk(owner, to.path, target, depth + 1, new Set([...seen, key]));
      if (sub.length) steps.push({ line: c.line, list: [{ kind: "invoke", depth, proof: c.proof, name: c.callee, ...(c.when ? { when: c.when } : {}) }, ...sub] });
    }
    const flat = steps.sort((a, b) => a.line - b.line).flatMap((x) => x.list);
    for (const n of notes.get(key) ?? []) {
      const step = flat.find((x) => x.depth === depth && !x.why && x.proof.line >= n.start && x.proof.line <= n.end);
      if (step) step.why = { text: n.text, proof: n.proof };
    }
    return flat;
  };
  return { walk, spans, calls, resolves };
}

/** Une même ligne lue deux fois par deux liens identiques ne fait qu'une étape. */
function dedupe(steps: FlowStep[]): FlowStep[] {
  const seen = new Set<string>();
  return steps.filter((x) => {
    const k = `${x.kind}\0${x.proof.line}\0${x.target?.node ?? ""}\0${x.target?.entity ?? x.target?.topic ?? ""}\0${x.status ?? ""}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
