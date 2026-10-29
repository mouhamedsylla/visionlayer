import type { ArchNode, TechLabel } from "../../api/types";
import { TechLogo } from "../../components/TechLogo";
import { contentBadges, kindLabel, otherTechIds, primaryTechId } from "../../domain/architecture/describe";
import { NODE_SIZE, type Placed } from "../../domain/architecture/layout";
import { count } from "../../domain/text/plural";
import styles from "./MapNode.module.css";

export type NodeState = "selected" | "linked" | "dim" | "idle";

interface Props {
  node: ArchNode;
  place: Placed;
  tech: Record<string, TechLabel>;
  findings: number;
  state: NodeState;
  onSelect: (id: string) => void;
  measureRef: (el: HTMLElement | null) => void;
}

/** Un bloc de la carte : le logo de sa technologie, sa nature, son nom, ce qu'il contient, et ce qu'il emploie d'autre. */
export function MapNode({ node, place, tech, findings, state, onSelect, measureRef }: Props) {
  const badges = contentBadges(node);
  const main = primaryTechId(node, tech) ?? node.tech?.[0];
  const others = otherTechIds(node, tech).filter((t) => t !== main);
  return (
    <button
      ref={measureRef}
      type="button"
      className={`${styles.node} ${state !== "idle" ? styles[state] : ""}`}
      style={{ left: place.x, top: place.y, width: NODE_SIZE.width, minHeight: NODE_SIZE.height }}
      aria-pressed={state === "selected"}
      onClick={() => onSelect(node.id)}
    >
      <span className={styles.head}>
        {main ? <TechLogo id={main} label={tech[main]} size={28} /> : <span className={styles.blank} aria-hidden="true" />}
        <span className={styles.title}>
          <span className={styles.kind}>{kindLabel(node, tech)}</span>
          <span className={styles.name}>{node.name}</span>
        </span>
      </span>
      {(badges.length > 0 || findings > 0) && (
        <span className={styles.badges}>
          {badges.map((b) => <span key={b} className={styles.badge}>{b}</span>)}
          {findings > 0 && <span className={`${styles.badge} ${styles.warn}`}>{count(findings, "point")}</span>}
        </span>
      )}
      {others.length > 0 && (
        <span className={styles.uses} aria-label="emploie aussi">
          {others.map((t) => <TechLogo key={t} id={t} label={tech[t]} size={14} bare />)}
        </span>
      )}
    </button>
  );
}
