import type { MapPayload } from "../api/types";
import { mapGrid } from "./map";
import { isUnread, PROGRAM_ROLES, RESOURCE_ROLES } from "./overview";
import { plural } from "./words";

/**
 * La phrase sous le titre de la Carte, comme sur la planche : qui appelle qui, où ça écrit, ce qui passe par
 * une file ; puis les comptes. Calculée depuis les liens, jamais rédigée par un modèle.
 */
export function mapSentence(p: MapPayload): string {
  const g = mapGrid(p);
  const name = (id: string) => p.model.nodes.find((n) => n.id === id)?.name ?? id;
  const parts: string[] = [];
  for (const m of g.middle) for (const r of m.rows) if (r.left && r.leftArrows.some((a) => !a.back)) parts.push(`${r.left.name} calls ${m.node.name}`);
  const writes = new Map<string, string[]>();
  for (const l of g.links) if (l.kind === "write") (writes.get(l.to) ?? writes.set(l.to, []).get(l.to)!).push(name(l.from));
  for (const [to, from] of writes) parts.push(`${[...new Set(from)].join(" and ")} write${from.length > 1 ? "" : "s"} to ${name(to)}`);
  for (const m of g.middle) if (m.down?.link.kind === "message") parts.push(`${name(m.down.link.from)} hands messages to ${name(m.down.link.to)}`);
  const nodes = p.model.nodes.filter((n) => n.level !== "component" && n.role !== "actor");
  const programs = nodes.filter((n) => n.level === "deployable" && PROGRAM_ROLES.has(n.role)).length;
  const resources = nodes.filter((n) => RESOURCE_ROLES.has(n.role)).length;
  const externals = nodes.filter((n) => n.role === "external").length;
  const unread = nodes.filter(isUnread).length;
  const head = parts.length ? `${parts.slice(0, 4).join(", ").replace(/^./, (c) => c.toUpperCase())}. ` : "";
  return `${head}${plural(programs, "program", "programs")}, ${plural(resources, "resource", "resources")}, ${plural(externals, "external service", "external services")}${unread ? `, ${unread} of them not read${unread > 1 ? "s" : ""}` : ""}.`;
}

export interface MapHeroData {
  tag: string; title: string; text: string; side: string;
  rows: { value: string; label: string; note: string; node?: string; tone?: "plus" | "minus" | "signal" }[];
}

/**
 * La carte noire de la Carte : ce qu'a changé la dernière analyse (un pack chargé, du code modifié), sinon ce
 * qui tourne sans être lu, avec le chemin vers l'atelier (guide de la Carte, §4).
 */
export function mapHero(p: MapPayload): MapHeroData | undefined {
  const changes = p.changes?.items ?? [];
  if (changes.length) {
    const added = changes.filter((c) => c.sign === "added"), removed = changes.filter((c) => c.sign === "removed");
    return {
      tag: "Since the last analysis", title: `The map changed: ${plural(added.length, "item added", "items added")}, ${plural(removed.length, "removed", "removed")}.`,
      text: "Each row comes from comparing both maps, fact by fact.", side: "What changed",
      rows: changes.slice(0, 5).map((c) => ({ value: c.sign === "added" ? "+" : "−", label: c.text, note: c.proof ? `${c.proof.path}:${c.proof.line}` : "", tone: c.sign === "added" ? "plus" : "minus" })),
    };
  }
  const unread = p.model.nodes.filter((n) => n.level !== "component" && isUnread(n));
  if (!unread.length) return undefined;
  return {
    tag: "Not read", title: `${plural(unread.length, "block runs", "blocks run")} with no pack reading ${unread.length > 1 ? "their" : "its"} technology.`,
    text: "The map shows them, with what links them, but says nothing of what their code does. Muse Spark can write each one's pack from its documentation; its tests pass before anything loads.",
    side: "What is not read",
    rows: unread.slice(0, 5).map((n) => ({ value: "?", label: n.name, note: n.subtitle ?? "", node: n.id, tone: "signal" })),
  };
}
