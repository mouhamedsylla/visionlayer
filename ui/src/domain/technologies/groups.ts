import type { ArchModelV2, StackModel, TechCategory, TechEvidence, Technology } from "../../api/types";
import { count } from "../text/plural";

/** Une technologie en tuile : son nom, ses versions, l'endroit qui la déclare. */
export interface TechTile {
  id: string;
  name: string;
  /** Versions déclarées ou installées, distinctes : `8.23.1 · 16`. */
  version?: string;
  /** La première preuve : `package.json:29`, `fly.toml`, `60 fichiers .ts .tsx`. */
  where: string;
  external: boolean;
}

export interface TechGroup {
  title: string;
  tiles: TechTile[];
}

/** Les familles de l'écran, dans l'ordre de lecture d'un système : ce qui l'écrit, ce qui le sert, ce qui le livre. */
const GROUPS: [string, TechCategory[]][] = [
  ["Langages et exécution", ["language", "runtime"]],
  ["Interface", ["framework", "styling"]],
  ["Serveur et API", ["backend", "data"]],
  ["Services externes", []],
  ["Bases de données et files", ["database"]],
  ["IA et médias", ["ai", "media"]],
  ["Build et paquets", ["build"]],
  ["Tests et qualité", ["test", "quality"]],
  ["Mesure", ["analytics"]],
  ["Cloud et livraison", ["cloud", "ci"]],
  ["Autres bibliothèques", ["library"]],
];

/** Les technologies que la carte pose sur un bloc externe : un service appelé hors du système. */
export function externalTechIds(model: ArchModelV2): Set<string> {
  return new Set(model.nodes.filter((n) => n.role === "external").flatMap((n) => n.tech ?? []));
}

/** Où une preuve se lit, en une étiquette courte. */
export function evidenceWhere(e: TechEvidence): string {
  if (e.kind === "files") return count(e.count, "fichier") + ` ${e.extension}`;
  const path = e.kind === "package" ? e.manifest : e.path;
  return "line" in e && e.line !== undefined ? `${path}:${e.line}` : path;
}

/** La preuve qui la montre le mieux : hors outillage de développement d'abord, puis celle qui donne une ligne. */
export const mainEvidence = (t: Technology) => {
  const rank = (e: TechEvidence) => (e.kind === "package" && e.dev ? 2 : 0) + ("line" in e && e.line !== undefined ? 0 : 1);
  return [...t.evidence].sort((a, b) => rank(a) - rank(b))[0];
};

/** Le service externe que la carte appelle le plus : celui qu'on ouvre d'abord. */
export function busiestExternal(model: ArchModelV2): string | undefined {
  const calls = new Map<string, number>();
  for (const n of model.nodes.filter((n) => n.role === "external")) {
    const c = model.edges.filter((e) => e.to === n.id).reduce((s, e) => s + e.count, 0);
    for (const id of n.tech ?? []) calls.set(id, (calls.get(id) ?? 0) + c);
  }
  return [...calls.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function tile(t: Technology, stack: StackModel, external: Set<string>): TechTile {
  const lang = stack.languages.find((l) => l.id === t.id);
  return {
    id: t.id, name: t.name, external: external.has(t.id),
    ...(t.versions.length ? { version: t.versions.join(" · ") } : {}),
    where: lang ? `${count(lang.files, "fichier")} ${lang.extensions.join(" ")}` : mainEvidence(t) ? evidenceWhere(mainEvidence(t)!) : "",
  };
}

/** Les technologies rangées par famille ; un service externe va dans la sienne, une famille vide n'est pas montrée. */
export function techGroups(stack: StackModel, model: ArchModelV2): TechGroup[] {
  const external = externalTechIds(model);
  return GROUPS.map(([title, cats]) => ({
    title,
    tiles: stack.technologies
      .filter((t) => (cats.length ? cats.includes(t.category) && !external.has(t.id) : external.has(t.id)))
      .map((t) => tile(t, stack, external)),
  })).filter((g) => g.tiles.length > 0);
}

const CATEGORY: Record<TechCategory, string> = {
  language: "langage", runtime: "exécution", framework: "interface", styling: "style", data: "données et validation",
  backend: "serveur et API", cloud: "hébergement", database: "base de données ou file", ai: "IA", media: "médias",
  build: "build et paquets", test: "tests", quality: "qualité", analytics: "mesure", ci: "livraison", library: "bibliothèque",
};

export const categoryLabel = (t: Technology, external: boolean) => (external ? "service externe" : CATEGORY[t.category]);
