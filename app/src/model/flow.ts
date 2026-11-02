import type { ArchNode, Entrypoint, FlowStep, MapPayload } from "../api/types";

/**
 * Le déroulé d'un point d'entrée (F1) en diagramme de séquence : une colonne pour son code, puis une par
 * cible touchée (stockage, file, service), dans l'ordre où le code les touche ; une ligne par étape, sa
 * flèche du code vers la cible, sa preuve. Les refus et les retours restent dans la colonne du code.
 */

export interface FlowRow { n: number; step: FlowStep; label: string; target?: number; tone: "effect" | "refuse" | "invoke" | "return" | "reply" }
export interface FlowView { entry: Entrypoint; owner: ArchNode; columns: { id: string; name: string; sub: string }[]; rows: FlowRow[]; tiles: { label: string; value: string; note: string }[] }

const VERB: Record<string, string> = { read: "lit", write: "écrit", message: "met en file", request: "appelle", call: "appelle", trigger: "déclenche", use: "emploie" };

export function findEntry(p: MapPayload, id: string): { entry: Entrypoint; owner: ArchNode } | undefined {
  for (const n of p.model.nodes) for (const e of n.facets.entrypoints ?? []) if (e.id === id) return { entry: e, owner: n };
  return undefined;
}

export function flowView(p: MapPayload, entry: Entrypoint, owner: ArchNode): FlowView {
  const steps = entry.flow ?? [];
  const nodes = new Map(p.model.nodes.map((n) => [n.id, n]));
  const cols: FlowView["columns"] = [{ id: "code", name: entry.handler?.name && entry.handler.name !== "fonction anonyme" ? entry.handler.name : owner.name, sub: owner.name }];
  const colOf = (id: string) => {
    let i = cols.findIndex((c) => c.id === id);
    if (i < 0) { const n = nodes.get(id); cols.push({ id, name: n?.name ?? id, sub: n?.tech?.map((t) => p.tech[t]?.name ?? t)[0] ?? "" }); i = cols.length - 1; }
    return i;
  };
  const rows: FlowRow[] = steps.map((s, i) => {
    const what = s.target?.entity ?? s.target?.topic ?? "";
    if (s.target && VERB[s.kind]) return { n: i + 1, step: s, label: `${VERB[s.kind]} ${what || nodes.get(s.target.node)?.name || ""}${s.name ? `, ${s.name}` : ""}`, target: colOf(s.target.node), tone: "effect" };
    if (s.kind === "refuse") return { n: i + 1, step: s, label: `refuse${s.status ? ` ${s.status}` : ""}${s.code ? ` ${s.code}` : s.name ? ` ${s.name}` : ""}`, tone: "refuse" };
    if (s.kind === "invoke") return { n: i + 1, step: s, label: `appelle ${s.name ?? ""}()`, tone: "invoke" };
    if (s.kind === "reply") return { n: i + 1, step: s, label: `répond${s.status ? ` ${s.status}` : ""}${s.name ? `, ${s.name}` : ""}`, tone: "reply" };
    return { n: i + 1, step: s, label: "s'arrête", tone: "return" };
  });
  const firstEffect = rows.findIndex((r) => r.tone === "effect");
  const before = rows.slice(0, firstEffect < 0 ? rows.length : firstEffect).filter((r) => r.tone === "refuse");
  const writes = [...new Set(steps.filter((s) => s.kind === "write").map((s) => s.target?.entity).filter(Boolean))];
  const talks = [...new Set(steps.filter((s) => s.kind === "request" || s.kind === "message").map((s) => nodes.get(s.target?.node ?? "")?.name ?? s.target?.topic).filter(Boolean))];
  const refusals = rows.filter((r) => r.tone === "refuse");
  const onError = refusals.filter((r) => r.step.onError);
  return {
    entry, owner, columns: cols, rows,
    tiles: [
      { label: "Avant tout effet", value: `${before.length} refus`, note: before.map((r) => r.step.status ?? r.step.code ?? r.step.name).filter(Boolean).slice(0, 4).join(", ") || "rien n'est vérifié avant le premier effet" },
      { label: "Écrit", value: writes.length ? `${writes.length} table${writes.length > 1 ? "s" : ""}` : "rien", note: writes.join(", ") || "aucune écriture lue" },
      { label: "Parle à", value: talks.length ? talks.join(", ") : "personne", note: talks.length ? "services et files appelés" : "aucun appel sortant lu" },
      { label: "Si ça échoue", value: `${refusals.length} refus`, note: onError.length ? `${onError.length} dans un rattrapage d'erreur` : "aucun rattrapage lu" },
    ],
  };
}
