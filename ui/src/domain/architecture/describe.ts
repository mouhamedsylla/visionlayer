import type { ArchNode, NodeRole, TechLabel } from "../../api/types";
import { count } from "../text/plural";

const ROLE_LABEL: Record<NodeRole, string> = {
  actor: "acteur", external: "externe",
  app: "app", service: "service", function: "fonction", worker: "worker", job: "tâche",
  store: "base", channel: "file", binary: "programme", managed: "géré",
  module: "module", layer: "couche", adapter: "adaptateur",
};

export function roleLabel(role: NodeRole): string {
  return ROLE_LABEL[role];
}

/**
 * La technologie qui dit ce qu'est le bloc : celle du pack qui a lu ses
 * points d'entrée (Express pour des routes), sinon le framework d'une app,
 * sinon sa seule technologie. Aucune quand le code ne permet pas de choisir.
 */
export function primaryTech(node: ArchNode, tech: Record<string, TechLabel>): string | undefined {
  const id = primaryTechId(node, tech);
  return id ? (tech[id]?.name ?? id) : undefined;
}

/** L'identifiant de cette technologie (`express`), pour son logo. */
export function primaryTechId(node: ArchNode, tech: Record<string, TechLabel>): string | undefined {
  const own = node.tech ?? [];
  const entryPacks = (node.facets.entrypoints ?? []).map((e) => e.proof.pack).filter((p): p is string => !!p);
  return entryPacks.find((p) => own.includes(p)) ??
    (node.role === "app" ? own.find((t) => tech[t]?.category === "framework") : undefined) ??
    (own.length === 1 ? own[0] : undefined);
}

/** Les autres technologies du bloc, dans l'ordre du catalogue : ce qu'il emploie en plus de la principale. */
export function otherTechIds(node: ArchNode, tech: Record<string, TechLabel>): string[] {
  const main = primaryTechId(node, tech);
  return (node.tech ?? []).filter((t) => t !== main);
}

/** `service · Express`, `base · PostgreSQL`, `externe`. */
export function kindLabel(node: ArchNode, tech: Record<string, TechLabel>): string {
  const t = primaryTech(node, tech);
  return t ? `${roleLabel(node.role)} · ${t}` : roleLabel(node.role);
}

/** D'où vient le bloc : le fichier de déploiement qui le déclare, ou le code où il apparaît. */
export function originLabel(node: ArchNode): string | undefined {
  const p = node.proof[0];
  if (!p) return undefined;
  return p.source === "manifest" ? `déclaré dans ${p.path}` : `vu dans ${p.path}`;
}

const ENTRY_WORDS: Partial<Record<string, [string, string]>> = {
  http: ["route", "routes"],
  schedule: ["tâche planifiée", "tâches planifiées"],
  message: ["file écoutée", "files écoutées"],
  event: ["événement reçu", "événements reçus"],
  rpc: ["fonction appelable", "fonctions appelables"],
};

const ENTITY_WORDS: Record<string, [string, string]> = {
  relational: ["table", "tables"], document: ["collection", "collections"], "key-value": ["clé", "clés"],
  blob: ["dossier", "dossiers"], search: ["index", "index"], graph: ["type de nœud", "types de nœud"], unknown: ["entité", "entités"],
};

/** Ce que contient le bloc, compté : `15 routes`, `3 tâches planifiées`, `14 tables`, `1 file`. */
export function contentBadges(node: ArchNode): string[] {
  const badges: string[] = [];
  const entries = node.facets.entrypoints ?? [];
  for (const [kind, words] of Object.entries(ENTRY_WORDS)) {
    const n = entries.filter((e) => e.kind === kind).length;
    if (n && words) badges.push(count(n, words[0], words[1]));
  }
  const data = node.facets.data;
  if (data?.entities.length) {
    const [one, many] = ENTITY_WORDS[data.shape] ?? ENTITY_WORDS.unknown!;
    badges.push(count(data.entities.length, one, many));
  }
  const topics = node.facets.channel?.topics.length;
  if (topics) badges.push(count(topics, "file", "files"));
  if (node.instances) badges.push(`${node.instances.min}${node.instances.max ? ` à ${node.instances.max}` : ""} exemplaires`);
  return badges;
}
