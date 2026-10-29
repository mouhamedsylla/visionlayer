import type { TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { TechLogo } from "../../components/TechLogo";
import { primaryTechId } from "../../domain/architecture/describe";
import type { PartCover } from "../../domain/coverage/measure";
import styles from "./PartTable.module.css";

/** Une proportion en barre, avec ses deux nombres ; rien à compter s'affiche comme tel, jamais comme 0 %. */
function Ratio({ value: [ok, total] }: { value: [number, number] }) {
  if (!total) return <span className={styles.empty}>rien à compter</span>;
  return (
    <span className={styles.ratio}>
      <span className={styles.bar}><i style={{ width: `${(ok / total) * 100}%` }} /></span>
      <span className={styles.n}>{ok}/{total}</span>
    </span>
  );
}

/** Par partie du système : ses points d'entrée rattachés à une feature, ses notes à jour, ses refus expliqués. */
export function PartTable({ parts, tech }: { parts: PartCover[]; tech: Record<string, TechLabel> }) {
  return (
    <section className={styles.box} aria-label="Par partie du système">
      <h2 className={styles.head}>Par partie du système</h2>
      <table className={styles.table}>
        <thead><tr><th>partie</th><th>points d'entrée rattachés</th><th>notes à jour</th><th>refus expliqués</th></tr></thead>
        <tbody>
          {parts.map((p) => {
            const logo = primaryTechId(p.node, tech);
            return (
              <tr key={p.node.id}>
                <td><a className={styles.part} href={screenHref("architecture", p.node.id)}>{logo && <TechLogo id={logo} label={tech[logo]} size={22} />}{p.node.name}</a></td>
                <td><Ratio value={p.entries} /></td>
                <td><Ratio value={p.notes} /></td>
                <td><Ratio value={p.refusals} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
