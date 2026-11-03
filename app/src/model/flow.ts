import type { ArchNode, Entrypoint, FlowStep, MapPayload } from "../api/types";

/**
 * Le déroulé d'un point d'entrée, tel que le catalogue le dessine (F1, A1, A2) : des colonnes (son code, les
 * modules qu'il traverse, puis chaque cible touchée), des étapes groupées en moments, et l'aiguillage de
 * ses refus. Tout vient du déroulé extrait du code ; aucun libellé n'est rédigé par un modèle.
 */

export interface Col { id: string; name: string; sub: string; kind: "code" | "module" | "target" }
export interface FlowRow { n: number; step: FlowStep; from: number; to?: number; tone: "effect" | "refuse" | "invoke" | "return" | "reply"; what: string; danger?: boolean }
export interface MomentRows { title: string; rows: FlowRow[] }
export interface Gate { n: number; question: string; refusal: string; leaves: string[] }

export function findEntry(p: MapPayload, id: string): { entry: Entrypoint; owner: ArchNode } | undefined {
  for (const n of p.model.nodes) for (const e of n.facets.entrypoints ?? []) if (e.id === id) return { entry: e, owner: n };
  return undefined;
}

export function flowView(p: MapPayload, entry: Entrypoint, owner: ArchNode) {
  const steps = entry.flow ?? [];
  const nodes = new Map(p.model.nodes.map((n) => [n.id, n]));
  // Les lectures qu'un constat met en cause : lue hors de la transaction qui l'écrit, lue puis réécrite sans revérifier.
  const flagged = new Set(p.model.findings.filter((f) => f.code === "read_outside_tx" || f.code === "race_read_then_write").map((f) => `${f.proof[0]?.path}:${f.proof[0]?.line}`));
  const modules = p.model.nodes.filter((n) => n.parent === owner.id && n.level === "component");
  const moduleOf = (path: string) => modules.find((m) => (m.files ?? []).includes(path));
  const home = moduleOf(entry.handler?.path ?? entry.proof.path);
  const cols: Col[] = [{ id: "code", name: entry.handler?.name && entry.handler.name !== "fonction anonyme" ? entry.handler.name : owner.name, sub: home?.name ?? owner.name, kind: "code" }];
  const col = (id: string, make: () => Col) => { let i = cols.findIndex((c) => c.id === id); if (i < 0) { cols.push(make()); i = cols.length - 1; } return i; };
  // Les modules traversés d'abord, dans l'ordre où le code y passe ; puis les cibles.
  for (const s of steps) { const m = moduleOf(s.proof.path); if (m && m.id !== home?.id) col(m.id, () => ({ id: m.id, name: m.name, sub: "module", kind: "module" })); }
  const rows: FlowRow[] = steps.map((s, i) => {
    const m = moduleOf(s.proof.path);
    const from = m && m.id !== home?.id ? cols.findIndex((c) => c.id === m.id) : 0;
    const what = s.target?.entity ?? s.target?.topic ?? (s.target ? nodes.get(s.target.node)?.name ?? "" : "");
    if (s.target && ["read", "write", "message", "request", "call", "trigger", "use"].includes(s.kind)) {
      const n = nodes.get(s.target.node);
      const to = col(s.target.node, () => ({ id: s.target!.node, name: n?.name ?? s.target!.node, sub: n?.tech?.map((t) => p.tech[t]?.name ?? t)[0] ?? "", kind: "target" }));
      return { n: i + 1, step: s, from, to, tone: "effect", what, ...(s.kind === "read" && flagged.has(`${s.proof.path}:${s.proof.line}`) ? { danger: true } : {}) };
    }
    const tone = s.kind === "refuse" ? "refuse" : s.kind === "invoke" ? "invoke" : s.kind === "reply" ? "reply" : "return";
    return { n: i + 1, step: s, from, tone, what: s.name ?? "" };
  });
  return { cols, rows, moments: moments(rows), gates: gates(rows), sentence: sentence(entry, rows, nodes) };
}

