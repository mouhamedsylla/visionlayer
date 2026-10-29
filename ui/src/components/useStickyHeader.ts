import { useEffect, useRef, useState } from "react";

const CONDENSE_AT = 64;
const EXPAND_AT = 4;

/**
 * L'en-tête d'un écran reste en haut de la zone qui défile, et se resserre dès
 * qu'on descend. Sa hauteur est publiée sur cette zone (`--header-h`), avec la
 * hauteur visible (`--view-h`) : le panneau de droite et les en-têtes de
 * tableau se calent dessous. Deux seuils écartés évitent qu'il batte quand sa
 * propre hauteur change ; une page trop courte pour défiler ne le resserre pas.
 */
export function useStickyHeader<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const scroller = el?.closest("main");
    if (!el || !scroller) return;
    const publish = () => {
      scroller.style.setProperty("--header-h", `${el.offsetHeight}px`);
      scroller.style.setProperty("--view-h", `${scroller.clientHeight}px`);
    };
    const onScroll = () => {
      const y = scroller.scrollTop;
      setCondensed((c) => (c ? y > EXPAND_AT : y > CONDENSE_AT && scroller.scrollHeight - scroller.clientHeight > el.offsetHeight + 160));
    };
    publish();
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(publish);
    observer?.observe(el);
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, []);
  return { ref, condensed };
}
