import type { StateInfo } from "../../domain/data/lifecycle";
import styles from "./StatesStrip.module.css";

/** Les valeurs du champ, dans l'ordre du schéma ; sous chacune, les fonctions qui l'écrivent, ou `jamais écrit`. */
export function StatesStrip({ states }: { states: StateInfo[] }) {
  return (
    <div className={styles.frame}>
      <i className={`${styles.corner} ${styles.a}`} /><i className={`${styles.corner} ${styles.b}`} />
      <i className={`${styles.corner} ${styles.c}`} /><i className={`${styles.corner} ${styles.d}`} />
      <ol className={styles.states}>
        {states.map((s) => (
          <li key={s.value} className={styles.state}>
            <span className={`${styles.value} ${s.writers.length ? "" : styles.never}`}>{s.value}</span>
            {s.isDefault && <span className={styles.tag}>par défaut</span>}
            <span className={styles.who}>
              {s.writers.length ? s.writers.join(" · ") : "jamais écrit"}
            </span>
            {!s.declared && <span className={styles.who}>écrit, absent des valeurs du schéma</span>}
            {s.declared && !s.writers.length && <span className={styles.who}>déclaré dans le schéma, écrit nulle part</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
