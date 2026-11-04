import { useEffect, useState } from "react";

export type Screen = "vue" | "carte" | "fonctionnalites" | "bloc" | "deroule" | "table" | "mecanismes" | "acces" | "donnees" | "taches" | "regles" | "agents" | "packs" | "couverture" | "replays" | "reglages";

/** Les écrans des planches, dans l'ordre de la barre latérale. `built` : codé ; les autres restent visibles, sans lien. */
export const SCREENS: { id: Screen; label: string; group: string; built?: boolean }[] = [
  { id: "vue", label: "Vue d'ensemble", group: "Système", built: true },
  { id: "carte", label: "Carte", group: "Système", built: true },
  { id: "fonctionnalites", label: "Fonctionnalités", group: "Système", built: true },
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

type Place = { screen: Screen; item?: string; scope?: string; tab?: string };
const parse = (hash: string): Place => {
  const [path = "", query] = hash.split("?");
  const [, s, ...rest] = path.split("/");
  const screen = SCREENS.some((x) => x.id === s && x.built) ? (s as Screen) : "vue";
  const q = new URLSearchParams(query ?? "");
  return { screen, item: rest.length ? decodeURIComponent(rest.join("/")) : undefined, ...(q.get("bloc") ? { scope: q.get("bloc")! } : {}), ...(q.get("onglet") ? { tab: q.get("onglet")! } : {}) };
};
const hashOf = (p: Place) => `#/${p.screen}${p.item ? `/${encodeURIComponent(p.item)}` : ""}${query(p)}`;
function query(p: Place) {
  const q = [p.scope ? `bloc=${encodeURIComponent(p.scope)}` : "", p.tab ? `onglet=${encodeURIComponent(p.tab)}` : ""].filter(Boolean).join("&");
  return q ? `?${q}` : "";
}

/**
 * Le chemin parcouru dans l'app (planche 03b) : le retour ramène d'où l'on vient, pas à un écran fixe. La barre
 * latérale commence un nouveau fil (`root`) ; un lien depuis un autre écran le prolonge.
 */
const trail: { h: string; root: boolean }[] = [{ h: window.location.hash, root: true }];
const DEEP = new Set<Screen>(["bloc", "deroule", "table"]);
/** Le prochain changement d'adresse remplace l'endroit courant (un choix dans une liste), sans allonger le chemin. */
let replacing = false;
/** Le prochain changement d'adresse commence un fil. */
let rooting = false;

/** Le libellé d'un endroit, pour le bouton de retour : l'écran, ou le bloc. */
export const placeLabel = (p: Place) =>
  p.screen === "bloc" && p.item ? p.item
  : p.screen === "table" && p.item ? p.item.slice(p.item.indexOf("/") + 1)
  : p.screen === "deroule" && p.item ? p.item.split(":").slice(2).join(":") || p.item
  : SCREENS.find((x) => x.id === p.screen)!.label;

/** Une étape du fil : son libellé, de combien revenir, et le bloc qu'elle nomme s'il y en a un. */
export interface Crumb { label: string; back: number; node?: string }

/** Le fil, depuis le dernier départ jusqu'ici : `Carte › API › Accès`. Plusieurs choix de suite dans un même écran n'en font qu'une étape. */
function crumbsOf(): Crumb[] {
  let start = trail.length - 1;
  while (start > 0 && !trail[start]!.root) start--;
  const places = trail.slice(start).map((t) => parse(t.h));
  const out: Crumb[] = [];
  places.forEach((p, i) => {
    if (!DEEP.has(p.screen) && places[i + 1]?.screen === p.screen) return;
    const back = places.length - 1 - i;
    const entering = places[i + 1]?.screen === "bloc" && places[i + 1]?.item === p.item;
    if (p.screen === "carte" && p.item && !entering) out.push({ label: "Carte", back }, { label: p.item, back, node: p.item });
    else if (p.screen === "carte") out.push({ label: "Carte", back });
    else out.push({ label: placeLabel(p), back, ...(p.screen === "bloc" && p.item ? { node: p.item } : {}) });
  });
  return out;
}

export interface GoOptions {
  replace?: boolean;
  /** Commence un nouveau fil : la barre latérale. */
  root?: boolean;
  /** Le bloc auquel se limite l'écran ouvert ; `null` rend tout le système. Sans cela, il reste le même dans un même écran et se perd ailleurs. */
  scope?: string | null;
  /** Fixe d'abord l'endroit qu'on quitte : le retour y ramène avec cet élément choisi. */
  leaving?: { screen: Screen; item?: string };
  /** L'onglet de la page ouverte : `#/table/postgres/order?onglet=etats`. */
  tab?: string;
}

/** L'écran, l'élément choisi et le bloc suivi vivent dans l'adresse : `#/carte/api`, `#/acces/entrees?bloc=api`. */
export function useRoute(): Place & { go: (screen: Screen, item?: string, opts?: GoOptions) => void; from?: Place; back?: () => void; origin: Screen; crumbs: Crumb[] } {
  const [state, setState] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      const h = window.location.hash;
      // Un choix dans une liste remplace l'endroit ; un départ de la barre latérale commence un fil ; revenu à un endroit du chemin, on le remonte jusqu'à lui ; sinon on l'allonge.
      let at = -1;
      for (let i = trail.length - 2; i >= 0; i--) if (trail[i]!.h === h) { at = i; break; }
      if (replacing) { trail[trail.length - 1]!.h = h; replacing = false; }
      else if (rooting) { trail.push({ h, root: true }); rooting = false; }
      else if (at >= 0) trail.length = at + 1;
      else if (trail[trail.length - 1]!.h !== h) trail.push({ h, root: false });
      setState(parse(h));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const here = trail[trail.length - 1]!;
  const prev = !here.root && trail.length > 1 ? parse(trail[trail.length - 2]!.h) : undefined;
  // Le repère de la barre latérale : l'écran où l'on est ; descendu dans un bloc ou un déroulé, le dernier écran qui y figure.
  const origin = DEEP.has(state.screen) ? ([...trail].reverse().map((t) => parse(t.h)).find((p) => !DEEP.has(p.screen))?.screen ?? (state.screen === "table" ? "donnees" : "carte")) : state.screen;
  return {
    ...state, origin, crumbs: crumbsOf(),
    ...(prev ? { from: prev, back: () => window.history.back() } : {}),
    go: (screen, item, opts) => {
      const scope = opts?.scope === null ? undefined : opts?.scope ?? (screen === state.screen ? state.scope : undefined);
      const h = hashOf({ screen, ...(item ? { item } : {}), ...(scope ? { scope } : {}), ...(opts?.tab ? { tab: opts.tab } : {}) });
      if (opts?.leaving) {
        const at = hashOf(opts.leaving);
        window.history.replaceState(null, "", at);
        trail[trail.length - 1]!.h = at;
      }
      if (opts?.replace) { if (window.location.hash === h) return; replacing = true; window.location.replace(h); return; }
      if (opts?.root) {
        if (window.location.hash === h) { here.root = true; setState(parse(h)); return; }
        rooting = true;
      }
      window.location.hash = h;
    },
  };
}
