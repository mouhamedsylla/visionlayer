import type { ArchModelV2, ArchNode, CodeFunction, Entrypoint, FlowStep, Proof, SymbolRef } from "../../api/types";
import type { EntryRef } from "../features/list";

export type GuardLevel = NonNullable<Entrypoint["access"]>["level"];

/** Du plus ouvert au plus fermé : l'ordre des lignes de « Qui peut faire quoi ». */
export const LEVEL_ORDER: GuardLevel[] = ["public", "signature", "authenticated", "role", "internal", "unknown"];

/** Un refus écrit dans le code : `401 · unauthenticated`, avec sa condition. */
export interface Refusal {
  status: string;
  code?: string;
  when?: string;
  proof: Proof;
}

/** Un point d'entrée vu depuis sa garde : ce qu'il écrit, et ce que sa route vérifie après la garde. */
export interface GuardedEntry extends EntryRef {
  writes: string[];
  checks: Refusal[];
}

/** Une fonction du dépôt qui tient la garde d'au moins un point d'entrée. */
export interface GuardFn {
  ref: SymbolRef;
  level: GuardLevel;
  fn?: CodeFunction;
  node: ArchNode;
  entries: GuardedEntry[];
  refusals: Refusal[];
  /** Ce qu'elle lit pour reconnaître l'appelant : `{ node, entity }`. */
  reads: { node: string; entity: string }[];
}

export interface LevelRow {
  level: GuardLevel;
  entries: GuardedEntry[];
  guards: GuardFn[];
}

const refusalsOf = (flow: FlowStep[] = []): Refusal[] => {
  const seen = new Set<string>();
  return flow.filter((s) => s.kind === "refuse" && s.status).flatMap((s) => {
    const k = `${s.status}\0${s.code ?? ""}`;
    if (seen.has(k)) return [];
    seen.add(k);
    return [{ status: s.status!, code: s.code, when: s.when, proof: s.proof }];
  });
};

const writesOf = (entry: Entrypoint, names: Map<string, string>) =>
  [...new Set((entry.flow ?? []).filter((s) => s.kind === "write" && s.target).map((s) => s.target!.entity ?? names.get(s.target!.node) ?? s.target!.node))];

/** `const user = await requireUser(req)` : le nom qui reçoit l'appelant reconnu, quand le code l'écrit ainsi. */
const boundName = (step: FlowStep | undefined) => step?.proof.text?.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?[\w.]+\(/)?.[1];

/** Les refus que la route écrit elle-même après la garde, sur l'appelant reconnu : à qui appartient ce qu'elle touche. */
function checksOf(entry: Entrypoint): Refusal[] {
  const flow = entry.flow ?? [];
  const at = flow.findIndex((s) => s.kind === "invoke" && s.depth === 0 && s.name === entry.access?.by?.name);
  const name = boundName(flow[at]);
  if (at < 0 || !name) return [];
  const uses = new RegExp(`\\b${name}\\.`);
  return refusalsOf(flow.slice(at + 1).filter((s) => s.depth === 0 && s.when && uses.test(s.when)));
}

export const functionOf = (model: ArchModelV2, ref: SymbolRef) => {
  for (const n of model.nodes) {
    const fn = n.facets.functions?.find((f) => f.proof.path === ref.path && f.proof.line === ref.line);
    if (fn) return { fn, node: n };
  }
  return undefined;
};

/** Les points d'entrée dont un pack a lu la garde, rangés par niveau, avec les fonctions qui les gardent. */
export function accessRows(model: ArchModelV2): { rows: LevelRow[]; guards: GuardFn[]; unread: EntryRef[] } {
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const guards = new Map<string, GuardFn>();
  const byLevel = new Map<GuardLevel, GuardedEntry[]>();
  const unread: EntryRef[] = [];
  for (const node of model.nodes) for (const entry of node.facets.entrypoints ?? []) {
    if (!entry.access) {
      if (entry.kind === "http" || entry.kind === "rpc") unread.push({ entry, node });
      continue;
    }
    const item: GuardedEntry = { entry, node, writes: writesOf(entry, names), checks: checksOf(entry) };
    (byLevel.get(entry.access.level) ?? byLevel.set(entry.access.level, []).get(entry.access.level)!).push(item);
    const by = entry.access.by;
    if (!by) continue;
    const k = `${by.path}:${by.line}`;
    if (!guards.has(k)) {
      const found = functionOf(model, by);
      const flow = found?.fn.flow ?? [];
      const reads = flow.filter((s) => s.kind === "read" && s.target?.entity).map((s) => ({ node: s.target!.node, entity: s.target!.entity! }));
      guards.set(k, {
        ref: by, level: entry.access.level, fn: found?.fn, node: found?.node ?? node, entries: [],
        refusals: refusalsOf(flow), reads: reads.filter((r, i) => reads.findIndex((x) => x.entity === r.entity && x.node === r.node) === i),
      });
    }
    guards.get(k)!.entries.push(item);
  }
  const all = [...guards.values()];
  const rows = LEVEL_ORDER.filter((l) => byLevel.has(l)).map((level) => ({
    level, entries: byLevel.get(level)!, guards: all.filter((g) => g.level === level),
  }));
  return { rows, guards: all, unread };
}

/** Aucune garde lue sur aucun point d'entrée : on ne sait pas qui peut appeler quoi, ce qui n'est pas la même chose qu'un système ouvert. */
export function accessUnread(model: ArchModelV2): string | undefined {
  const read = model.nodes.some((n) => (n.facets.entrypoints ?? []).some((e) => e.access));
  return read ? undefined : "aucun pack ne lit encore les gardes de ce projet";
}
