import type { Entrypoint } from "../../api/types";
import { entryNature } from "../block/entries";
import { count } from "../text/plural";
import type { FnRef } from "./functions";

/**
 * La phrase sous le nom : ce qu'elle est et qui la lance.
 * `Fonction exportée, point d'entrée POST /orders.` ou
 * `Fonction exportée, pas un point d'entrée : appelée par 8 lignes du dépôt.`
 */
export function fnLead({ fn }: FnRef, entry: Entrypoint | undefined, c: { steps: number; callers: number }): string {
  // « exportée » seulement quand c'est lu : l'inverse n'est jamais affirmé
  const what = fn.exported ? "Fonction exportée" : "Fonction";
  const role = entry
    ? `, ${entryNature(entry) === "route" || entryNature(entry) === "webhook" ? `${entryNature(entry)} ${entry.key}` : `point d'entrée ${entry.key}`}`
    : c.callers ? `, pas un point d'entrée : appelée par ${count(c.callers, "ligne")} du dépôt` : ", sans appel lu dans le dépôt";
  const steps = c.steps ? ` Son déroulé se lit comme celui d'un point d'entrée, en ${count(c.steps, "étape")}.` : "";
  return `${what}${role}.${steps}`;
}
