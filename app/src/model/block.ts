import type { ArchEdge, ArchNode, ComponentLayer, Entrypoint, MapPayload } from "../api/types";
import { plural } from "./words";

/**
 * L'intérieur d'un bloc (B1) : ses modules rangés par usage, de gauche à droite, pour que les appels aillent
 * vers la droite (propres à une fonctionnalité, partagés, communs à tout), les appels entre eux, ce que
 * chacun touche ; puis ses points d'entrée, rangés par ressource, qui mènent chacun à son déroulé.
 */

export type Column = "own" | "shared" | "base";
export const COLUMN: Record<Column, { title: string; note: string }> = {
  own: { title: "Propres", note: "le code d'une seule fonctionnalité" },
  shared: { title: "Partagés", note: "servis par plusieurs" },
  base: { title: "Communs", note: "servis par presque tout" },
};

export interface ModuleCard {
  node: ArchNode; column: Column; serves: number; of: number;
  layers: Partial<Record<ComponentLayer, number>>;
  writes: number; reads: number; contract: boolean;
  entries: Entrypoint[];
}

export function blockView(p: MapPayload, block: ArchNode) {
  const entries = (block.facets.entrypoints ?? []).filter((e) => e.kind !== "main");
  const byId = new Map(entries.map((e) => [e.id, e]));
  const modules: ModuleCard[] = p.model.nodes.filter((n) => n.parent === block.id && n.facets.component).map((n) => {
    const c = n.facets.component!;
    const layers: Partial<Record<ComponentLayer, number>> = {};
    for (const l of Object.values(c.layers ?? {})) layers[l] = (layers[l] ?? 0) + 1;
    const count = (k: string) => new Set(c.touches.filter((t) => t.kind === k && t.entity).map((t) => t.entity)).size;
    return {
      node: n, column: c.reach, serves: c.entrypoints.length, of: entries.length, layers,
      writes: count("write"), reads: count("read"), contract: c.grouping === "contract",
      entries: c.entrypoints.map((id) => byId.get(id)).filter((e): e is Entrypoint => !!e),
    };
  }).sort((a, b) => b.serves - a.serves || a.node.name.localeCompare(b.node.name));
  const ids = new Set(modules.map((m) => m.node.id));
  const calls = p.model.edges.filter((e) => e.kind === "call" && ids.has(e.from) && ids.has(e.to));
  const written = new Set(p.model.edges.filter((e) => e.from === block.id && e.kind === "write" && e.target?.entity).map((e) => e.target!.entity!));
  const writers = (t: string) => modules.filter((m) => m.node.facets.component!.touches.some((x) => x.kind === "write" && x.entity === t)).length;
  const shared = [...written].filter((t) => writers(t) > 1);
  const most = [...modules].sort((a, b) => b.serves - a.serves)[0];
  const kinds: Record<string, number> = {};
  for (const e of entries) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
  const KIND: Record<string, string> = { http: "routes", schedule: "tâches planifiées", message: "files", event: "événements", rpc: "appelables", cli: "commandes" };
  return {
    modules, calls, entries,
    tiles: [
      { label: "Modules", value: String(modules.length), note: (["own", "shared", "base"] as Column[]).map((c) => `${modules.filter((m) => m.column === c).length} ${COLUMN[c].title.toLowerCase()}`).join(", ") },
      { label: "Points d'entrée", value: String(entries.length), note: Object.entries(kinds).map(([k, n]) => `${n} ${KIND[k] ?? k}`).join(", ") || "aucun" },
      { label: "Données écrites", value: plural(written.size, "table", "tables"), note: written.size ? (shared.length ? `${shared.length} écrite${shared.length > 1 ? "s" : ""} par plusieurs modules` : "chacune par un seul module") : "aucune écriture lue" },
      { label: "Le plus partagé", value: most?.node.name ?? "aucun", note: most ? `${most.serves} entrées sur ${entries.length}` : "pas de module calculé" },
      { label: "Origine", value: modules.some((m) => m.contract) ? "calculés, 1 contrat lu" : "calculés", note: "regroupés par dossier, servis selon les appels" },
    ],
  };
}

/** Les points d'entrée d'un bloc, rangés par premier segment de chemin (`/bookings`) ou par genre. */
export function entryGroups(entries: Entrypoint[]): { name: string; entries: Entrypoint[] }[] {
  const by = new Map<string, Entrypoint[]>();
  for (const e of entries) {
    const path = e.kind === "http" ? (e.key.split(" ")[1] ?? "") : "";
    const k = e.kind === "http" ? `/${path.split("/").filter(Boolean)[0] ?? ""}` : e.kind === "schedule" ? "tâches planifiées" : e.kind === "message" ? "files" : e.kind;
    (by.get(k) ?? by.set(k, []).get(k)!).push(e);
  }
  return [...by].map(([name, list]) => ({ name, entries: list })).sort((a, b) => b.entries.length - a.entries.length);
}

/** Le module où vit le code d'un point d'entrée. */
export function moduleOf(p: MapPayload, e: Entrypoint): ArchNode | undefined {
  const path = e.handler?.path ?? e.proof.path;
  return p.model.nodes.find((n) => n.level === "component" && (n.files ?? []).includes(path));
}

export const callCount = (calls: ArchEdge[], from: string, to: string) => calls.filter((c) => c.from === from && c.to === to).reduce((n, c) => n + c.count, 0);

/** S3, les fonctions qu'un module offre : chacune avec le nombre de lignes qui l'appellent et ses effets, des plus appelées aux moins appelées. */
export function offered(block: ArchNode, module: ArchNode) {
  const files = new Set(module.files ?? []);
  return (block.facets.functions ?? []).filter((f) => files.has(f.proof.path)).map((f) => {
    const fx = (f.flow ?? []).filter((s) => s.depth === 0);
    const effects = [
      ...[...new Set(fx.filter((s) => s.kind === "write").map((s) => s.target?.entity).filter(Boolean))].map((x) => ({ kind: "write" as const, what: x! })),
      ...[...new Set(fx.filter((s) => s.kind === "read").map((s) => s.target?.entity).filter(Boolean))].map((x) => ({ kind: "read" as const, what: x! })),
      ...[...new Set(fx.filter((s) => s.kind === "message").map((s) => s.target?.topic).filter(Boolean))].map((x) => ({ kind: "message" as const, what: x! })),
      ...[...new Set(fx.filter((s) => s.kind === "refuse").map((s) => s.status ?? s.code).filter(Boolean))].map((x) => ({ kind: "refuse" as const, what: x! })),
    ];
    return { fn: f, callers: f.calledFrom?.length ?? 0, effects };
  }).sort((a, b) => b.callers - a.callers || b.effects.length - a.effects.length);
}
