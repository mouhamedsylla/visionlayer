import { useEffect, useState } from "react";

export type Screen = "vue" | "carte" | "bloc" | "deroule" | "table" | "mecanismes" | "acces" | "donnees" | "taches" | "regles" | "agents" | "packs" | "couverture" | "replays" | "reglages";

/** Les écrans des planches, dans l'ordre de la barre latérale. `built` : codé ; les autres restent visibles, sans lien. */
export const SCREENS: { id: Screen; label: string; group: string; built?: boolean }[] = [
  { id: "vue", label: "Vue d'ensemble", group: "Système", built: true },
  { id: "carte", label: "Carte", group: "Système", built: true },
  { id: "bloc", label: "Intérieur d'un bloc", group: "", built: true },
  { id: "deroule", label: "Déroulé", group: "", built: true },
  { id: "table", label: "Une table", group: "", built: true },
  { id: "mecanismes", label: "Mécanismes", group: "Système", built: true },
  { id: "acces", label: "Accès", group: "Système", built: true },
  { id: "donnees", label: "Données", group: "Système", built: true },
  { id: "taches", label: "Tâches planifiées", group: "Système", built: true },
  { id: "regles", label: "Règles et décisions", group: "Connaissance", built: true },
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
const DEEP = new Set<Screen>(["bloc", "deroule", "table"]);
/** Le prochain changement d'adresse remplace l'endroit courant (un choix dans une liste), sans allonger le chemin. */
let replacing = false;

/** Le libellé d'un endroit, pour le bouton de retour : l'écran, ou le bloc. */
export const placeLabel = (p: Place) =>
  p.screen === "bloc" && p.item ? p.item
  : p.screen === "table" && p.item ? p.item.slice(p.item.indexOf("/") + 1)
  : p.screen === "deroule" && p.item ? p.item.split(":").slice(2).join(":") || p.item
  : SCREENS.find((x) => x.id === p.screen)!.label;

/** L'écran et l'élément choisi vivent dans l'adresse : `#/carte/api`. */
export function useRoute(): { screen: Screen; item?: string; go: (screen: Screen, item?: string, opts?: { replace?: boolean }) => void; from?: Place; back?: () => void; origin: Screen; crumbs: { label: string; back: number }[] } {
  const [state, setState] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      const h = window.location.hash;
      // Un choix dans une liste remplace l'endroit ; revenu à un endroit du chemin, on le remonte jusqu'à lui ; sinon on l'allonge.
      const at = trail.lastIndexOf(h, trail.length - 2);
      if (replacing) { trail[trail.length - 1] = h; replacing = false; }
      else if (at >= 0) trail.length = at + 1;
      else if (trail[trail.length - 1] !== h) trail.push(h);
      setState(parse(h));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const prev = trail.length > 1 ? parse(trail[trail.length - 2]!) : undefined;
  // Le repère de la barre latérale : le dernier écran qui y figure, quand on est descendu dans un bloc ou un déroulé.
  const origin = DEEP.has(state.screen) ? ([...trail].reverse().map(parse).find((p) => !DEEP.has(p.screen))?.screen ?? (state.screen === "table" ? "donnees" : "carte")) : state.screen;
  // Le fil (planche L6) : depuis le dernier écran de la barre latérale jusqu'ici ; chaque étape dit de combien revenir.
  let start = trail.length - 1;
  while (start > 0 && DEEP.has(parse(trail[start]!).screen)) start--;
  const crumbs = trail.slice(start).map((h, i, all) => ({ label: placeLabel(parse(h)), back: all.length - 1 - i }));
  return {
    ...state, origin, crumbs,
    ...(prev ? { from: prev, back: () => window.history.back() } : {}),
    go: (screen, item, opts) => {
      const h = `#/${screen}${item ? `/${encodeURIComponent(item)}` : ""}`;
      if (opts?.replace) { if (window.location.hash === h) return; replacing = true; window.location.replace(h); }
      else window.location.hash = h;
    },
  };
}
