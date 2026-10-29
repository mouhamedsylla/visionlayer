import type { ArchModelV2, ArchNode, EdgeKind, TechLabel } from "../../api/types";
import { count, joinWords } from "../text/plural";
import { isRunning, ROLE_ORDER } from "./columns";
import { contentBadges, primaryTechId, roleLabel } from "./describe";
import { groupFindings } from "./findings";
import { mapNodes, type MapLink } from "./links";

/** Ce qu'une case montre en plus de sa phrase : des logos, une répartition, une liste comptée, une jauge. */
export type FactVisual =
  | { type: "logos"; items: { tech?: string; caption: string }[] }
  | { type: "bar"; parts: { label: string; value: number; tone: "night" | "blue" | "cyan" | "pale" }[] }
  | { type: "list"; items: { value: number; label: string }[] }
  | { type: "meter"; value: number; total: number; label: string };

/** Une case du bandeau : une question, la réponse, le détail qui la justifie, et sa forme visuelle. */
export interface FactCard {
  question: string;
  answer: string;
  detail: string;
  visual?: FactVisual;
  /** La réponse demande qu'on aille voir. */
  attention?: boolean;
}

/** Le mot seul, accordé : `appel`, `appels`. */
const word = (n: number, one: string, many = `${one}s`) => (n > 1 ? many : one);

const sum = (links: MapLink[], kinds: EdgeKind[]) => links.reduce((n, l) => n + kinds.reduce((m, k) => m + (l.kinds[k] ?? 0), 0), 0);

function running(nodes: ArchNode[], tech: Record<string, TechLabel>): FactCard {
  const run = nodes.filter((n) => isRunning(n.role)).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const byRole = new Map<string, number>();
  for (const n of run) byRole.set(n.role, (byRole.get(n.role) ?? 0) + 1);
  const answer = [...byRole.entries()].map(([role, n]) => `${n} ${roleLabel(role as ArchNode["role"])}${n > 1 ? "s" : ""}`).join(" · ");
  const names = run.map((n) => (n.instances ? `${n.name} ×${n.instances.min}` : n.name));
  return {
    question: "Ce qui tourne", answer: answer || "rien de lancé",
    detail: run.map((n) => [n.name, contentBadges(n).filter((b) => !b.includes("exemplaires")).join(", ")] as const)
      .filter(([, b]) => b).map(([nm, b]) => `${nm} : ${b}`).join(" · ") || (run.length ? "" : "aucun déployable reconnu"),
    visual: { type: "logos", items: run.map((n, i) => ({ tech: primaryTechId(n, tech), caption: names[i]! })) },
  };
}

function talking(nodes: ArchNode[], links: MapLink[]): FactCard {
  const external = nodes.filter((n) => n.role === "external" || n.role === "managed");
  const calledOut = external.filter((n) => links.some((l) => l.to === n.id && sum([l], ["call", "request"]) > 0));
  const [calls, messages, reads, writes] = [sum(links, ["call", "request"]), sum(links, ["message"]), sum(links, ["read"]), sum(links, ["write"])];
  return {
    question: "Comment ça communique",
    answer: [count(calls, "appel"), messages ? count(messages, "mise en file", "mises en file") : "aucun message"].join(" · "),
    detail: calledOut.length ? `${count(calledOut.length, "service externe", "services externes")} : ${joinWords(calledOut.map((n) => n.name))}` : "aucun service externe appelé",
    visual: { type: "bar", parts: [
      { label: word(calls, "appel"), value: calls, tone: "night" }, { label: word(messages, "mise en file", "mises en file"), value: messages, tone: "blue" },
      { label: word(reads, "lecture"), value: reads, tone: "cyan" }, { label: word(writes, "écriture"), value: writes, tone: "pale" },
    ].filter((p) => p.value > 0) as Extract<FactVisual, { type: "bar" }>["parts"] },
  };
}

function data(nodes: ArchNode[], links: MapLink[], tech: Record<string, TechLabel>): FactCard {
  const stores = nodes.filter((n) => n.role === "store" || n.role === "channel" || n.facets.data);
  const users = [...new Set(links.filter((l) => stores.some((s) => s.id === l.to) && sum([l], ["read", "write"]) > 0).map((l) => l.from))];
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const bases = stores.filter((n) => n.role !== "channel").length;
  return {
    question: "Où sont les données",
    answer: stores.length ? [bases && count(bases, "base"), stores.length - bases && count(stores.length - bases, "file", "files")].filter(Boolean).join(" · ") : "aucune base lue",
    detail: users.length ? `lues ou écrites par ${joinWords(users.map((id) => names.get(id) ?? id))}` : "aucun accès lu",
    visual: { type: "logos", items: stores.map((n) => ({ tech: primaryTechId(n, tech) ?? n.tech?.[0], caption: [n.name, contentBadges(n)[0]].filter(Boolean).join(" · ") })) },
  };
}

function toCheck(model: ArchModelV2): FactCard {
  const groups = groupFindings(model.findings);
  return {
    question: "Ce qu'il faut vérifier",
    answer: model.findings.length ? count(model.findings.length, "point") : "aucun point relevé",
    detail: groups.length > 3 ? `et ${count(groups.length - 3, "autre nature", "autres natures")}` : groups.length ? "" : "les packs n'ont rien relevé",
    visual: { type: "list", items: groups.slice(0, 3).map((g) => ({ value: g.findings.length, label: g.label.replace(/^\d+ /, "") })) },
    attention: model.findings.length > 0,
  };
}

function unknown(model: ArchModelV2): FactCard {
  const gaps = model.coverage.flatMap((c) => c.gaps);
  const files = model.coverage.find((c) => c.unit === "files");
  const meter: FactVisual | undefined = files ? { type: "meter", value: files.read, total: files.total, label: "fichiers de code lus" } : undefined;
  if (!gaps.length) {
    return { question: "Ce qu'on ne sait pas", answer: "rien n'est signalé non lu", detail: "une forme qu'aucun pack ne connaît peut encore manquer", visual: meter };
  }
  const subjects = gaps.map((g) => g.subject);
  return {
    question: "Ce qu'on ne sait pas",
    answer: count(gaps.reduce((n, g) => n + g.count, 0), "élément non lu", "éléments non lus"),
    detail: joinWords(subjects.slice(0, 3)) + (subjects.length > 3 ? `, et ${subjects.length - 3} autres` : ""),
    visual: meter,
    attention: true,
  };
}

/** Les cinq cases du bandeau de l'écran Architecture, toutes comptées sur la carte. */
export function architectureFacts(model: ArchModelV2, links: MapLink[], tech: Record<string, TechLabel>): FactCard[] {
  const nodes = mapNodes(model);
  return [running(nodes, tech), talking(nodes, links), data(nodes, links, tech), toCheck(model), unknown(model)];
}
