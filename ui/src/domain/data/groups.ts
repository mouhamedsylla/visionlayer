import type { Entity } from "../../api/types";

export interface EntityGroup {
  /** La section du schéma : `Réservations et paiements`. Absente quand le code n'en écrit pas. */
  title?: string;
  entities: Entity[];
}

/**
 * Les entités rangées par section du schéma, dans l'ordre où le code les
 * déclare. Le code donne ces sections par ses commentaires de séparation ;
 * sans eux, un seul groupe sans titre.
 */
export function entityGroups(entities: Entity[]): EntityGroup[] {
  const groups = new Map<string, EntityGroup>();
  for (const e of entities) {
    const key = e.group ?? "";
    const g = groups.get(key) ?? groups.set(key, { ...(e.group ? { title: e.group } : {}), entities: [] }).get(key)!;
    g.entities.push(e);
  }
  return [...groups.values()];
}
