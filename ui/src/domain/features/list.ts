import type { ArchModelV2, ArchNode, Entrypoint } from "../../api/types";
import { splitRoute } from "../block/resources";

/** Un point d'entrée et le bloc qui le porte. */
export interface EntryRef {
  entry: Entrypoint;
  node: ArchNode;
}

/**
 * Un regroupement proposé par VisionLayer : les routes d'une même ressource,
 * ou ce qui tourne sans clic. Ce n'est pas une feature : une feature a un nom
 * et un but, que seul un agent ou une personne peut déclarer.
 */
export interface EntryGroup {
  id: string;
  title: string;
  /** Pourquoi ces points d'entrée sont ensemble. */
  reason: string;
  entries: EntryRef[];
}

const BACKGROUND: Partial<Record<Entrypoint["kind"], [string, string]>> = {
  schedule: ["Tâches planifiées", "lancées par une horloge"],
  message: ["Files écoutées", "lancées par un message"],
  event: ["Événements reçus", "lancées par un événement"],
  rpc: ["Fonctions appelables", "appelées directement"],
  cli: ["Commandes", "lancées à la main"],
};

/** Tous les points d'entrée qu'on déclenche, rangés en regroupements proposés, dans l'ordre de la carte. */
export function entryGroups(model: ArchModelV2): EntryGroup[] {
  const services = model.nodes.filter((n) => (n.facets.entrypoints ?? []).some((e) => e.kind === "http"));
  const groups = new Map<string, EntryGroup>();
  const add = (id: string, title: string, reason: string, ref: EntryRef) =>
    (groups.get(id) ?? groups.set(id, { id, title, reason, entries: [] }).get(id)!).entries.push(ref);
  for (const node of model.nodes) for (const entry of node.facets.entrypoints ?? []) {
    if (entry.kind === "main") continue;
    if (entry.kind === "http") {
      const path = `/${splitRoute(entry.key).segments[0]?.text ?? ""}`;
      add(`${node.id}:${path}`, services.length > 1 ? `${node.name} · ${path}` : path, "même ressource", { entry, node });
    } else {
      const [title, reason] = BACKGROUND[entry.kind] ?? [entry.kind, ""];
      add(entry.kind, title, reason, { entry, node });
    }
  }
  // Les routes d'abord, puis ce qui tourne sans clic, dans l'ordre des natures.
  const order = (g: EntryGroup) => (g.entries[0]!.entry.kind === "http" ? -1 : Object.keys(BACKGROUND).indexOf(g.id));
  return [...groups.values()].sort((a, b) => order(a) - order(b));
}

export function findEntry(model: ArchModelV2, id: string): EntryRef | undefined {
  for (const node of model.nodes) for (const entry of node.facets.entrypoints ?? []) if (entry.id === id) return { entry, node };
  return undefined;
}

/** Ce qu'un point d'entrée, ou une fonction, atteint d'après son déroulé : les tables, les files et les services appelés. */
export function reachOf(entry: Pick<Entrypoint, "flow">, names: Map<string, string>): { tables: string[]; topics: string[]; services: string[] } {
  const steps = entry.flow ?? [];
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  return {
    tables: uniq(steps.filter((s) => s.kind === "read" || s.kind === "write").map((s) => s.target?.entity)),
    topics: uniq(steps.filter((s) => s.kind === "message").map((s) => s.target?.topic)),
    services: uniq(steps.filter((s) => s.kind === "request" || s.kind === "call").map((s) => s.target && (names.get(s.target.node) ?? s.target.node))),
  };
}

/** Les refus d'un déroulé, sans doublon : `401`, `404 not_found`. */
export function refusalsOf(entry: Entrypoint): string[] {
  return [...new Set((entry.flow ?? []).filter((s) => s.kind === "refuse").map((s) => [s.status, s.code].filter(Boolean).join(" ") || s.name || "erreur"))];
}
