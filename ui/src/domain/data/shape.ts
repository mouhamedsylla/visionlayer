import type { Entity } from "../../api/types";

/** Des colonnes écrites par les mêmes fonctions : `id · created_at`, `écrit par la base`. */
export interface ColumnGroup {
  names: string[];
  writers: string[];
  files: string[];
  /** Aucune écriture lue, mais une valeur par défaut posée par la base. */
  byDefault: boolean;
}

/** Les colonnes d'une entité, regroupées par qui les écrit, dans l'ordre du schéma. */
export function columnGroups(entity: Entity): ColumnGroup[] {
  const groups = new Map<string, ColumnGroup>();
  for (const f of entity.fields ?? []) {
    const writers = [...new Set((f.writes ?? []).map((w) => w.fn ?? w.proof.path.split("/").pop()!))];
    const byDefault = !writers.length && f.default !== undefined;
    const key = `${writers.join(",")}|${byDefault}`;
    const g = groups.get(key) ?? groups.set(key, { names: [], writers, files: [], byDefault }).get(key)!;
    g.names.push(f.name);
    g.files = [...new Set([...g.files, ...(f.writes ?? []).map((w) => w.proof.path)])];
  }
  return [...groups.values()];
}

/** Qui écrit un groupe de colonnes, en mots. */
export function writtenBy(g: ColumnGroup): string {
  if (g.writers.length) return `écrit par ${g.writers.join(" · ")}`;
  return g.byDefault ? "valeur par défaut de la base" : "aucune écriture lue";
}
