import type { ArchNode, Entrypoint, MapPayload, Proof } from "../api/types";
import { sentence } from "./overview";
import { plural } from "./words";

/**
 * La planche 04 (Accès, par acteur), calculée depuis les gardes des points d'entrée : qui appelle le
 * système, comment il prouve qui il est, ce qu'il atteint. Ce que le moteur ne lit pas encore (la
 * comparaison entre la donnée et l'appelant, la durée d'une session) est dit “non lu”, jamais deviné.
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

/**
 * Les points d'entrée qui concernent un bloc : ceux d'un programme, ceux qu'appelle un service extérieur, ceux dont le
 * déroulé touche une ressource. Sans bloc, tous.
 */
export function routesOf(p: MapPayload, scope?: ArchNode): Entrypoint[] {
  const all = p.model.nodes.filter((n) => n.level === "deployable").flatMap(http);
  if (!scope) return all;
  if (http(scope).length) return http(scope);
  return all.filter((e) => e.calledBy?.includes(scope.id) || (e.flow ?? []).some((s) => s.target?.node === scope.id));
}

export function actors(p: MapPayload, scope?: ArchNode): { rows: ActorRow[]; total: number; byLevel: Record<string, number>; mechanism?: { name: string; proof: Proof } } {
  const routes = routesOf(p, scope);
  const programs = p.model.nodes.filter((n) => n.level === "deployable" && http(n).some((e) => routes.includes(e)));
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
  if (open.length) rows.push({ id: "public", group: "people", name: "Visitor", proof: "no proof", proofKind: "", reach: open.length, total, data: "not applicable", routes: open });
  if (signedIn.length) {
    const reach = [...open, ...signedIn];
    const f = unguarded[0];
    rows.push({
      id: "authenticated", group: "people", name: "Logged-in person", proof: mechanism ? mechanism.name : "session, not read", proofKind: "k", ...(byOf(signedIn) ? { by: byOf(signedIn)! } : {}),
      reach: reach.length, total, data: "not read", ...(f ? { see: `atteint ${sentence(f.message)}`, seeProof: f.proof[0]! } : {}), routes: reach,
    });
  }
  if (roles.length) {
    const names = [...new Set(roles.flatMap((e) => e.access?.roles ?? []))];
    const reach = [...open, ...signedIn, ...roles];
    const unassigned = p.model.findings.find((f) => f.code === "unused_value" && /\.role\b/.test(f.message) && (!names.length || names.some((r) => f.message.includes(`“${r}”`))));
    rows.push({
      id: "role", group: "people", name: names.length ? names.map((r) => `Role ${r}`).join(", ") : "Role checked", note: names.length ? undefined : "the code doesn't name the role", proof: mechanism ? mechanism.name : "session, not read", proofKind: "k",
      ...(byOf(roles) ? { by: byOf(roles)! } : {}), reach: reach.length, total, data: "not read",
      ...(unassigned ? { see: "no code assigns this role", seeProof: unassigned.proof[0]! } : {}), routes: reach,
    });
  }

  // Une garde que le moteur ne reconnaît pas : ces routes ont une porte, mais personne ne sait encore laquelle.
  const unknown = routes.filter((e) => !e.access || e.access.level === "unknown");
  if (unknown.length) rows.push({ id: "unknown", group: "people", name: "Guard not recognized", note: "no pack reads the guard of these routes yet", proof: "not read", proofKind: "", reach: unknown.length, total, data: "not read", routes: unknown });

  // Les services extérieurs : un appel signé vient d'un service que la carte connaît (un webhook).
  for (const e of routes.filter((x) => x.access?.level === "signature")) {
    const from = e.calledBy?.map((id) => p.model.nodes.find((n) => n.id === id)).find((n) => n?.role === "external");
    rows.push({ id: `sig:${e.id}`, group: "outside", name: from?.name ?? "Signed service", note: e.key, proof: "signature", proofKind: "g", ...(byOf([e]) ? { by: byOf([e])! } : {}), reach: 1, total, data: "not applicable", routes: [e] });
  }

  // Le système lui-même : ce qui tourne sans appelant, tâches planifiées et consommateurs de file.
  const twice = p.model.findings.find((f) => f.code === "scheduled_on_every_instance");
  for (const n of p.model.nodes.filter((x) => x.level === "deployable" && (!scope || x.id === scope.id))) {
    for (const e of (n.facets.entrypoints ?? []).filter((x) => x.kind === "schedule" || x.kind === "message" || x.kind === "event")) {
      const machines = n.instances?.min ?? 1;
      rows.push({
        id: e.id, group: "system", name: e.handler?.name && e.handler.name !== "anonymous function" ? `${e.handler.name}()` : n.name,
        note: e.kind === "schedule" ? `scheduled ${e.key}` : `reads queue ${e.key}`, proof: "interne", proofKind: "", reach: 0, total,
        reachText: e.kind === "schedule" ? "task" : "queue", data: "all",
        ...(e.kind === "schedule" && machines > 1 ? { see: `runs on the ${machines} machines`, ...(twice ? { seeProof: twice.proof[0]! } : {}) } : {}), routes: [],
      });
    }
  }
  return { rows, total, byLevel, ...(mechanism ? { mechanism } : {}) };
}

