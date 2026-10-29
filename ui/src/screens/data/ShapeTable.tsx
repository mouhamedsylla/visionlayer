import type { Entity } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import styles from "./ShapeTable.module.css";

/** Toutes les colonnes : type, nulle ou non, valeur par défaut, valeurs permises, fonctions qui l'écrivent. */
export function ShapeTable({ entity }: { entity: Entity }) {
  const fields = entity.fields ?? [];
  if (!fields.length) return <p className={styles.empty}>Aucune colonne lue dans la déclaration.</p>;
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr><th>colonne</th><th>type</th><th>vide permis</th><th>par défaut</th><th>valeurs permises</th><th>écrite par</th><th>déclarée</th></tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <td className={styles.name}>{f.name}</td>
              <td className={styles.mono}>{f.type ?? ""}</td>
              <td>{f.nullable ? "oui" : "non"}</td>
              <td className={styles.mono}>{f.default ?? ""}</td>
              <td className={styles.mono}>{f.values?.join(" · ") ?? ""}</td>
              <td className={styles.mono}>{[...new Set((f.writes ?? []).map((w) => w.fn ?? w.proof.path))].join(" · ") || <span className={styles.muted}>aucune écriture lue</span>}</td>
              <td>{f.proof && <ProofRef proof={f.proof} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
