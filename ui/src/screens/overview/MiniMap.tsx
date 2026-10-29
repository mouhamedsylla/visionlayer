import { useMemo } from "react";
import type { ArchModelV2, TechLabel } from "../../api/types";
import { TechLogo } from "../../components/TechLogo";
import { MINI, miniMap } from "../../domain/overview/minimap";
import { useFitScale } from "./useFitScale";
import styles from "./MiniMap.module.css";

interface Props {
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
  /** Les blocs à mettre en avant : ceux du point ouvert plus bas. */
  marked: string[];
}

/** La carte du système, en fil pointillé dans des repères de coupe ; réduite d'un bloc quand la place manque. */
export function MiniMap({ model, tech, marked }: Props) {
  const view = useMemo(() => miniMap(model, tech), [model, tech]);
  const on = new Set(marked);
  const { ref, scale } = useFitScale<HTMLDivElement>(MINI.width);
  return (
    <div ref={ref} className={styles.fit} style={{ maxWidth: MINI.width, height: MINI.height * scale }}>
      <div className={styles.frame} style={{ width: MINI.width, height: MINI.height, transform: `scale(${scale})` }} aria-label="Carte du système, réduite">
        <i className={`${styles.corner} ${styles.a}`} /><i className={`${styles.corner} ${styles.b}`} />
        <i className={`${styles.corner} ${styles.c}`} /><i className={`${styles.corner} ${styles.d}`} />
        {view.columns.map((c) => <div key={c.x} className={styles.column} style={{ left: c.x }}>{c.title}</div>)}
        <svg className={styles.links} width={MINI.width} height={MINI.height} aria-hidden="true">
          {view.links.map((l) => (
            <path key={l.id} d={l.path} className={on.has(l.from) && on.has(l.to) ? styles.linkOn : styles.link} />
          ))}
        </svg>
        {view.nodes.map((n) => (
          <div key={n.id} className={`${styles.node} ${on.has(n.id) ? styles.marked : ""}`}
            style={{ left: n.x, top: n.y, width: MINI.nodeWidth, height: MINI.nodeHeight }}>
            {n.tech && <TechLogo id={n.tech} label={tech[n.tech]} size={16} bare />}
            <span className={styles.label}>
              <span className={styles.kind}>{n.kind}</span>
              <span className={styles.name}>{n.name}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
