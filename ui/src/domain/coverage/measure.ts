import type { ArchModelV2, ArchNode, Entity, Entrypoint, FlowStep, KnowledgeClaim, KnowledgeReport } from "../../api/types";

/** Un point d'entrée qu'une feature peut couvrir, et s'il l'est. */
export interface EntryCover { entry: Entrypoint; node: ArchNode; attached: boolean }
/** Un refus du code, et s'il est expliqué : un commentaire de l'auteur, ou une note ancrée sur sa ligne. */
export interface RefusalCover { step: FlowStep; node: ArchNode; entry: Entrypoint; explained: boolean }
/** Une table ou collection, et si ses champs sont lus. */
export interface TableCover { entity: Entity; node: ArchNode; read: boolean }

export interface Measures {
  entries: EntryCover[];
  refusals: RefusalCover[];
  tables: TableCover[];
  claims: KnowledgeClaim[];
}

/** Une note à jour : vérifiée par une règle, ou dont le code ancré n'a pas changé. */
export const upToDate = (c: KnowledgeClaim) => c.state === "verified" || c.state === "current";
/** Une note qui demande qu'on la relise. */
export const outdated = (c: KnowledgeClaim) => c.state === "stale" || c.state === "contradicted" || c.state === "orphan";

const covers = (c: KnowledgeClaim, path: string, line: number) =>
  c.anchors.some((a) => a.at && a.at.path === path && a.at.line <= line && line <= a.at.endLine);

export function measure(model: ArchModelV2, report: KnowledgeReport): Measures {
  const missing = new Set(report.entriesWithoutFeature);
  const claims = report.concepts.flatMap((c) => c.claims);
  const entries: EntryCover[] = [];
  const refusals: RefusalCover[] = [];
  const seen = new Set<string>();
  for (const node of model.nodes) {
    for (const entry of node.facets.entrypoints ?? []) {
      if (entry.kind === "main" || entry.kind === "cli") continue;
      entries.push({ entry, node, attached: !missing.has(entry.key) });
      for (const step of entry.flow ?? []) {
        const key = `${step.proof.path}:${step.proof.line}`;
        if (step.kind !== "refuse" || seen.has(key)) continue;
        seen.add(key);
        refusals.push({ step, node, entry, explained: !!step.why || claims.some((c) => covers(c, step.proof.path, step.proof.line)) });
      }
    }
  }
  const tables = model.nodes.flatMap((node) => (node.facets.data?.entities ?? []).map((entity) => ({ entity, node, read: (entity.fields?.length ?? 0) > 0 })));
  return { entries, refusals, tables, claims };
}

/** Une ligne par partie qui tourne : ses points d'entrée rattachés, ses notes à jour, ses refus expliqués. */
export interface PartCover { node: ArchNode; entries: [number, number]; notes: [number, number]; refusals: [number, number] }

const ratio = <T>(list: T[], ok: (x: T) => boolean): [number, number] => [list.filter(ok).length, list.length];

export function partCovers(model: ArchModelV2, m: Measures): PartCover[] {
  return model.nodes.filter((n) => n.level === "deployable" && (n.files?.length ?? 0) > 0).map((node) => {
    const files = new Set(node.files);
    return {
      node,
      entries: ratio(m.entries.filter((e) => e.node.id === node.id), (e) => e.attached),
      notes: ratio(m.claims.filter((c) => c.anchors.some((a) => a.at && files.has(a.at.path))), upToDate),
      refusals: ratio(m.refusals.filter((r) => r.node.id === node.id), (r) => r.explained),
    };
  });
}
