import type { ArchEdge, ArchNode, Guard, Occurrence } from "../arch/types.js";

/**
 * Le niveau contexte (C4) : qui se sert du système, et une phrase par bloc. Rien n'est demandé à un modèle
 * de langage ; tout vient des faits déjà sur la carte.
 *
 * Les acteurs viennent des gardes des points d'entrée HTTP : une route sans garde est ouverte à tout
 * visiteur, une route gardée par une connexion à un utilisateur connecté, une route gardée par un rôle à
 * ce rôle. Un appel signé vient d'un service extérieur déjà sur la carte (un webhook), une route interne
 * d'un autre programme : ni l'un ni l'autre n'est une personne.
 */

const ACTORS: Partial<Record<Guard["level"], { id: string; name: string }>> = {
  public: { id: "actor:public", name: "Visiteur" },
  authenticated: { id: "actor:authenticated", name: "Utilisateur connecté" },
};

export function addActors(nodes: ArchNode[], edges: ArchEdge[]): void {
  const actors = new Map<string, ArchNode>();
  for (const n of nodes.filter((x) => x.level === "deployable")) {
    const by = new Map<string, { name: string; occ: Occurrence[] }>();
    for (const e of n.facets.entrypoints ?? []) {
      if (e.kind !== "http" || !e.access) continue;
      const who = e.access.level === "role"
        ? (e.access.roles?.length ? e.access.roles : [""]).map((r) => ({ id: `actor:role:${r || "?"}`, name: r ? `Rôle ${r}` : "Utilisateur avec un rôle" }))
        : ACTORS[e.access.level] ? [ACTORS[e.access.level]!] : [];
      for (const a of who) {
        const x = by.get(a.id) ?? by.set(a.id, { name: a.name, occ: [] }).get(a.id)!;
        // La ligne de la route, sans ses points d'entrée : un acteur n'est pas un effet du code.
        x.occ.push({ ...e.proof });
      }
    }
    for (const [id, x] of by) {
      if (!actors.has(id)) {
        const actor: ArchNode = { id, name: x.name, level: "system", role: "actor", status: "proposed", proof: [x.occ[0]!], facets: {} };
        actors.set(id, actor);
        nodes.push(actor);
      }
      edges.push({ id: `${id}>call>${n.id}`, from: id, to: n.id, kind: "call", count: x.occ.length, occurrences: x.occ.slice(0, 60) });
    }
  }
  for (const a of actors.values()) {
    const routes = edges.filter((e) => e.from === a.id).reduce((k, e) => k + e.count, 0);
    a.subtitle = `${routes} route${routes > 1 ? "s" : ""} ${a.id === "actor:public" ? "ouverte" : "accessible"}${routes > 1 ? "s" : ""}`;
  }
}

/**
 * La phrase d'un bloc, calculée depuis ses faits : ce qu'il expose, ce qu'il lit et écrit, ce qu'il publie
 * et consomme, ce qu'il appelle. `exposes 15 routes, dont 8 gardées ; écrit dans 9 tables et en lit 5`.
 */
export function describe(nodes: ArchNode[], edges: ArchEdge[]): void {
  const name = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}`);
  for (const n of nodes) {
    if (n.level !== "deployable" || n.summary) continue;
    const parts: string[] = [];
    const ep = n.facets.entrypoints ?? [];
    const http = ep.filter((e) => e.kind === "http" || e.kind === "rpc");
    if (http.length) {
      const guarded = http.filter((e) => e.access && e.access.level !== "public" && e.access.level !== "unknown").length;
      parts.push(`expose ${plural(http.length, "route", "routes")}${guarded ? `, dont ${guarded} gardée${guarded > 1 ? "s" : ""}` : ""}`);
    }
    const schedules = ep.filter((e) => e.kind === "schedule").length;
    if (schedules) parts.push(`lance ${plural(schedules, "tâche planifiée", "tâches planifiées")}`);
    const consumes = ep.filter((e) => e.kind === "message" || e.kind === "event").map((e) => `« ${e.key} »`);
    if (consumes.length) parts.push(`consomme ${list(consumes)}`);
    const out = edges.filter((e) => e.from === n.id);
    // Les tables seulement : une famille de clés Redis n'en est pas une.
    const relational = (id: string) => !!nodes.find((x) => x.id === id)?.facets.data?.shape;
    const entities = (kind: string) => new Set(out.filter((e) => e.kind === kind && e.target?.entity && relational(e.to)).map((e) => e.target!.entity!)).size;
    const [w, r] = [entities("write"), entities("read")];
    if (w || r) parts.push(w && r ? `écrit dans ${plural(w, "table", "tables")} et en lit ${r}` : w ? `écrit dans ${plural(w, "table", "tables")}` : `lit ${plural(r, "table", "tables")}`);
    const topics = [...new Set(out.filter((e) => e.kind === "message" && e.target?.topic).map((e) => `« ${e.target!.topic} »`))];
    if (topics.length) parts.push(`publie sur ${list(topics)}`);
    const called = [...new Set(out.filter((e) => ["request", "use", "call"].includes(e.kind) && nodes.find((x) => x.id === e.to)?.level !== "component").map((e) => name(e.to)))];
    if (called.length) parts.push(`appelle ${list(called)}`);
    if (n.facets.data?.entities.length) {
      const writers = [...new Set(edges.filter((e) => e.to === n.id && e.kind === "write").map((e) => name(e.from)))];
      parts.push(`${plural(n.facets.data.entities.length, "table", "tables")}${writers.length ? `, écrites par ${list(writers)}` : ""}`);
    }
    const triggered = [...new Set(edges.filter((e) => e.from === n.id && e.kind === "trigger").map((e) => name(e.to)))];
    if (n.facets.channel || triggered.length) {
      const producers = [...new Set(edges.filter((e) => e.to === n.id && e.kind === "message").map((e) => name(e.from)))];
      if (producers.length) parts.push(`reçoit les messages de ${list(producers)}`);
      if (triggered.length) parts.push(`réveille ${list(triggered)}`);
    }
    if (parts.length) n.summary = parts.join(" ; ");
  }
}
