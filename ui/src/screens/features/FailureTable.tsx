import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import type { Failure } from "../../domain/features/trace";
import styles from "./FailureTable.module.css";

/** « Règles et invariants » puis « Si ça rate » : ce que les agents déclareront, et ce que le code montre déjà quand une étape échoue. */
export function FailureTable({ failures }: { failures: Failure[] }) {
  return (
    <>
      <div className={styles.caption}>
        <Pill>Règles et invariants · 0</Pill>
        <span className={styles.hint}>déclarés par l'agent dans sa fiche, puis vérifiés contre le code</span>
      </div>
      <p className={styles.empty}>Aucune fiche d'agent sur ce code : aucune règle ni invariant déclaré. Les commentaires de l'auteur sont repris dans le déroulé.</p>
      <div className={styles.caption}>
        <Pill>Si ça rate · {failures.length}</Pill>
        <span className={styles.hint}>ce que le code fait quand une étape échoue, et les constats posés sur ses lignes</span>
      </div>
      {failures.length ? (
        <table className={styles.table}>
          <thead><tr><th>ce qui se passe</th><th>type</th><th>où</th></tr></thead>
          <tbody>
            {failures.map((f, i) => (
              <tr key={i}>
                <td>{f.text}</td>
                <td><span className={styles.type}>{f.type}</span></td>
                <td>{f.proof && <ProofRef proof={f.proof} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className={styles.empty}>Aucun refus sur erreur ni constat sur les lignes de ce déroulé.</p>}
    </>
  );
}
