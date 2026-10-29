import type { ArchModelV2, EdgeKind, Occurrence } from "../../api/types";

/** Ce qu'un point d'entrée fait hors de son code : une lecture, une écriture, une mise en file, un appel. */
export interface Effect {
  kind: EdgeKind;
  to: string;
  /** L'entité, le topic ou le point d'entrée visé, quand le lien le dit. */
  target?: string;
  occurrences: Occurrence[];
}

const ORDER: EdgeKind[] = ["read", "write", "message", "request", "call", "trigger", "use", "deploy"];

/** Les effets d'un point d'entrée, d'après les occurrences que le moteur lui a rattachées. */
export function effectsOf(entryId: string, model: ArchModelV2): Effect[] {
  return model.edges
    .map((e) => ({ edge: e, occ: e.occurrences.filter((o) => o.entrypoints?.includes(entryId)) }))
    .filter(({ occ }) => occ.length > 0)
    .map(({ edge, occ }) => ({
      kind: edge.kind,
      to: edge.to,
      target: edge.target?.entity ?? edge.target?.topic ?? edge.target?.entrypoint,
      occurrences: occ,
    }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.to.localeCompare(b.to) || (a.target ?? "").localeCompare(b.target ?? ""));
}

const VERB: Record<EdgeKind, string> = {
  read: "lit", write: "écrit", message: "met en file", request: "appelle", call: "appelle",
  trigger: "déclenche", use: "utilise", deploy: "déploie",
};

export function effectVerb(kind: EdgeKind): string {
  return VERB[kind];
}

/**
 * Les pastilles d'une ligne : une par verbe, et une par service appelé.
 * `lit`, `écrit`, `met en file`, `appelle stripe`.
 */
export function effectChips(effects: Effect[], names: Map<string, string>): { label: string; kind: EdgeKind; detail: string }[] {
  const chips = new Map<string, { label: string; kind: EdgeKind; targets: string[] }>();
  for (const e of effects) {
    const outward = e.kind === "request" || e.kind === "call";
    const label = outward ? `${VERB[e.kind]} ${names.get(e.to) ?? e.to}` : VERB[e.kind];
    const chip = chips.get(label) ?? chips.set(label, { label, kind: e.kind, targets: [] }).get(label)!;
    chip.targets.push(e.target ?? names.get(e.to) ?? e.to);
  }
  return [...chips.values()].map((c) => ({ label: c.label, kind: c.kind, detail: [...new Set(c.targets)].join(", ") }));
}
