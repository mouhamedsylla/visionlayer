import type { Access } from "../../domain/data/actors";
import { proofLabel } from "../../domain/text/proof";
import { Icon } from "../../shell/icons";
import styles from "./AccessCell.module.css";

/** Une case de la grille : lit, écrit, ou rien ; les lignes au survol. */
export function AccessCell({ access }: { access?: Access }) {
  if (!access || (!access.read.length && !access.write.length)) return <span className={styles.none} aria-label="rien">·</span>;
  const where = (list: Access["read"]) => [...new Set(list.map(proofLabel))].join(", ");
  return (
    <span className={styles.cell}>
      {access.read.length > 0 && (
        <span className={styles.mark} role="img" aria-label="lit" title={`lit : ${where(access.read)}`}><Icon name="read" size={12} /></span>
      )}
      {access.write.length > 0 && (
        <span className={`${styles.mark} ${styles.write}`} role="img" aria-label="écrit" title={`écrit : ${where(access.write)}`}><Icon name="write" size={12} /></span>
      )}
    </span>
  );
}

/** La légende de la grille, avec les mêmes marques. */
export function AccessLegend() {
  return (
    <span className={styles.legend}>
      <span className={styles.legendItem}><span className={styles.mark}><Icon name="read" size={12} /></span>lit</span>
      <span className={styles.legendItem}><span className={`${styles.mark} ${styles.write}`}><Icon name="write" size={12} /></span>écrit</span>
      <span className={styles.legendItem}><span className={styles.line}>:55</span>ligne du contrôle</span>
    </span>
  );
}
