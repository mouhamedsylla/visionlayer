import { Pill } from "../../components/Pill";
import styles from "./TraceLegend.module.css";

/** Ce que disent les traits : d'où vient le texte d'une étape, et la nature de chaque flèche. */
export function TraceLegend() {
  return (
    <div className={styles.legend}>
      <Pill>provenance</Pill>
      <span className={styles.item}><i className={styles.extracted} />extrait du code</span>
      <span className={styles.item}><i className={styles.comment} />commentaire de l'auteur</span>
      <Pill>flèches</Pill>
      <span className={styles.item}><i className={styles.call} />appel</span>
      <span className={styles.item}><i className={styles.data} />donnée lue, écrite ou mise en file</span>
      <span className={styles.item}><i className={styles.back} />réponse, refus, arrêt</span>
    </div>
  );
}
