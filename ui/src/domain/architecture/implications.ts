import type { ArchModelV2, ArchNode, TechLabel } from "../../api/types";
import { cronLabel } from "../text/cron";
import { count, joinWords } from "../text/plural";
import { longestChain } from "./chain";
import { contentBadges, primaryTechId } from "./describe";
import { mapNodes, type MapLink } from "./links";

/** Une conséquence de l'architecture, dite en une phrase et justifiée par la carte. */
export interface Implication {
  title: string;
  text: string;
  /** Les logos des blocs concernés. */
  techs: string[];
  link?: { label: string; href: string };
}

const STEP: Record<string, string> = { call: "appelle", request: "appelle", message: "met en file", trigger: "déclenche" };

/** Ce que la carte implique, pour n'importe quel système : trajets, messages, données, dépendances, exemplaires. */
export function implications(model: ArchModelV2, links: MapLink[], tech: Record<string, TechLabel>, href: (screen: string, ...p: string[]) => string): Implication[] {
  const nodes = mapNodes(model);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const logo = (ids: string[]) => ids.map((id) => byId.get(id)).filter((n): n is ArchNode => !!n).map((n) => primaryTechId(n, tech) ?? n.tech?.[0]).filter((t): t is string => !!t);
  const out: Implication[] = [];

  const chain = longestChain(links, nodes.filter((n) => n.role === "app" || n.role === "actor").map((n) => n.id));
  if (chain && chain.steps.length > 1) {
    const ids = [chain.from, ...chain.steps.map((s) => s.to)];
    out.push({
      title: `Le plus long trajet traverse ${ids.length} blocs.`,
      text: `${ids.map(name).join(" → ")} : ${chain.steps.map((s) => `${name(ids[chain.steps.indexOf(s)]!)} ${STEP[s.kind]} ${name(s.to)}`).join(", puis ")}.`,
      techs: logo(ids),
    });
  }

  const queues = nodes.filter((n) => n.facets.channel?.topics.length);
  if (queues.length) {
    const topics = queues.flatMap((q) => q.facets.channel!.topics.map((t) => t.name));
    const senders = links.filter((l) => queues.some((q) => q.id === l.to) && l.kinds.message).map((l) => name(l.from));
    const readers = links.filter((l) => queues.some((q) => q.id === l.from) && l.kinds.trigger).map((l) => name(l.to));
    out.push({
      title: `${count(topics.length, "file", "files")} entre les blocs : ${joinWords(topics)}.`,
      text: `${joinWords(senders) || "aucun émetteur lu"} y dépose, ${joinWords(readers) || "aucun lecteur lu"} la traite plus tard : le premier n'attend pas le second.`,
      techs: logo(queues.map((q) => q.id)),
    });
  } else {
    out.push({ title: "Aucun message asynchrone.", text: "Tout passe par des appels directs : chaque appelant attend la réponse.", techs: [] });
  }

  const stores = nodes.filter((n) => n.facets.data?.entities.length);
  for (const s of stores) {
    const users = [...new Set(links.filter((l) => l.to === s.id && (l.kinds.read || l.kinds.write)).map((l) => name(l.from)))];
    out.push({
      title: `${s.name} garde ${contentBadges(s)[0] ?? "des données"}.`,
      text: users.length > 1 ? `${joinWords(users)} y lisent et écrivent tous : ce que l'un écrit, l'autre le lit.` : `Seul ${users[0] ?? "aucun bloc"} y accède.`,
      techs: logo([s.id]),
      link: { label: "voir qui lit et écrit chaque table", href: href("donnees", s.id) },
    });
  }

  const external = nodes.filter((n) => n.role === "external" && links.some((l) => l.to === n.id));
  if (external.length) {
    const callers = (id: string) => joinWords([...new Set(links.filter((l) => l.to === id).map((l) => name(l.from)))]);
    out.push({
      title: `${count(external.length, "service hors du dépôt", "services hors du dépôt")}.`,
      text: external.map((n) => `${n.name} (appelé par ${callers(n.id)})`).join(", ") + " : s'ils ne répondent pas, ces appels attendent.",
      techs: logo(external.map((n) => n.id)),
    });
  }

  for (const n of nodes.filter((x) => (x.instances?.min ?? 1) > 1)) {
    const jobs = (n.facets.entrypoints ?? []).filter((e) => e.kind === "schedule");
    if (!jobs.length) continue;
    out.push({
      title: `${n.name} tourne en ${n.instances!.min} exemplaires.`,
      text: `Ses ${count(jobs.length, "tâche planifiée", "tâches planifiées")} (${joinWords(jobs.map((j) => `${j.handler?.name ?? j.key}, ${cronLabel(j.key)}`))}) démarrent sur chacun.`,
      techs: logo([n.id]),
      link: { label: "voir le bloc", href: href("architecture", n.id) },
    });
  }
  return out;
}
