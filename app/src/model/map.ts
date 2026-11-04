import type { ArchEdge, ArchNode, EdgeKind, MapPayload, Occurrence } from "../api/types";
import { isUnread, PROGRAM_ROLES } from "./overview";

/**
 * La planche 03 (Carte) en grille de cinq colonnes : ce qui appelle, ses flèches, ce qui tourne, ses
 * flèches, ce qu'ils utilisent. Le couloir du milieu se lit de haut en bas : un service, la file où il
 * dépose, le worker qui la consomme, le service extérieur que ce worker seul appelle. Rien n'est placé à
 * la main : chaque place vient du rôle d'un bloc et du sens de ses liens.
 */

export interface MapLink { id: string; from: string; to: string; kind: EdgeKind; count: number; first?: Occurrence; entities: string[] }
export interface Arrow { link: MapLink; back: boolean; label: string; target?: string }
export interface Row { left?: ArchNode; leftArrows: Arrow[] }
export interface Middle { node: ArchNode; rows: Row[]; rightArrows: Arrow[]; down?: { link: MapLink; label: string } }
export interface MapGrid { middle: Middle[]; right: ArchNode[]; links: MapLink[] }

/** Un lien par paire et par sorte, ses lignes additionnées, et les tables ou files qu'il touche. */
export function aggregate(edges: ArchEdge[]): MapLink[] {
  const by = new Map<string, MapLink>();
  for (const e of edges) {
    const id = `${e.from}>${e.kind}>${e.to}`;
    const l = by.get(id) ?? by.set(id, { id, from: e.from, to: e.to, kind: e.kind, count: 0, entities: [] }).get(id)!;
    l.count += e.count;
    l.first ??= e.occurrences[0];
    const t = e.target?.entity ?? e.target?.topic;
    if (t && !l.entities.includes(t)) l.entities.push(t);
  }
  return [...by.values()];
}

/** Les mots d'une flèche : « 21 écritures », « 8 appels », « 6 mises en file ». */
export function countLabel(kind: EdgeKind, n: number): string {
  const w: Record<EdgeKind, [string, string]> = {
    call: ["appel", "appels"], request: ["appel", "appels"], read: ["lecture", "lectures"], write: ["écriture", "écritures"],
    message: ["mise en file", "mises en file"], trigger: ["déclenche", "déclenche"], use: ["import, sans pack", "imports, sans pack"], deploy: ["déploiement", "déploiements"],
  };
  return kind === "trigger" ? "déclenche" : `${n} ${w[kind][n > 1 ? 1 : 0]}`;
}

export function mapGrid(p: MapPayload): MapGrid {
  const nodes = p.model.nodes.filter((n) => n.level !== "component" && n.role !== "actor");
  const ids = new Set(nodes.map((n) => n.id));
  const links = aggregate(p.model.edges.filter((e) => ids.has(e.from) && ids.has(e.to)));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const role = (id: string) => byId.get(id)?.role ?? "";
  const program = (id: string) => PROGRAM_ROLES.has(role(id)) && role(id) !== "app";

  // Ce qui appelle : les applications clientes, et un service extérieur qui appelle un programme (un webhook).
  const callsIn = (n: ArchNode) => links.some((l) => l.from === n.id && ["call", "trigger"].includes(l.kind) && program(l.to));
  const left = nodes.filter((n) => n.role === "app" || (n.role === "external" && callsIn(n)));
  // Un service extérieur que seuls des workers appellent se lit sous eux, dans le couloir du milieu.
  const callers = (n: ArchNode) => links.filter((l) => l.to === n.id).map((l) => byId.get(l.from)!).filter(Boolean);
  const underWorker = (n: ArchNode) => n.role === "external" && !callsIn(n) && callers(n).length > 0 && callers(n).every((c) => c.role === "worker" || c.role === "job");
  const weight = (n: ArchNode) => (n.facets.entrypoints?.length ?? 0) * 10 + links.filter((l) => l.from === n.id || l.to === n.id).length;
  const services = nodes.filter((n) => PROGRAM_ROLES.has(n.role) && n.role !== "app" && n.role !== "worker" && n.role !== "job").sort((a, b) => weight(b) - weight(a));
  const workers = nodes.filter((n) => n.role === "worker" || n.role === "job").sort((a, b) => weight(b) - weight(a));
  const channels = nodes.filter((n) => n.role === "channel");
  const mids = nodes.filter(underWorker);
  const order: ArchNode[] = [...services, ...channels, ...workers, ...mids];
  // Un système sans serveur (une app seule) : ce qui appelle est aussi ce qui tourne ; sans cela, il ne serait dessiné nulle part.
  const incoming = order.length ? left : [];
  if (!order.length) order.push(...left);
  const right = nodes.filter((n) => !incoming.includes(n) && !order.includes(n));

  const arrow = (l: MapLink, back: boolean, named: boolean): Arrow => ({ link: l, back, label: countLabel(l.kind, l.count), ...(named ? { target: byId.get(back ? l.from : l.to)?.name } : {}) });
  const home = new Map<string, number>();
  for (const n of incoming) {
    const target = order.findIndex((m) => links.some((l) => (l.from === n.id && l.to === m.id) || (l.to === n.id && l.from === m.id)));
    home.set(n.id, target < 0 ? 0 : target);
  }
  const middle: Middle[] = order.map((node, i) => {
    const mine = incoming.filter((n) => home.get(n.id) === i);
    const rows: Row[] = (mine.length ? mine : [undefined]).map((l) => ({
      ...(l ? { left: l } : {}),
      leftArrows: l ? [
        ...links.filter((x) => x.from === l.id && x.to === node.id).map((x) => arrow(x, false, false)),
        ...links.filter((x) => x.from === node.id && x.to === l.id).map((x) => arrow(x, true, false)),
      ] : [],
    }));
    const rightArrows = links.filter((x) => x.from === node.id && right.some((r) => r.id === x.to))
      .sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || b.count - a.count)
      .map((x) => arrow(x, false, right.length > 1));
    const next = order[i + 1];
    const down = next && links.find((x) => (x.from === node.id && x.to === next.id) || (x.from === next.id && x.to === node.id));
    return { node, rows, rightArrows, ...(down ? { down: { link: down, label: countLabel(down.kind, down.count) } } : {}) };
  });
  return { middle, right, links };
}

