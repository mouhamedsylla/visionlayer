import type { ArchNode, Entity, Entrypoint, Finding, MapPayload, Proof } from "../api/types";
import { sentence } from "./overview";

/**
 * La planche 05 (Données) : pour un stockage, chaque table croisée avec les parties du code qui la lisent ou
 * l'écrivent (les routes d'un programme, ses tâches planifiées, ses consommateurs de file), ses contraintes
 * et ce qu'il faut aller voir. Chaque case vient d'une occurrence rattachée à un point d'entrée.
 */

export interface Column { id: string; label: string }
export interface TableRow { entity: Entity; cells: Record<string, { read: boolean; write: boolean }>; constraint?: string; see?: string; seeTone?: "cr" | "q"; group: string }

const part = (n: ArchNode, e: Entrypoint): Column =>
  e.kind === "schedule" ? { id: `${n.id}:schedule`, label: "Tâches planifiées" }
  : e.kind === "message" || e.kind === "event" ? { id: `${n.id}:message`, label: n.role === "worker" ? n.name : `${n.name}, files` }
  : { id: `${n.id}:http`, label: `Routes de ${n.name}` };

export function stores(p: MapPayload): ArchNode[] {
  return p.model.nodes.filter((n) => n.level === "deployable" && (n.role === "store" || n.role === "channel"));
}

export function dataTable(p: MapPayload, store: ArchNode): { columns: Column[]; rows: TableRow[]; findings: Finding[] } {
  const entries = new Map<string, { n: ArchNode; e: Entrypoint }>();
  for (const n of p.model.nodes) for (const e of n.facets.entrypoints ?? []) entries.set(e.id, { n, e });
  const columns = new Map<string, Column>();
  const cells = new Map<string, Record<string, { read: boolean; write: boolean }>>();
  for (const edge of p.model.edges.filter((x) => x.to === store.id && (x.kind === "read" || x.kind === "write") && x.target?.entity)) {
    const t = edge.target!.entity!;
    for (const o of edge.occurrences) for (const id of o.entrypoints ?? []) {
      const at = entries.get(id);
      if (!at) continue;
      const c = part(at.n, at.e);
      columns.set(c.id, c);
      const row = cells.get(t) ?? cells.set(t, {}).get(t)!;
      const cell = row[c.id] ?? (row[c.id] = { read: false, write: false });
      cell[edge.kind === "read" ? "read" : "write"] = true;
    }
  }
  const order = (c: Column) => (c.id.endsWith(":http") ? 0 : c.id.endsWith(":schedule") ? 1 : 2);
  const cols = [...columns.values()].sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label));
  const findings = p.model.findings.filter((f) => f.nodes?.includes(store.id) || (store.facets.data?.entities ?? []).some((x) => f.message.includes(x.name)));
  const touched = (t: string, k: "read" | "write") => p.model.edges.some((e) => e.to === store.id && e.kind === k && e.target?.entity === t);
  const rows: TableRow[] = (store.facets.data?.entities ?? []).map((entity) => {
    const race = findings.find((f) => f.code === "race_read_then_write" && f.message.includes(` ${entity.name} `));
    const unused = findings.find((f) => f.code === "unused_value" && f.message.startsWith(`${entity.name}.`));
    const [r, w] = [touched(entity.name, "read"), touched(entity.name, "write")];
    const see = race ? { see: "lue puis réécrite sans revérifier", seeTone: "cr" as const }
      : unused ? { see: sentence(unused.message).replace(/^[^ ]+ accepte/, "accepte"), seeTone: "q" as const }
      : !r && !w ? { see: "ni lue ni écrite", seeTone: "q" as const }
      : w && !r ? { see: "écrite, jamais relue", seeTone: "q" as const }
      : r && !w ? { see: "rien ne l'écrit", seeTone: "q" as const } : {};
    const unique = (entity.constraints ?? []).filter((c) => c.kind === "unique" || (c.kind === "index" && c.where));
    const constraint = unique[0] ? `${unique[0].fields.join(", ")} unique${unique[0].where ? `, si ${unique[0].where}` : ""}` : undefined;
    return { entity, cells: cells.get(entity.name) ?? {}, ...(constraint ? { constraint } : {}), ...see, group: entity.group ?? "Tables" };
  });
  return { columns: cols, rows, findings };
}

export interface Writer { key: string; kind: string; verb: string; proofs: Proof[]; danger: boolean }

/** Qui écrit une table : chaque point d'entrée dont le code l'écrit, la valeur qu'il pose quand elle est écrite en clair. */
export function writers(p: MapPayload, store: ArchNode, entity: Entity): Writer[] {
  const entries = new Map<string, Entrypoint>();
  for (const n of p.model.nodes) for (const e of n.facets.entrypoints ?? []) entries.set(e.id, e);
  // La fonction qu'un constat de course désigne (`expireHolds`) : seul son écrivain est en cause.
  const culprits = new Set(p.model.findings.filter((f) => f.code === "race_read_then_write" && f.message.includes(` ${entity.name} `)).map((f) => f.message.match(/`([^`]+)`/)?.[1]).filter(Boolean));
  const status = entity.fields?.find((f) => f.values?.length && f.writes?.length);
  const by = new Map<string, Writer>();
  for (const edge of p.model.edges.filter((x) => x.to === store.id && x.kind === "write" && x.target?.entity === entity.name)) {
    for (const o of edge.occurrences) for (const id of o.entrypoints ?? []) {
      const e = entries.get(id);
      if (!e) continue;
      const value = status?.writes?.find((w) => w.entrypoints?.includes(id) && w.value)?.value;
      const w = by.get(id) ?? by.set(id, { key: e.kind === "schedule" ? `${e.handler?.name ?? e.key}(), ${e.key}` : e.key, kind: e.kind, verb: value ? `pose ${value}` : "écrit", proofs: [], danger: false }).get(id)!;
      if (!w.proofs.some((x) => x.path === o.path && x.line === o.line)) w.proofs.push(o);
      if (e.handler?.name && culprits.has(e.handler.name)) w.danger = true;
    }
  }
  return [...by.values()].sort((a, b) => Number(a.danger) - Number(b.danger));
}
