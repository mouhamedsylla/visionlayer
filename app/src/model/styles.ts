import type { MapPayload, Proof } from "../api/types";
import { aggregate } from "./map";
import { PROGRAM_ROLES } from "./overview";

/**
 * L3, les styles d'architecture : reconnus aux signes lus dans le code (jamais supposés, jamais par un modèle),
 * chacun avec la ligne qui le montre. Ils ne décident que de la disposition de la Carte ; l'humain confirme.
 */
export interface Style { id: "client-server" | "event" | "microservices" | "contract"; name: string; local?: boolean; reason: string; proof?: Proof; warn?: string; warnProof?: Proof }

export function styles(p: MapPayload): Style[] {
  const nodes = p.model.nodes.filter((n) => n.level !== "component");
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = aggregate(p.model.edges.filter((e) => byId.has(e.from) && byId.has(e.to)));
  const prog = (id: string) => PROGRAM_ROLES.has(byId.get(id)?.role ?? "") && byId.get(id)?.role !== "app";
  const store = (id: string) => byId.get(id)?.role === "store";
  const out: Style[] = [];

  const apps = nodes.filter((n) => n.role === "app");
  const appCalls = links.filter((l) => apps.some((a) => a.id === l.from) && prog(l.to) && (l.kind === "call" || l.kind === "request"));
  if (appCalls.length) {
    const direct = links.find((l) => apps.some((a) => a.id === l.from) && store(l.to));
    const a = byId.get(appCalls[0]!.from)!, s = byId.get(appCalls[0]!.to)!;
    out.push({ id: "client-server", name: "Client-server",
      reason: direct ? `${a.name} calls ${s.name}, but also touches ${byId.get(direct.to)!.name} without going through it.` : `${apps.length > 1 ? `${apps.length} applications call` : `${a.name} only calls`} ${s.name}; ${apps.length > 1 ? "none touches" : "it never touches"} the database.`,
      ...(appCalls[0]!.first ? { proof: appCalls[0]!.first } : {}),
      ...(direct ? { warn: `${byId.get(direct.from)!.name} reads ${byId.get(direct.to)!.name} without the server`, ...(direct.first ? { warnProof: direct.first } : {}) } : {}) });
  }

  const puts = links.filter((l) => l.kind === "message" && byId.get(l.to)?.role === "channel");
  const consumed = puts.find((l) => nodes.some((n) => n.id !== l.from && (n.facets.entrypoints ?? []).some((e) => (e.kind === "message" || e.kind === "event") && l.entities.includes(e.key))));
  if (consumed) {
    const consumer = nodes.find((n) => n.id !== consumed.from && (n.facets.entrypoints ?? []).some((e) => (e.kind === "message" || e.kind === "event") && consumed.entities.includes(e.key)))!;
    const deaf = puts.flatMap((l) => l.entities).filter((t) => !nodes.some((n) => (n.facets.entrypoints ?? []).some((e) => e.key === t)));
    out.push({ id: "event", name: "Event-driven",
      reason: `${byId.get(consumed.from)!.name} enqueues ${consumed.entities.slice(0, 2).map((t) => `“${t}”`).join(", ")}; ${consumer.name}${consumer.id !== consumed.from ? ", deployed apart," : ""} consumes it.`,
      ...(consumed.first ? { proof: consumed.first } : {}), ...(deaf.length ? { warn: `${deaf.join(", ")}: nobody listens` } : {}) });
  }

  const between = links.filter((l) => prog(l.from) && prog(l.to) && l.from !== l.to && (l.kind === "call" || l.kind === "request"));
  if (between.length >= 2) out.push({ id: "microservices", name: "Microservices", reason: `${between.length} synchronous calls between programs, from ${byId.get(between[0]!.from)!.name} to ${byId.get(between[0]!.to)!.name}.`, ...(between[0]!.first ? { proof: between[0]!.first } : {}) });

  const contract = p.model.nodes.find((n) => n.facets.component?.grouping === "contract");
  if (contract) out.push({ id: "contract", name: "Local trait", local: true, reason: `${contract.name}: an interface and its implementations, shown inside its block, not on the map.`, ...(contract.proof[0] ? { proof: contract.proof[0] } : {}) });
  return out;
}

/** La phrase : “Client-serveur, avec une partie événementielle.” */
export function styleSentence(list: Style[]): string {
  const main = list.filter((s) => !s.local);
  if (!main.length) return "No style recognized: the map keeps the default layout.";
  const [first, ...rest] = main;
  return `${first!.name}${rest.length ? `, with ${rest.map((s) => s.id === "event" ? "an event-driven part" : s.name.toLowerCase()).join(" and ")}` : ""}.`;
}
