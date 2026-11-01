import type { ArchNode, Entrypoint, MapPayload, Proof } from "../api/types";
import { sentence } from "./overview";
import { plural } from "./words";

/**
 * La planche 04 (Accès, par acteur), calculée depuis les gardes des points d'entrée : qui appelle le
 * système, comment il prouve qui il est, ce qu'il atteint. Ce que le moteur ne lit pas encore (la
 * comparaison entre la donnée et l'appelant, la durée d'une session) est dit « non lu », jamais deviné.
 */

export interface ActorRow {
  id: string; group: "people" | "outside" | "system";
  name: string; note?: string;
  proof: string; proofKind: "k" | "g" | "";
  by?: { name: string; proof?: Proof };
  reach: number; total: number; reachText?: string;
  data: string; see?: string; seeProof?: Proof;
  routes: Entrypoint[];
}

const http = (n: ArchNode) => (n.facets.entrypoints ?? []).filter((e) => e.kind === "http" || e.kind === "rpc");

export function actors(p: MapPayload): { rows: ActorRow[]; total: number; byLevel: Record<string, number>; mechanism?: { name: string; proof: Proof } } {
  const programs = p.model.nodes.filter((n) => n.level === "deployable" && http(n).length);
  const routes = programs.flatMap(http);
  const total = routes.length;
  const byLevel: Record<string, number> = {};
  for (const e of routes) byLevel[e.access?.level ?? "unknown"] = (byLevel[e.access?.level ?? "unknown"] ?? 0) + 1;
  const mechanism = programs.flatMap((n) => n.facets.trust?.mechanisms ?? [])[0];
  const byOf = (list: Entrypoint[]) => {
    const fns = new Map<string, { n: number; proof?: Proof }>();
    for (const e of list) if (e.access?.by) { const k = `${e.access.by.name}()`; const x = fns.get(k) ?? { n: 0, proof: { path: e.access.by.path, line: e.access.by.line, source: "syntax" as const } }; x.n++; fns.set(k, x); }
    const top = [...fns].sort((a, b) => b[1].n - a[1].n)[0];
    return top ? { name: top[0], ...(top[1].proof ? { proof: top[1].proof } : {}) } : undefined;
  };
  const unguarded = p.model.findings.filter((f) => f.code === "unguarded_route");
  const rows: ActorRow[] = [];

  // Les personnes : une route sans garde est à tous ; une route gardée par une connexion, à qui est connecté ; un rôle, à ce rôle.
  const open = routes.filter((e) => e.access?.level === "public");
  const signedIn = routes.filter((e) => e.access?.level === "authenticated");
  const roles = routes.filter((e) => e.access?.level === "role");
  if (open.length) rows.push({ id: "public", group: "people", name: "Visiteur", proof: "aucune preuve", proofKind: "", reach: open.length, total, data: "sans objet", routes: open });
  if (signedIn.length) {
    const reach = [...open, ...signedIn];
    const f = unguarded[0];
    rows.push({
      id: "authenticated", group: "people", name: "Personne connectée", proof: mechanism ? mechanism.name : "session, non lue", proofKind: "k", ...(byOf(signedIn) ? { by: byOf(signedIn)! } : {}),
      reach: reach.length, total, data: "non lu", ...(f ? { see: `atteint ${sentence(f.message)}`, seeProof: f.proof[0]! } : {}), routes: reach,
    });
  }
  if (roles.length) {
    const names = [...new Set(roles.flatMap((e) => e.access?.roles ?? []))];
    const reach = [...open, ...signedIn, ...roles];
    const unassigned = p.model.findings.find((f) => f.code === "unused_value" && /\.role\b/.test(f.message) && (!names.length || names.some((r) => f.message.includes(`« ${r} »`))));
    rows.push({
      id: "role", group: "people", name: names.length ? names.map((r) => `Rôle ${r}`).join(", ") : "Rôle vérifié", note: names.length ? undefined : "le code ne nomme pas le rôle", proof: mechanism ? mechanism.name : "session, non lue", proofKind: "k",
      ...(byOf(roles) ? { by: byOf(roles)! } : {}), reach: reach.length, total, data: "non lu",
      ...(unassigned ? { see: "aucun code n'attribue ce rôle", seeProof: unassigned.proof[0]! } : {}), routes: reach,
    });
  }

  // Les services extérieurs : un appel signé vient d'un service que la carte connaît (un webhook).
  for (const e of routes.filter((x) => x.access?.level === "signature")) {
    const from = e.calledBy?.map((id) => p.model.nodes.find((n) => n.id === id)).find((n) => n?.role === "external");
    rows.push({ id: `sig:${e.id}`, group: "outside", name: from?.name ?? "Service signé", note: e.key, proof: "signature", proofKind: "g", ...(byOf([e]) ? { by: byOf([e])! } : {}), reach: 1, total, data: "sans objet", routes: [e] });
  }

  // Le système lui-même : ce qui tourne sans appelant, tâches planifiées et consommateurs de file.
  const twice = p.model.findings.find((f) => f.code === "scheduled_on_every_instance");
  for (const n of p.model.nodes.filter((x) => x.level === "deployable")) {
    for (const e of (n.facets.entrypoints ?? []).filter((x) => x.kind === "schedule" || x.kind === "message" || x.kind === "event")) {
      const machines = n.instances?.min ?? 1;
      rows.push({
        id: e.id, group: "system", name: e.handler?.name && e.handler.name !== "fonction anonyme" ? `${e.handler.name}()` : n.name,
        note: e.kind === "schedule" ? `planifiée ${e.key}` : `lit la file ${e.key}`, proof: "interne", proofKind: "", reach: 0, total,
        reachText: e.kind === "schedule" ? "tâche" : "file", data: "toutes",
        ...(e.kind === "schedule" && machines > 1 ? { see: `tourne sur les ${machines} machines`, ...(twice ? { seeProof: twice.proof[0]! } : {}) } : {}), routes: [],
      });
    }
  }
  return { rows, total, byLevel, ...(mechanism ? { mechanism } : {}) };
}