/** Les moments : « Vérifier » (ce qui précède le premier effet), puis un moment par fonction du dépôt appelée au premier niveau, « Agir » pour les effets écrits dans le point d'entrée lui-même, « Répondre » pour la réponse. */
function moments(rows: FlowRow[]): MomentRows[] {
  const first = rows.findIndex((r) => r.tone === "effect");
  const out: MomentRows[] = [];
  const verify = rows.slice(0, first < 0 ? rows.length : first);
  if (verify.length) out.push({ title: "Vérifier", rows: verify });
  let cur: MomentRows | undefined;
  for (const r of rows.slice(verify.length)) {
    const top = r.step.depth === 0;
    const title = !top ? undefined : r.tone === "invoke" ? `${r.step.name ?? "appelle"}()` : r.tone === "reply" ? "Répondre" : cur && cur.title !== "Répondre" && !cur.title.endsWith("()") ? cur.title : "Agir";
    if (title && (!cur || title !== cur.title || r.tone === "invoke")) { cur = { title, rows: [] }; out.push(cur); }
    (cur ??= (out.push({ title: "Agir", rows: [] }), out[out.length - 1]!)).rows.push(r);
  }
  return out;
}

/** L'aiguillage (A2) : chaque refus, sa condition, et ce qui est déjà écrit quand il arrive. */
function gates(rows: FlowRow[]): Gate[] {
  return rows.filter((r) => r.tone === "refuse").map((r) => ({
    n: r.n,
    question: r.step.when ? `${r.step.when} ?` : r.step.onError ? "l'appel juste avant échoue ?" : "sans condition",
    refusal: [r.step.status, r.step.code ?? r.step.name].filter(Boolean).join(" ") || "refus",
    leaves: [...new Set(rows.filter((x) => x.n < r.n && x.tone === "effect" && (x.step.kind === "write" || x.step.kind === "message")).map((x) => x.what))],
  }));
}

/** La phrase de F1 : ce que vérifie le point d'entrée, ce qu'il fait au système, comment il répond. */
function sentence(entry: Entrypoint, rows: FlowRow[], nodes: Map<string, ArchNode>): string {
  const first = rows.findIndex((r) => r.tone === "effect");
  const before = rows.slice(0, first < 0 ? rows.length : first).filter((r) => r.tone === "refuse").length;
  const writes = [...new Set(rows.filter((r) => r.step.kind === "write").map((r) => r.what))];
  const reads = [...new Set(rows.filter((r) => r.step.kind === "read").map((r) => r.what))];
  const out = [...new Set(rows.filter((r) => r.step.kind === "request").map((r) => nodes.get(r.step.target!.node)?.name ?? r.what))];
  const queues = [...new Set(rows.filter((r) => r.step.kind === "message").map((r) => r.what))];
  const reply = rows.find((r) => r.tone === "reply")?.step.status;
  const parts = [
    before ? `refuse dans ${before} cas avant tout effet` : "",
    reads.length ? `lit ${reads.join(", ")}` : "",
    out.length ? `appelle ${out.join(", ")}` : "",
    writes.length ? `écrit ${writes.join(", ")}` : "",
    queues.length ? `met en file ${queues.join(", ")}` : "",
    reply ? `répond ${reply}` : "",
  ].filter(Boolean);
  return parts.length ? `${entry.key} ${parts.join(", ")}.` : `${entry.key} : aucun effet lu dans son code.`;
}

/** Les étapes d'un moment, découpées par transaction : une suite d'étapes dans la même transaction forme un cadre. */
export function txRuns(rows: FlowRow[]): { tx?: NonNullable<FlowStep["tx"]>; rows: FlowRow[] }[] {
  const out: { tx?: NonNullable<FlowStep["tx"]>; rows: FlowRow[] }[] = [];
  const key = (r: FlowRow) => (r.step.tx ? `${r.step.tx.path}:${r.step.tx.from}` : "");
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && (last.tx ? `${last.tx.path}:${last.tx.from}` : "") === key(r)) last.rows.push(r);
    else out.push({ ...(r.step.tx ? { tx: r.step.tx } : {}), rows: [r] });
  }
  return out;
}