/** Ce qu'un acteur atteint, rangé par premier segment de chemin : “/bookings 4 / 4”. */
export function reachByResource(p: MapPayload, row: ActorRow, scope?: ArchNode): { name: string; reached: number; of: number; danger: boolean }[] {
  const all = routesOf(p, scope);
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
  const w: Record<string, string> = { public: "open to all", authenticated: "with a session", role: "with a role", signature: "signed", internal: "internes", unknown: "with an unrecognized guard" };
  return Object.entries(byLevel).map(([k, n]) => `${n} ${w[k] ?? k}`).join(", ");
}
export { plural };

/**
 * X1, la matrice d'accès : pour chaque table, ce que chaque acteur peut y faire, déduit des déroulés des routes
 * qu'il atteint (une écriture l'emporte sur une lecture). Les tâches du système ne sont pas des acteurs ici.
 */
export function accessMatrix(rows: ActorRow[], only?: string[]) {
  const actorsIn = rows.filter((r) => r.group !== "system" && r.routes.length);
  const cells = new Map<string, Map<string, "write" | "read">>();
  for (const a of actorsIn) {
    for (const e of a.routes) {
      for (const s of e.flow ?? []) {
        const t = s.target?.entity;
        if (!t || (s.kind !== "write" && s.kind !== "read") || (only && !only.includes(t))) continue;
        const row = cells.get(t) ?? cells.set(t, new Map()).get(t)!;
        if (row.get(a.id) !== "write") row.set(a.id, s.kind);
      }
    }
  }
  const tables = [...cells.keys()].sort((x, y) => [...cells.get(y)!.values()].filter((k) => k === "write").length - [...cells.get(x)!.values()].filter((k) => k === "write").length || x.localeCompare(y));
  const open = actorsIn.find((a) => a.id === "public");
  const openWrites = open ? tables.filter((t) => cells.get(t)!.get(open.id) === "write") : [];
  const sentence = !tables.length ? "No table is touched by a route read."
    : openWrites.length ? `With no proof at all, a visitor writes ${openWrites.slice(0, 3).map((t) => `\`${t}\``).join(", ")}${openWrites.length > 3 ? ` and ${openWrites.length - 3} more` : ""}.`
    : `${plural(tables.length, "table is touched", "tables are touched")} by ${plural(actorsIn.length, "actor", "actors")}; a visitor writes none.`;
  return { actors: actorsIn, tables, cell: (t: string, a: string) => cells.get(t)?.get(a), sentence };
}

export interface Layer { name: string; what: string; state: "read" | "unread" | "absent" | "none"; proof?: Proof; note: string }
/** X2, la pile des couches qu'un appel de cet acteur traverse, de l'entrée à la base : ce qui est lu, ce qui ne l'est pas, ce qui manque. */
export function layers(p: MapPayload, row: ActorRow): Layer[] {
  const mech = p.model.nodes.flatMap((n) => n.facets.trust?.mechanisms ?? [])[0];
  const out: Layer[] = [];
  out.push(mech ? { name: mech.name, what: "reads the caller's proof", state: "read", proof: mech.proof, note: "read" } : { name: "Proof", what: "what reads the session or token", state: "unread", note: "not read" });
  if (row.group === "system") out.push({ name: "No guard", what: "the system calls itself", state: "none", note: "not applicable" });
  else if (row.id === "public") out.push({ name: "No guard", what: "the route is open to all", state: "none", note: "intended or not, to decide" });
  else if (row.by) out.push({ name: row.by.name, what: row.group === "outside" ? "checks the signature" : "refuses without valid proof", state: "read", ...(row.by.proof ? { proof: row.by.proof } : {}), note: "read" });
  else out.push({ name: "Guard", what: "the guard of these routes", state: "unread", note: "not read" });
  const roles = p.model.nodes.some((n) => (n.facets.entrypoints ?? []).some((e) => e.access?.level === "role"));
  if (row.id === "role") out.push({ name: "Role", what: "checked before acting", state: "read", ...(row.by?.proof ? { proof: row.by.proof } : {}), note: "read" });
  else if (row.id === "authenticated" && roles && row.see) out.push({ name: "Role", what: "never checked on some routes", state: "absent", ...(row.seeProof ? { proof: row.seeProof } : {}), note: "absent" });
  if (row.group === "people" && row.id !== "public") out.push({ name: "On the data", what: "does the row belong to the caller?", state: "unread", note: "not read" });
  out.push({ name: "Database", what: "row-level rules", state: "none", note: "none read" });
  return out;
}
