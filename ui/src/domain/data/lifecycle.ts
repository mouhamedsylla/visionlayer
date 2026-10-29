import type { ArchModelV2, ArchNode, Entity, Entrypoint, Field, FieldWrite, Proof } from "../../api/types";
import { cronLabel } from "../text/cron";

/** Un couloir du schéma : qui déclenche, qui écrit, et l'entité elle-même. */
export interface Lane {
  id: string;
  label: string;
  role: "caller" | "queue" | "writer" | "entity";
  /** `chaque minute` pour une tâche planifiée, `hors des blocs lancés` pour un script. */
  detail?: string;
  nodeId?: string;
}

/** Une valeur du champ : déclarée dans le schéma, écrite par le code, ou les deux. */
export interface StateInfo {
  value: string;
  isDefault: boolean;
  declared: boolean;
  /** Les fonctions qui l'écrivent. */
  writers: string[];
}

/** Une écriture du champ, avec ce qui l'a déclenchée. */
export interface Step {
  value?: string;
  fn?: string;
  proof: Proof;
  /** `POST /bookings`, `chaque minute`, `file emails`, ou `11 points d'entrée`. */
  via?: string;
  from?: Lane;
  actor: Lane;
}

export interface Lifecycle {
  field: Field;
  states: StateInfo[];
  steps: Step[];
  lanes: Lane[];
}

/** Les champs qui portent un cycle de vie : des valeurs énumérées, ou au moins deux valeurs littérales écrites. */
export function stateFields(entity: Entity): Field[] {
  return (entity.fields ?? []).filter((f) => {
    const written = new Set((f.writes ?? []).flatMap((w) => (w.value !== undefined ? [w.value] : [])));
    return written.size > 0 && ((f.values?.length ?? 0) > 0 || written.size > 1);
  });
}

/** Le cycle de vie d'un champ : ses valeurs dans l'ordre du schéma, et chaque écriture rangée par valeur. */
export function lifecycle(entity: Entity, field: Field, model: ArchModelV2): Lifecycle {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const entries = new Map(model.nodes.flatMap((n) => (n.facets.entrypoints ?? []).map((e) => [e.id, e] as const)));
  const writes = field.writes ?? [];
  const order = [...new Set([...(field.values ?? []), ...writes.flatMap((w) => (w.value !== undefined ? [w.value] : []))])];
  const states = order.map((value) => ({
    value, isDefault: field.default === value, declared: !!field.values?.includes(value),
    writers: [...new Set(writes.filter((w) => w.value === value).map((w) => w.fn ?? w.proof.path))],
  }));
  const rank = (w: FieldWrite) => (w.value === undefined ? order.length : order.indexOf(w.value));
  const steps = [...writes]
    .sort((a, b) => rank(a) - rank(b) || a.proof.path.localeCompare(b.proof.path) || a.proof.line - b.proof.line)
    .map((w) => stepOf(w, nodes, entries));
  const lanes = new Map<string, Lane>();
  for (const s of steps) if (s.from) lanes.set(s.from.id, s.from);
  for (const s of steps) lanes.set(s.actor.id, s.actor);
  lanes.set("entity", { id: "entity", label: entity.name, role: "entity" });
  return { field, states, steps, lanes: [...lanes.values()] };
}

function stepOf(w: FieldWrite, nodes: Map<string, ArchNode>, entries: Map<string, Entrypoint>): Step {
  const base = { ...(w.value !== undefined ? { value: w.value } : {}), ...(w.fn ? { fn: w.fn } : {}), proof: w.proof };
  const node = w.node ? nodes.get(w.node) : undefined;
  const blockLane: Lane = node
    ? { id: node.id, label: node.name, role: "writer", nodeId: node.id }
    : { id: `file:${w.proof.path}`, label: w.proof.path.split("/").pop() ?? w.proof.path, role: "writer", detail: "hors des blocs lancés" };
  const ids = w.entrypoints ?? [];
  if (ids.length !== 1) return { ...base, actor: blockLane, ...(ids.length > 1 ? { via: `${ids.length} points d'entrée` } : {}) };
  const e = entries.get(ids[0]!);
  if (!e) return { ...base, actor: blockLane };
  if (e.kind === "schedule") {
    return { ...base, via: cronLabel(e.key), actor: { id: e.id, label: e.handler?.name ?? e.key, role: "writer", detail: cronLabel(e.key), nodeId: node?.id } };
  }
  if (e.kind === "message") return { ...base, via: `file ${e.key}`, from: { id: `queue:${e.key}`, label: `file ${e.key}`, role: "queue" }, actor: blockLane };
  const caller = e.calledBy?.map((id) => nodes.get(id)).find((n): n is ArchNode => !!n);
  return { ...base, via: e.key, ...(caller ? { from: { id: caller.id, label: caller.name, role: "caller" as const, nodeId: caller.id } } : {}), actor: blockLane };
}
