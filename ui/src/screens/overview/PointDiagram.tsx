import type { ArchNode, TechLabel } from "../../api/types";
import { TechLogo } from "../../components/TechLogo";
import { kindLabel, primaryTechId } from "../../domain/architecture/describe";
import { findingSubject, type PointRow } from "../../domain/overview/points";
import { proofLabel } from "../../domain/text/proof";
import styles from "./PointDiagram.module.css";
import { TechText } from "../../components/TechText";

const ROW = 56;
const MID = 22;

interface Props {
  row: PointRow;
  nodes: Map<string, ArchNode>;
  tech: Record<string, TechLabel>;
  focus: number;
}

/** Le point en fil : à gauche les lignes où il est constaté, à droite les blocs qu'il touche, reliés. */
export function PointDiagram({ row, nodes, tech, focus }: Props) {
  const blocks = row.nodes.map((id) => nodes.get(id)).filter((n): n is ArchNode => !!n);
  const index = new Map(blocks.map((b, i) => [b.id, i]));
  const height = Math.max(row.findings.length, blocks.length, 1) * ROW - (ROW - 44);
  const lines = row.findings.flatMap((f, i) => (f.nodes ?? []).filter((id) => index.has(id)).map((id) => ({ i, j: index.get(id)! })));
  return (
    <div className={styles.diagram} style={{ height }}>
      <div className={styles.column}>
        {row.findings.map((f, i) => {
          const p = f.proof[0];
          const where = p ? proofLabel(p) : "sans ligne";
          const subject = findingSubject(f.message);
          return (
            <div key={i} className={`${styles.item} ${i === focus ? styles.focus : ""}`}>
              {subject && <span className={styles.kind}>{where}</span>}
              <span className={styles.name}>{subject ? <TechText text={subject} /> : where}</span>
            </div>
          );
        })}
      </div>
      <svg className={styles.links} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {lines.map(({ i, j }) => {
          const [y1, y2] = [i * ROW + MID, j * ROW + MID];
          return <path key={`${i}-${j}`} d={`M0 ${y1} C50 ${y1} 50 ${y2} 100 ${y2}`} className={i === focus ? styles.lineOn : styles.line} />;
        })}
      </svg>
      <div className={styles.column}>
        {blocks.map((b) => {
          const logo = primaryTechId(b, tech) ?? b.tech?.[0];
          return (
            <div key={b.id} className={`${styles.item} ${styles.block}`}>
              {logo && <TechLogo id={logo} label={tech[logo]} size={18} bare />}
              <span className={styles.text}>
                <span className={styles.kind}>{kindLabel(b, tech)}</span>
                <span className={styles.name}>{b.name}</span>
              </span>
            </div>
          );
        })}
        {blocks.length === 0 && <div className={`${styles.item} ${styles.none}`}><span className={styles.kind}>aucun bloc</span><span className={styles.name}>hors des déployables</span></div>}
      </div>
    </div>
  );
}
