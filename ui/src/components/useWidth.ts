import { useEffect, useRef, useState } from "react";

/** La largeur d'un élément, suivie quand elle change (barre latérale ouverte, panneau replié, fenêtre). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
