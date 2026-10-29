import type { ArchModelV2, ArchNode, Occurrence, Proof, TechEvidence, Technology } from "../../api/types";
import { evidenceWhere } from "./groups";

/** Une preuve de l'inventaire : ce qui est écrit, et la ligne quand il y en a une. */
export interface Declared {
  label: string;
  where: string;
  proof?: Pick<Proof, "path" | "line">;
}

export interface TechDetail {
  declared: Declared[];
  /** Les blocs de la carte qui portent la technologie, ou qui appellent le service externe. */
  blocks: ArchNode[];
  /** Pour un service externe : chaque ligne qui l'appelle, et le bloc qui la contient. */
  calls: { occurrence: Occurrence; from: string }[];
  /** Variables lues dans les fichiers qui l'importent ou l'appellent, noms seulement. */
  vars: { name: string; required?: boolean; at: Proof[] }[];
  importers: string[];
}

function label(e: TechEvidence): string {
  switch (e.kind) {
    case "package": return `${e.package} ${e.range}${e.installed ? ` · installé ${e.installed}` : ""}${e.dev ? " · développement" : ""}`;
    case "config": return "fichier de configuration";
    case "infra": return `composant « ${e.name} »`;
    case "image": return `image ${e.image}${e.tag ? `:${e.tag}` : ""}`;
    case "system": return `paquet système ${e.package}`;
    case "runtime": return `${e.field} = ${e.value}`;
    case "files": return `fichiers ${e.extension}`;
  }
}

function proofOf(e: TechEvidence): Declared["proof"] {
  if (e.kind === "files" || e.kind === "config" || e.line === undefined) return undefined;
  return { path: e.kind === "package" ? e.manifest : e.path, line: e.line };
}

/** Tout ce que la carte et l'inventaire disent d'une technologie, chaque fait avec sa ligne. */
export function techDetail(t: Technology, model: ArchModelV2): TechDetail {
  const externals = new Set(model.nodes.filter((n) => n.role === "external" && n.tech?.includes(t.id)).map((n) => n.id));
  const name = new Map(model.nodes.map((n) => [n.id, n.name]));
  const edges = model.edges.filter((e) => externals.has(e.to));
  const calls = edges.flatMap((e) => e.occurrences.map((occurrence) => ({ occurrence, from: name.get(e.from) ?? e.from })));
  const blocks = externals.size
    ? model.nodes.filter((n) => edges.some((e) => e.from === n.id))
    : model.nodes.filter((n) => n.tech?.includes(t.id));

  const files = new Set([...t.importers, ...calls.map((c) => c.occurrence.path)]);
  const vars = new Map<string, TechDetail["vars"][number]>();
  for (const n of model.nodes) {
    for (const v of n.facets.config?.env ?? []) {
      const at = v.readAt.filter((p) => files.has(p.path));
      if (!at.length) continue;
      const seen = vars.get(v.name) ?? { name: v.name, required: v.required, at: [] };
      for (const p of at) if (!seen.at.some((q) => q.path === p.path && q.line === p.line)) seen.at.push(p);
      vars.set(v.name, seen);
    }
  }
  return {
    declared: t.evidence.map((e) => ({ label: label(e), where: evidenceWhere(e), proof: proofOf(e) })),
    blocks, calls, vars: [...vars.values()], importers: t.importers,
  };
}
