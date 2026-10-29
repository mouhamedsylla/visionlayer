import { useEffect, useState } from "react";

function readHash(fallback: string): string {
  return window.location.hash.replace(/^#\/?/, "") || fallback;
}

/** L'écran courant, lu dans `#/<écran>` : un lien se partage et le bouton retour marche. */
export function useHashRoute(fallback: string): string {
  const [route, setRoute] = useState(() => readHash(fallback));
  useEffect(() => {
    const onChange = () => setRoute(readHash(fallback));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [fallback]);
  return route;
}
