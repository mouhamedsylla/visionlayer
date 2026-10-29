import type { ArchModelV2, ArchNode, Entity, Finding, Proof } from "../../api/types";

const key = (p: Pick<Proof, "path" | "line">) => `${p.path}:${p.line}`;

/** Les lignes qui disent une entité : sa déclaration, ses champs, ses contraintes, et chaque lecture ou écriture. */
function entityLines(entity: Entity, store: ArchNode, model: ArchModelV2): Set<string> {
  const lines = new Set<string>();
  const add = (p?: Proof) => p && lines.add(key(p));
  add(entity.proof);
  entity.fields?.forEach((f) => add(f.proof));
  entity.constraints?.forEach((c) => add(c.proof));
  for (const e of model.edges) if (e.to === store.id && e.target?.entity === entity.name) e.occurrences.forEach(add);
  return lines;
}

/** Les constats qui citent une ligne de cette entité : `bookings.status accepte « on_hold »`, une course sur bookings. */
export function entityFindings(entity: Entity, store: ArchNode, model: ArchModelV2): Finding[] {
  const lines = entityLines(entity, store, model);
  return model.findings.filter((f) => f.proof.some((p) => lines.has(key(p))));
}

/** Les constats sur le stockage lui-même, qu'aucune entité ne porte : une connexion sans délai maximum. */
export function storeFindings(store: ArchNode, model: ArchModelV2): Finding[] {
  const entities = store.facets.data?.entities ?? [];
  const onEntity = new Set(entities.flatMap((e) => entityFindings(e, store, model)));
  return model.findings.filter((f) => f.nodes?.includes(store.id) && !onEntity.has(f));
}
