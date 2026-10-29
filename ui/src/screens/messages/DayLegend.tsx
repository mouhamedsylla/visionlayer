import styles from "./DayLegend.module.css";

/** Ce que disent les formes de la journée. */
export function DayLegend() {
  return (
    <div className={styles.legend}>
      <span><i className={styles.keyMark} />planifié, heure fixe</span>
      <span><i className={styles.keyBand} />planifié, en continu</span>
      <span><i className={styles.keyNone} />sans horaire, dépend des arrivées</span>
    </div>
  );
}
