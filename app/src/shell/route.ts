import { useEffect, useState } from "react";

export type Screen = "vue" | "carte" | "bloc" | "deroule" | "mecanismes" | "acces" | "donnees" | "taches" | "regles" | "agents" | "packs" | "couverture" | "replays" | "reglages";

/** Les écrans des planches, dans l'ordre de la barre latérale. `built` : codé ; les autres restent visibles, sans lien. */
export const SCREENS: { id: Screen; label: string; group: string; built?: boolean }[] = [
  { id: "vue", label: "Vue d'ensemble", group: "Système", built: true },
  { id: "carte", label: "Carte", group: "Système", built: true },
  { id: "bloc", label: "Intérieur d'un bloc", group: "", built: true },
  { id: "deroule", label: "Déroulé", group: "", built: true },
  { id: "mecanismes", label: "Mécanismes", group: "Système", built: true },
  { id: "acces", label: "Accès", group: "Système", built: true },
  { id: "donnees", label: "Données", group: "Système", built: true },
  { id: "taches", label: "Tâches planifiées", group: "Système", built: true },
  { id: "regles", label: "Règles et décisions", group: "Connaissance" },
  { id: "agents", label: "Sessions d'agents", group: "Connaissance", built: true },
  { id: "packs", label: "Packs", group: "Lecture", built: true },
  { id: "couverture", label: "Couverture", group: "Lecture" },
  { id: "replays", label: "Replays", group: "Pratique", built: true },
  { id: "reglages", label: "Réglages", group: "", built: true },
];

type Place = { screen: Screen; item?: string };
const parse = (hash: string): Place => {
  const [, s, ...rest] = hash.split("/");
  const screen = SCREENS.some((x) => x.id === s && x.built) ? (s as Screen) : "vue";
  return { screen, item: rest.length ? decodeURIComponent(rest.join("/")) : undefined };
};
/** Le chemin parcouru dans l'app (planche L6) : le retour ramène d'où l'on vient, pas à un écran fixe. */
const trail: string[] = [window.location.hash];
const DEEP = new Set<Screen>(["bloc", "deroule"]);

/** Le libellé d'un endroit, pour le bouton de retour : l'écran, ou le bloc. */
export const placeLabel = (p: Place) => (p.screen === "bloc" && p.item ? p.item : SCREENS.find((x) => x.id === p.screen)!.label);

/** L'écran et l'élément choisi vivent dans l'adresse : `#/carte/api`. */
export function useRoute(): { screen: Screen; item?: string; go: (screen: Screen, item?: string) => void; from?: Place; back?: () => void; origin: Screen } {
  const [state, setState] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      const h = window.location.hash;
      // Revenu à l'endroit d'avant : on remonte le chemin ; sinon on l'allonge.
      if (trail.length > 1 && trail[trail.length - 2] === h) trail.pop();
      else if (trail[trail.length - 1] !== h) trail.push(h);
      setState(parse(h));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const prev = trail.length > 1 ? parse(trail[trail.length - 2]!) : undefined;
  // Le repère de la barre latérale : le dernier écran qui y figure, quand on est descendu dans un bloc ou un déroulé.
  const origin = DEEP.has(state.screen) ? ([...trail].reverse().map(parse).find((p) => !DEEP.has(p.screen))?.screen ?? "carte") : state.screen;
  return {
    ...state, origin,
    ...(prev ? { from: prev, back: () => window.history.back() } : {}),
    go: (screen, item) => { window.location.hash = `/${screen}${item ? `/${encodeURIComponent(item)}` : ""}`; },
  };
}
