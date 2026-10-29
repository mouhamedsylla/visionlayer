import type { Shape } from "../../api/types";
import { Breakable } from "../../components/Breakable";
import { ProofRef } from "../../components/ProofRef";
import styles from "./ShapeFields.module.css";

/** Un type du contrat : chaque champ, son type, et le commentaire que l'auteur a écrit au-dessus. */
export function ShapeFields({ verb, shape }: { verb: string; shape: Shape }) {
  return (
    <section className={styles.box}>
      <h3 className={styles.head}>
        <span className={styles.verb}>{verb}</span>
        <span className={styles.name}>{shape.name}</span>
        <span className={styles.count}>{shape.fields.length} champ{shape.fields.length > 1 ? "s" : ""}</span>
        <ProofRef proof={shape.proof} />
      </h3>
      <table className={styles.table}>
        <colgroup><col className={styles.colName} /><col className={styles.colType} /><col /></colgroup>
        <thead><tr><th>champ</th><th>type</th><th>sens · commentaire du code</th></tr></thead>
        <tbody>
          {shape.fields.map((f) => (
            <tr key={f.name}>
              <td className={styles.field}><Breakable text={f.name} />{f.optional && <span className={styles.opt}>facultatif</span>}</td>
              <td className={styles.type}>{f.type ? <Breakable text={f.type} /> : ""}</td>
              <td>{f.comment ?? <span className={styles.none}>aucun commentaire</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
