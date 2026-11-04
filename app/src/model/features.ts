import type { Entrypoint, FlowStep, MapPayload } from "../api/types";

/**
 * Les fonctionnalités d'un projet : ses points d'entrée, regroupés d'après l'adresse (la ressource) ou le genre, et
 * pour chacun la chaîne de ce qu'il fait, dans l'ordre du code. Le regroupement vient de la structure, jamais d'un
 * métier deviné ; la chaîne, du déroulé extrait du code.
 */

export type LinkKind = "read" | "write" | "message" | "request" | "refuse" | "reply";
export interface Link { kind: LinkKind; tx: boolean; values: string[] }
export interface Feature { entry: Entrypoint; chain: Link[] }
export interface FeatureGroup { id: string; name: string; http: boolean; features: Feature[]; writes: string[] }

const TARGETED = new Set<FlowStep["kind"]>(["read", "write", "message", "request"]);
const OTHER: Record<string, string> = { schedule: "Tâches planifiées", message: "Consommateurs de files", event: "Événements", cli: "Commandes" };

/** La chaîne d'un déroulé : les étapes qui se voient depuis l'extérieur ; deux étapes voisines de même genre n'en font qu'une. */
export function chainOf(steps: FlowStep[], name: (node: string) => string = (x) => x): Link[] {
  const out: Link[] = [];
  for (const s of steps) {
    let kind: LinkKind, value: string;
    if (s.kind === "refuse") { kind = "refuse"; value = s.status ? String(s.status) : "erreur"; }
    else if (s.kind === "reply") { kind = "reply"; value = s.status ? String(s.status) : "200"; }
    else if (TARGETED.has(s.kind) && s.target) { kind = s.kind as LinkKind; value = s.target.entity ?? s.target.topic ?? name(s.target.node); }
    else continue;
    const tx = !!s.tx, last = out[out.length - 1];
    if (last && last.kind === kind && last.tx === tx) { if (!last.values.includes(value)) last.values.push(value); }
    else out.push({ kind, tx, values: [value] });
  }
  return out;
}

/** La tranche d'une chaîne qui reste dans une même transaction forme un cadre. */
export function chainRuns(chain: Link[]): { tx: boolean; links: Link[] }[] {
  const out: { tx: boolean; links: Link[] }[] = [];
  for (const l of chain) {
    const last = out[out.length - 1];
    if (last && last.tx === l.tx) last.links.push(l);
    else out.push({ tx: l.tx, links: [l] });
  }
  return out;
}

const PREFIX = /^(api|rest|v\d+)$/i;
/** La ressource d'une route : le premier segment fixe, passé les préfixes d'API (`/api/v1`). */
export function resourceOf(key: string): string {
  const path = key.split(" ")[1] ?? key;
  const seg = path.split("/").filter((x) => x && !/^[:{*]/.test(x));
  return seg.find((x) => !PREFIX.test(x)) ?? seg[0] ?? "/";
}

/** Les segments fixes d'une route, passé les préfixes d'API. */
const fixedSegments = (key: string) => (key.split(" ")[1] ?? key).split("/").filter(Boolean).filter((x, i, all) => !(PREFIX.test(x) && all.slice(0, i).every((y) => PREFIX.test(y)))).filter((x) => !/^[:{*]/.test(x));

/**
 * Le nom du groupe de chaque route. Un espace d'adresses comme `/admin` n'est pas une ressource : quand toutes ses
 * routes ont un second segment fixe, et qu'il y en a au moins deux différents, c'est ce second segment qui groupe.
 */
export function resourceNames(keys: string[]): Map<string, string> {
  const byFirst = new Map<string, string[][]>();
  for (const k of keys) { const seg = fixedSegments(k); const f = seg[0] ?? resourceOf(k); (byFirst.get(f) ?? byFirst.set(f, []).get(f)!).push(seg); }
  const out = new Map<string, string>();
  for (const k of keys) {
    const seg = fixedSegments(k), first = seg[0] ?? resourceOf(k), all = byFirst.get(first)!;
    const split = all.every((x) => x[1]) && new Set(all.map((x) => x[1])).size > 1;
    out.set(k, split ? `/${first}/${seg[1]}` : first === "/" ? "/" : `/${first}`);
  }
  return out;
}

export function featureGroups(p: MapPayload): FeatureGroup[] {
  const nodeName = (id: string) => p.model.nodes.find((n) => n.id === id)?.name ?? id;
  const groups = new Map<string, FeatureGroup>();
  const names = resourceNames(p.model.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind === "http" || e.kind === "rpc").map((e) => e.key));
  for (const n of p.model.nodes) for (const e of n.facets.entrypoints ?? []) {
    if (e.kind === "main") continue;
    const http = e.kind === "http" || e.kind === "rpc";
    const label = http ? names.get(e.key)! : OTHER[e.kind] ?? e.kind;
    const id = `${http ? "r" : "k"}:${label}`;
    const g = groups.get(id) ?? groups.set(id, { id, name: label, http, features: [], writes: [] }).get(id)!;
    g.features.push({ entry: e, chain: chainOf(e.flow ?? [], nodeName) });
    for (const s of e.flow ?? []) if (s.kind === "write" && s.target) { const w = s.target.entity ?? nodeName(s.target.node); if (!g.writes.includes(w)) g.writes.push(w); }
  }
  return [...groups.values()].sort((a, b) => Number(b.http) - Number(a.http) || b.features.length - a.features.length);
}
