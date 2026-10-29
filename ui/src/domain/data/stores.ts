import type { ArchModelV2, ArchNode, Entity } from "../../api/types";

/** Les stockages qui portent des entités (tables, collections) : ceux que l'écran Données montre. */
export function dataStores(model: ArchModelV2): ArchNode[] {
  return model.nodes.filter((n) => (n.facets.data?.entities.length ?? 0) > 0);
}

/** Les entités dans l'ordre où le code les déclare : le schéma garde ainsi ses propres regroupements. */
export function storeEntities(store: ArchNode): Entity[] {
  return [...(store.facets.data?.entities ?? [])].sort((a, b) =>
    (a.proof?.path ?? "").localeCompare(b.proof?.path ?? "") || (a.proof?.line ?? 0) - (b.proof?.line ?? 0) || a.name.localeCompare(b.name));
}

/** Le mot d'une entité selon la forme du stockage : une table, une collection. */
export function entityWord(store: ArchNode): [string, string] {
  const shape = store.facets.data?.shape;
  if (shape === "relational") return ["table", "tables"];
  if (shape === "document") return ["collection", "collections"];
  return ["entité", "entités"];
}