const kindOrder = (k: EdgeKind) => ["write", "read", "message", "request", "call", "use", "trigger"].indexOf(k);

/** Le bloc choisi par défaut : le programme qui a le plus de points d'entrée. */
export function defaultSelection(p: MapPayload): string | undefined {
  return [...p.model.nodes].filter((n) => n.level === "deployable" && PROGRAM_ROLES.has(n.role))
    .sort((a, b) => (b.facets.entrypoints?.length ?? 0) - (a.facets.entrypoints?.length ?? 0))[0]?.id;
}

/** Les lignes mono d'un bloc, comme sur la planche : ses technologies, puis ce qu'il expose ou porte. */
export function blockLines(n: ArchNode, tech: MapPayload["tech"]): string[] {
  const out: string[] = [];
  const names = (n.tech ?? []).map((t) => tech[t]?.name ?? t);
  if (names.length && !isUnread(n)) out.push(names.slice(0, 3).join(", ") + (names.length > 3 ? `, +${names.length - 3}` : ""));
  const ep = (n.facets.entrypoints ?? []).filter((e) => e.kind !== "main");
  const routes = ep.filter((e) => e.kind === "http" || e.kind === "rpc");
  if (routes.length) {
    const guarded = routes.filter((e) => e.access && !["public", "unknown"].includes(e.access.level)).length;
    out.push(`${routes.length} route${routes.length > 1 ? "s" : ""}${guarded ? `, ${guarded} gardée${guarded > 1 ? "s" : ""}` : ""}`);
  }
  const schedules = ep.filter((e) => e.kind === "schedule").length;
  if (schedules) out.push(`${schedules} tâche${schedules > 1 ? "s" : ""} planifiée${schedules > 1 ? "s" : ""}`);
  const consumes = ep.filter((e) => e.kind === "message" || e.kind === "event").map((e) => e.key);
  if (consumes.length) out.push(`consomme ${consumes.join(", ")}`);
  const topics = n.facets.channel?.topics.map((t) => t.name) ?? [];
  if (topics.length) out.push(`file${topics.length > 1 ? "s" : ""} ${topics.join(", ")}`);
  if (isUnread(n)) out.push(n.subtitle!.replace(/ : non lue?$/, ""));
  return out;
}

/** Les tables d'un stockage, du point de vue du bloc choisi : celles qu'il écrit, celles qu'il lit ; sinon toutes. */
export function tableGroups(store: ArchNode, selected: ArchNode | undefined, links: MapLink[]): { label: string; cls: "w" | "r" | "q"; tables: string[] }[] {
  const all = store.facets.data?.entities.map((e) => e.name) ?? [];
  if (selected && selected.id !== store.id) {
    const w = links.find((l) => l.from === selected.id && l.to === store.id && l.kind === "write")?.entities ?? [];
    const r = links.find((l) => l.from === selected.id && l.to === store.id && l.kind === "read")?.entities ?? [];
    const groups = [
      ...(w.length ? [{ label: `Écrite${w.length > 1 ? "s" : ""} par ${selected.name}`, cls: "w" as const, tables: w }] : []),
      ...(r.length ? [{ label: `Lue${r.length > 1 ? "s" : ""} par ${selected.name}`, cls: "r" as const, tables: r }] : []),
    ];
    if (groups.length) return groups;
  }
  if (!all.length) return [];
  return [{ label: "Tables", cls: "q", tables: all.length > 7 ? [...all.slice(0, 6), `…${all.length - 6} autres`] : all }];
}
