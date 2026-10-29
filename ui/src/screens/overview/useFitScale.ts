import { useLayoutEffect, useRef, useState } from "react";

/**
 * L'échelle qui fait tenir un dessin de largeur fixe dans son conteneur, sans
 * jamais l'agrandir : la carte réduite reste lisible et ne déborde pas.
 */
export function useFitScale<T extends HTMLElement>(width: number): { ref: React.RefObject<T | null>; scale: number } {
  const ref = useRef<T>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  return { ref, scale };
}
