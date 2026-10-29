import { clockTime, sinceLabel } from "../domain/text/time";
import { Icon } from "./icons";
import { useNow } from "./useNow";
import styles from "./Freshness.module.css";

/** Quand la carte a été calculée : l'heure, depuis combien de temps, et un trait qui court pendant une analyse. */
export function Freshness({ builtAt, refreshing }: { builtAt: string; refreshing: boolean }) {
  const now = useNow();
  return (
    <div className={`${styles.fresh} ${refreshing ? styles.busy : ""}`} title={`Carte calculée à ${clockTime(builtAt)}`}>
      <span className={styles.clock}><Icon name="clock" size={14} /></span>
      {refreshing ? <span className={styles.when}>Analyse en cours</span> : (
        <>
          <span className={styles.when}>Analysé à <b className={styles.time}>{clockTime(builtAt)}</b></span>
          <span className={styles.since}>{sinceLabel(builtAt, now)}</span>
        </>
      )}
    </div>
  );
}