/** Ce qu'un acteur atteint, rangé par premier segment de chemin : « /bookings 4 / 4 ». */
export function reachByResource(p: MapPayload, row: ActorRow): { name: string; reached: number; of: number; danger: boolean }[] {
  const all = p.model.nodes.filter((n) => n.level === "deployable").flatMap(http);
  const seg = (e: Entrypoint) => { const path = e.key.split(" ")[1] ?? e.key; const s = path.split("/").filter(Boolean)[0]; return s ? `/${s}` : "/"; };
  const flagged = new Set(p.model.findings.filter((f) => f.code === "unguarded_route").flatMap((f) => f.proof.map((x) => `${x.path}:${x.line}`)));
  const groups = new Map<string, { reached: number; of: number; danger: boolean }>();
  for (const e of all) {
    const g = groups.get(seg(e)) ?? groups.set(seg(e), { reached: 0, of: 0, danger: false }).get(seg(e))!;
    g.of++;
    if (row.routes.includes(e)) { g.reached++; if (flagged.has(`${e.proof.path}:${e.proof.line}`) && row.id !== "public") g.danger = true; }
  }
  return [...groups].filter(([, g]) => g.reached).map(([name, g]) => ({ name, ...g })).sort((a, b) => Number(b.danger) - Number(a.danger) || b.of - a.of);
}

/** La phrase des cases du haut. */
export function levelsText(byLevel: Record<string, number>): string {
  const w: Record<string, string> = { public: "ouverts à tous", authenticated: "avec une session", role: "avec un rôle", signature: "signés", internal: "internes", unknown: "à garde non reconnue" };
  return Object.entries(byLevel).map(([k, n]) => `${n} ${w[k] ?? k}`).join(", ");
}
export { plural };
