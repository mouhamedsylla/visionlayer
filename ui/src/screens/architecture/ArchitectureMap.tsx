import { useMemo } from "react";
import type { ArchNode, Finding, TechLabel } from "../../api/types";
import { Pill } from "../../components/Pill";
import { COLUMNS } from "../../domain/architecture/columns";
import { findingsOf } from "../../domain/architecture/findings";
import { layoutMap } from "../../domain/architecture/layout";
import { linksOf, type MapLink } from "../../domain/architecture/links";
import { MapLinks } from "./MapLinks";
import { MapNode, type NodeState } from "./MapNode";
import { useNodeHeights } from "./useNodeHeights";
import styles from "./ArchitectureMap.module.css";

interface Props {
  nodes: ArchNode[];
  links: MapLink[];
  findings: Finding[];
  tech: Record<string, TechLabel>;
  selected?: string;
  onSelect: (id: string) => void;
}

export function ArchitectureMap({ nodes, links, findings, tech, selected, onSelect }: Props) {
  const { heights, measure } = useNodeHeights();
  const layout = useMemo(() => layoutMap(nodes, links, heights), [nodes, links, heights]);
  const neighbours = new Set(selected ? linksOf(selected, links).flatMap((l) => [l.from, l.to]) : []);
  const stateOf = (id: string): NodeState =>
    !selected ? "idle" : id === selected ? "selected" : neighbours.has(id) ? "linked" : "dim";

  return (
    <div className={styles.scroller}>
      <div className={styles.canvas} style={{ width: layout.width, height: layout.height }}>
        {COLUMNS.map((c) => (
          <div key={c.id} className={styles.column} style={{ left: layout.columnX[c.id] }}>
            <Pill>{c.title}</Pill>
            <span className={styles.hint}>{c.hint}</span>
          </div>
        ))}
        <MapLinks links={links} layout={layout} selected={selected} />
        {nodes.map((n) => {
          const place = layout.placed.get(n.id);
          return place ? (
            <MapNode key={n.id} node={n} place={place} tech={tech} findings={findingsOf(n.id, findings).length}
              state={stateOf(n.id)} onSelect={onSelect} measureRef={measure(n.id)} />
          ) : null;
        })}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <svg width="34" height="6" aria-hidden="true"><path d="M1 3H33" className={`${styles.sample} ${styles.sampleActive}`} /></svg>
          liens du bloc choisi
        </span>
        <span className={styles.legendItem}>
          <svg width="34" height="6" aria-hidden="true"><path d="M1 3H33" className={styles.sample} /></svg>
          autres liens
        </span>
      </div>
    </div>
  );
}
