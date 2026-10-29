import type { Proof } from "../../api/types";

type Where = Pick<Proof, "path" | "line"> & Partial<Proof>;
import { Breakable } from "../Breakable";
import { ProofRef } from "../ProofRef";
import styles from "./PanelSwitch.module.css";

export interface Way {
  /** La condition telle qu'écrite ; absente pour la voie prise sinon. */
  when?: string;
  target: string;
  proof?: Where;
}

/**
 * Un aiguillage : la fonction qui décide en tête, puis chaque condition et ce
 * où elle mène. Le même dessin pour qui choisit une implémentation, ou pour
 * les branches d'un trajet.
 */
export function PanelSwitch({ head, proof, ways }: { head: string; proof?: Where; ways: Way[] }) {
  return (
    <div className={styles.switch}>
      <div className={styles.head}>
        <span className={styles.fn}><Breakable text={head} /></span>
        {proof && <ProofRef proof={proof} />}
      </div>
      <ol className={styles.ways}>
        {ways.map((w, i) => (
          <li key={`${w.target}-${w.when ?? ""}-${i}`} className={w.when ? undefined : styles.fallback}>
            <span className={styles.when}><Breakable text={w.when ?? (ways.length > 1 ? "sinon" : "toujours")} /></span>
            <i className={styles.arrow} aria-hidden="true" />
            <span className={styles.impl}><Breakable text={w.target} />{!w.when && ways.length > 1 && <small>par défaut</small>}</span>
            {w.proof && <ProofRef proof={w.proof} />}
          </li>
        ))}
      </ol>
    </div>
  );
}
