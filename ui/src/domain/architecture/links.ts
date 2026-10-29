import type { ArchModelV2, ArchNode, EdgeKind } from "../../api/types";

/**
 * Un trait de la carte : tous les liens d'un bloc vers un autre, comptés par
 * nature. Un lien du modèle vise une cible précise (une table, une route) :
 * « lit 7 » veut dire sept tables lues, quel que soit le nombre de lignes.
 */
export interface MapLink {
  id: string;
  from: string;
  to: string;
  kinds: Partial<Record<EdgeKind, number>>;
  total: number;
}

const VERB: Record<EdgeKind, string> = {
  call: "appelle", request: "appelle", read: "lit", write: "écrit",
  message: "met en file", trigger: "déclenche", use: "utilise", deploy: "déploie",
};
const KIND_ORDER: EdgeKind[] = ["call", "request", "message", "trigger", "read", "write", "use", "deploy"];

/** Les blocs de la carte : ce qui tourne et ce qu'on utilise. Un composant reste à l'intérieur de son bloc. */
export function mapNodes(model: ArchModelV2): ArchNode[] {
  return model.nodes.filter((n) => n.level === "system" || n.level === "deployable");
}

/** Remonte un composant jusqu'au bloc affiché qui le contient. */
function ownerOf(model: ArchModelV2, shown: Set<string>): (id: string) => string | undefined {
  const parent = new Map(model.nodes.map((n) => [n.id, n.parent]));
  return (id) => {
    let cur: string | undefined = id;
    for (let depth = 0; cur && !shown.has(cur) && depth < 10; depth++) cur = parent.get(cur);
    return cur && shown.has(cur) ? cur : undefined;
  };
}

export function mapLinks(model: ArchModelV2): MapLink[] {
  const shown = new Set(mapNodes(model).map((n) => n.id));
  const owner = ownerOf(model, shown);
  const links = new Map<string, MapLink>();
  for (const e of model.edges) {
    const from = owner(e.from);
    const to = owner(e.to);
    if (!from || !to || from === to) continue;
    const id = `${from}->${to}`;
    const link = links.get(id) ?? { id, from, to, kinds: {}, total: 0 };
    link.kinds[e.kind] = (link.kinds[e.kind] ?? 0) + 1;
    link.total += 1;
    links.set(id, link);
  }
  return [...links.values()];
}

/** `lit 11 · écrit 10` : ce que dit un trait, nature par nature. */
export function linkLabel(link: MapLink): string {
  return KIND_ORDER.filter((k) => link.kinds[k]).map((k) => `${VERB[k]} ${link.kinds[k]}`).join(" · ");
}

export function linksOf(nodeId: string, links: MapLink[]): MapLink[] {
  return links.filter((l) => l.from === nodeId || l.to === nodeId);
}
