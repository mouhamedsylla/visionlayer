import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Une toile qu'on zoome et qu'on déplace (planche L6 : la carte, avec zoom et déplacement). Ctrl ou ⌘ avec la
 * molette, ou le pincement du pavé tactile, zoome autour du pointeur ; la molette seule et le glisser déplacent.
 * Un glisser ne compte pas comme un clic : choisir un bloc et y entrer restent des clics.
 */
export function ZoomPan({ children, minWidth = 960 }: { children: ReactNode; minWidth?: number }) {
  const view = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const [height, setHeight] = useState(480);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const swallow = useRef(false);

  const fit = useCallback(() => {
    const v = view.current, c = inner.current;
    if (!v || !c) return;
    const h = Math.max(320, Math.min(window.innerHeight * 0.72, c.offsetHeight + 24));
    setHeight(h);
    const k = Math.min(1, v.clientWidth / c.offsetWidth, h / c.offsetHeight);
    setT({ k, x: (v.clientWidth - c.offsetWidth * k) / 2, y: Math.max(0, (h - c.offsetHeight * k) / 2) });
  }, []);
  useLayoutEffect(fit, [fit]);

  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const v = view.current;
    if (!v) return;
    setT((s) => {
      const k = Math.min(2.5, Math.max(0.25, s.k * factor));
      const cx = px ?? v.clientWidth / 2, cy = py ?? v.clientHeight / 2;
      return { k, x: cx - ((cx - s.x) * k) / s.k, y: cy - ((cy - s.y) * k) / s.k };
    });
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = v.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else setT((s) => ({ ...s, x: s.x - e.deltaX, y: s.y - e.deltaY }));
    };
    // Après un glisser, le clic qui suit n'est pas un choix.
    const onClick = (e: MouseEvent) => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); swallow.current = false; } };
    v.addEventListener("wheel", onWheel, { passive: false });
    v.addEventListener("click", onClick, true);
    return () => { v.removeEventListener("wheel", onWheel); v.removeEventListener("click", onClick, true); };
  }, [zoomAt]);

  return (
    <div className="zp" ref={view} style={{ height }}
      onPointerDown={(e) => { if (e.button === 0) drag.current = { x: e.clientX, y: e.clientY, ox: t.x, oy: t.y, moved: false }; }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
        if (!d.moved) { d.moved = true; view.current?.setPointerCapture(e.pointerId); }
        setT((s) => ({ ...s, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
      }}
      onPointerUp={() => { if (drag.current?.moved) swallow.current = true; drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}>
      <div className="zp__inner" ref={inner} style={{ minWidth, transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}>{children}</div>
      <div className="zp__tools" onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}>−</button>
        <button className="zp__pct" title="Actual size" onClick={() => zoomAt(1 / t.k)}>{Math.round(t.k * 100)} %</button>
        <button aria-label="Zoom in" onClick={() => zoomAt(1.25)}>+</button>
        <button onClick={fit}>Fit</button>
      </div>
    </div>
  );
}
