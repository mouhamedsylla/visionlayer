import type { Finding, FindingCode, MapPayload } from "../api/types";
import { FINDING_SCREEN } from "./words";
import type { Screen } from "../shell/route";

/**
 * « Un objet, une destination » (planche L6) : où mène un objet, quel que soit l'écran qui le dessine. C'est le seul
 * endroit qui le dit.
 */
export interface Place { screen: Screen; item?: string; label: string }
export type Target = { entity: string; node?: string } | { topic: string; node?: string } | { service: string };

const LABEL: Partial<Record<Screen, string>> = { acces: "Accès", donnees: "Données", taches: "Tâches planifiées", carte: "la carte", mecanismes: "Mécanismes", bloc: "l'intérieur du bloc", regles: "Règles et décisions" };

export function placeOf(p: MapPayload, t: Target): Place | undefined {
  if ("entity" in t) {
    const store = p.model.nodes.find((n) => (!t.node || n.id === t.node) && n.facets.data?.entities.some((e) => e.name === t.entity));
    return store ? { screen: "donnees", item: `${store.id}/${t.entity}`, label: `Données, ${t.entity}` } : undefined;
  }
  if ("topic" in t) {
    const q = p.model.nodes.find((n) => (!t.node || n.id === t.node) && n.facets.channel?.topics.some((x) => x.name === t.topic));
    return q ? { screen: "mecanismes", item: `files:${q.id}/${t.topic}`, label: `Mécanismes, ${t.topic}` } : undefined;
  }
  const s = p.model.nodes.find((n) => n.id === t.service || n.name === t.service);
  return s ? { screen: "carte", item: s.id, label: `La carte, ${s.name}` } : undefined;
}

const FIRST_SCREEN: Partial<Record<FindingCode, Screen>> = { missing_timeout: "mecanismes", uncalled_entry: "bloc", dead_code: "bloc", doc_contradiction: "regles" };

/** L'écran de la question d'un constat, l'élément choisi (L6). */
export function findingPlace(p: MapPayload, f: Finding): Place {
  const screen: Screen = FIRST_SCREEN[f.code] ?? FINDING_SCREEN[f.code] ?? "carte";
  const node = f.nodes?.[0];
  if (screen === "donnees") {
    const hit = p.model.nodes.flatMap((n) => (n.facets.data?.entities ?? []).map((e) => ({ n, e })))
      .find(({ e }) => new RegExp(`(^|[^\\w])${e.name}([^\\w]|$)`).test(f.message));
    return hit ? { screen: "table", item: `${hit.n.id}/${hit.e.name}`, label: `Voir ce que dit ${hit.e.name}` } : { screen, label: "Voir dans Données" };
  }
  if (screen === "acces") return { screen, item: "entrees", label: "Voir dans Accès" };
  if (screen === "mecanismes") return { screen, item: "pannes:", label: "Voir dans Mécanismes" };
  if (screen === "bloc" && node && p.model.nodes.some((n) => n.id === node)) return { screen, item: node, label: "Voir dans le bloc" };
  if (screen === "bloc") return { screen: "carte", label: "Voir dans la carte" };
  return { screen, ...(screen === "carte" && node ? { item: node } : {}), label: `Voir dans ${LABEL[screen] ?? "la carte"}` };
}
