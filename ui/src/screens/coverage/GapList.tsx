import { useState } from "react";
import { ProofRef } from "../../components/ProofRef";
import type { Gap } from "../../domain/coverage/gaps";
import styles from "./GapList.module.css";

const SHOWN = 6;

/** Les trous, du plus risqué au moins ; au-delà de six, les autres attendent un clic. */
export function GapList({ gaps }: { gaps: Gap[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? gaps : gaps.slice(0, SHOWN);
  return (
    <section className={styles.box} aria-label="Les trous">
      <h2 className={styles.head}>Les trous, du plus risqué au moins<span className={styles.count}>{gaps.length}</span></h2>
      {gaps.length === 0 && <p className={styles.none}>Aucun trou : chaque point d'entrée est rattaché, chaque refus expliqué, chaque note à jour.</p>}
      <ul className={styles.list}>
        {shown.map((g, i) => (
          <li key={`${g.tag}-${g.title}-${i}`} className={styles.gap}>
            <span className={styles.text}>
              <span className={styles.line}>
                {g.href ? <a className={styles.title} href={g.href}>{g.title}</a> : <b className={styles.title}>{g.title}</b>}
                <span className={styles.tag}>{g.tag}</span>
              </span>
              <span className={styles.detail}>{g.detail}</span>
            </span>
            {g.proof && <ProofRef proof={g.proof} />}
          </li>
        ))}
      </ul>
      {gaps.length > SHOWN && <button type="button" className={styles.more} onClick={() => setAll((a) => !a)}>{all ? "Montrer moins" : `Voir les ${gaps.length - SHOWN} autres`}</button>}
    </section>
  );
}
