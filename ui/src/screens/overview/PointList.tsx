import { ProofRef } from "../../components/ProofRef";
import type { PointRow } from "../../domain/overview/points";
import { Icon } from "../../shell/icons";
import styles from "./PointList.module.css";

interface Props {
  rows: PointRow[];
  selected: number;
  onSelect: (index: number) => void;
}

/** Les points à vérifier, une ligne par nature : le sujet, ce qui est constaté, et où. */
export function PointList({ rows, selected, onSelect }: Props) {
  return (
    <ul className={styles.list}>
      {rows.map((r, i) => (
        <li key={r.code}>
          <button type="button" className={`${styles.row} ${i === selected ? styles.on : ""}`} aria-pressed={i === selected} onClick={() => onSelect(i)}>
            <span className={styles.tag}><Icon name={r.icon} size={12} />{r.tag}</span>
            <span className={styles.label}>{r.label}</span>
            <span className={styles.where}>
              {r.findings.length > 1 ? `${r.findings.length} endroits` : r.proof && <ProofRef proof={r.proof} plain />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
