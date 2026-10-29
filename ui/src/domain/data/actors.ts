import type { ArchModelV2, ArchNode, Entrypoint, Occurrence } from "../../api/types";
import { cronLabel } from "../text/cron";

/**
 * Qui agit sur un stockage : un bloc, ou une tâche planifiée de ce bloc, à part
 * parce qu'elle tourne sans clic, en même temps que les routes.
 */
export interface Actor {
  id: string;
  label: string;
  /** Pour une tâche planifiée : quand elle tourne, `chaque minute`. */
  detail?: string;
  nodeId: string;
}

export interface Access {
  read: Occurrence[];
  write: Occurrence[];
}

export interface StoreAccess {
  actors: Actor[];
  /** Entité → acteur → ses lectures et écritures. */
  byEntity: Map<string, Map<string, Access>>;
}

/** Les lectures et écritures d'un stockage, rangées par entité et par acteur, d'après les occurrences des liens. */
export function storeAccess(store: ArchNode, model: ArchModelV2): StoreAccess {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const actors = new Map<string, Actor>();
  const byEntity = new Map<string, Map<string, Access>>();

  for (const edge of model.edges) {
    if (edge.to !== store.id || (edge.kind !== "read" && edge.kind !== "write") || !edge.target?.entity) continue;
    const from = nodes.get(edge.from);
    if (!from) continue;
    const perActor = byEntity.get(edge.target.entity) ?? byEntity.set(edge.target.entity, new Map()).get(edge.target.entity)!;
    for (const occ of edge.occurrences) {
      for (const actor of actorsOf(from, occ)) {
        actors.set(actor.id, actor);
        const access = perActor.get(actor.id) ?? perActor.set(actor.id, { read: [], write: [] }).get(actor.id)!;
        access[edge.kind].push(occ);
      }
    }
  }
  // Le bloc qui touche le plus d'entités d'abord, chaque tâche planifiée juste après son bloc.
  const weight = new Map<string, number>();
  for (const perActor of byEntity.values()) for (const id of new Set([...perActor.keys()].map((a) => actors.get(a)!.nodeId))) weight.set(id, (weight.get(id) ?? 0) + 1);
  const sorted = [...actors.values()].sort((a, b) =>
    (weight.get(b.nodeId) ?? 0) - (weight.get(a.nodeId) ?? 0) || a.nodeId.localeCompare(b.nodeId) || Number(!!a.detail) - Number(!!b.detail) || a.label.localeCompare(b.label));
  return { actors: sorted, byEntity };
}

function actorsOf(node: ArchNode, occ: Occurrence): Actor[] {
  const entries = (occ.entrypoints ?? []).map((id) => node.facets.entrypoints?.find((e) => e.id === id)).filter((e): e is Entrypoint => !!e);
  const out = new Map<string, Actor>();
  for (const e of entries) {
    const a = e.kind === "schedule" ? scheduleActor(node, e) : blockActor(node);
    out.set(a.id, a);
  }
  if (!out.size) out.set(node.id, blockActor(node));
  return [...out.values()];
}

const blockActor = (node: ArchNode): Actor => ({ id: node.id, label: node.name, nodeId: node.id });

const scheduleActor = (node: ArchNode, e: Entrypoint): Actor => ({
  id: e.id, label: e.handler?.name ?? e.key, detail: cronLabel(e.key), nodeId: node.id,
});

/** Les acteurs qui écrivent une entité. */
export function writersOf(access: StoreAccess, entity: string): string[] {
  return [...(access.byEntity.get(entity) ?? new Map<string, Access>())].filter(([, a]) => a.write.length).map(([id]) => id);
}

/** Les acteurs qui la lisent ou l'écrivent. */
export function usersOf(access: StoreAccess, entity: string): string[] {
  return [...(access.byEntity.get(entity)?.keys() ?? [])];
}

/** Qui atteint une ligne : `POST /payments`, `GET /bookings/:id et PATCH /bookings/:id`, ou `11 points d'entrée` au-delà de trois. */
export function reachedBy(occ: Occurrence, model: ArchModelV2): { label: string; all: string[] } {
  const keys = new Map(model.nodes.flatMap((n) => (n.facets.entrypoints ?? []).map((e) => [e.id, e.key] as const)));
  const all = (occ.entrypoints ?? []).map((id) => keys.get(id) ?? id);
  if (all.length > 3) return { label: `${all.length} points d'entrée`, all };
  return { label: all.join(", "), all };
}

/** Les entités qu'un bloc lit et écrit, tâches planifiées comprises. */
export function blockUse(access: StoreAccess, nodeId: string): { read: number; write: number } {
  const ids = new Set(access.actors.filter((a) => a.nodeId === nodeId).map((a) => a.id));
  let read = 0, write = 0;
  for (const perActor of access.byEntity.values()) {
    const mine = [...perActor].filter(([id]) => ids.has(id)).map(([, a]) => a);
    if (mine.some((a) => a.read.length)) read++;
    if (mine.some((a) => a.write.length)) write++;
  }
  return { read, write };
}
