import { useEffect, useState } from "react";

export type Screen = "vue" | "carte" | "bloc" | "deroule" | "acces" | "donnees" | "taches" | "regles" | "agents" | "packs" | "couverture" | "replays" | "reglages";

/** Les écrans des planches, dans l'ordre de la barre latérale. `built` : codé ; les autres restent visibles, sans lien. */
export const SCREENS: { id: Screen; label: string; group: string; built?: boolean }[] = [
  { id: "vue", label: "Vue d'ensemble", group: "Système", built: true },
  { id: "carte", label: "Carte", group: "Système", built: true },
  { id: "bloc", label: "Intérieur d'un bloc", group: "", built: true },
  { id: "deroule", label: "Déroulé", group: "", built: true },
  { id: "acces", label: "Accès", group: "Système", built: true },
  { id: "donnees", label: "Données", group: "Système", built: true },
  { id: "taches", label: "Tâches planifiées", group: "Système", built: true },
  { id: "regles", label: "Règles et décisions", group: "Connaissance" },
  { id: "agents", label: "Sessions d'agents", group: "Connaissance", built: true },
  { id: "packs", label: "Packs", group: "Lecture", built: true },
  { id: "couverture", label: "Couverture", group: "Lecture" },
  { id: "replays", label: "Replays", group: "Pratique" },
  { id: "reglages", label: "Réglages", group: "", built: true },
];

/** L'écran et l'élément choisi vivent dans l'adresse : `#/carte/api`. */
export function useRoute(): { screen: Screen; item?: string; go: (screen: Screen, item?: string) => void } {
  const read = () => {
    const [, s, ...rest] = window.location.hash.split("/");
    const screen = SCREENS.some((x) => x.id === s && x.built) ? (s as Screen) : "vue";
    return { screen, item: rest.length ? decodeURIComponent(rest.join("/")) : undefined };
  };
  const [state, setState] = useState(read);
  useEffect(() => {
    const on = () => setState(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return { ...state, go: (screen, item) => { window.location.hash = `/${screen}${item ? `/${encodeURIComponent(item)}` : ""}`; } };
}
