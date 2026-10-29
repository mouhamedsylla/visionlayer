import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * La hauteur rendue de chaque bloc, pour que la mise en page ne fasse jamais
 * chevaucher deux blocs ni couper leur texte. Mesurée après chaque rendu ;
 * l'état ne change que si une hauteur a changé.
 */
export function useNodeHeights(): { heights: Record<string, number>; measure: (id: string) => (el: HTMLElement | null) => void } {
  const elements = useRef(new Map<string, HTMLElement>());
  const [heights, setHeights] = useState<Record<string, number>>({});

  const measure = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) elements.current.set(id, el);
    else elements.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const [id, el] of elements.current) next[id] = el.offsetHeight;
    const changed = Object.keys(next).some((id) => next[id] !== heights[id]);
    if (changed) setHeights(next);
  });

  return { heights, measure };
}
