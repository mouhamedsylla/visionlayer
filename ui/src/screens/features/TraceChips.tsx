import { reachOf, type EntryRef } from "../../domain/features/list";
import styles from "./TraceChips.module.css";

/** La ligne sous le titre : sans feature, le point d'entrée, et ce qu'il atteint, calculé depuis son déroulé. */
export function TraceChips({ item: { entry }, names }: { item: EntryRef; names: Map<string, string> }) {
  const reach = reachOf(entry, names);
  return (
    <div className={styles.chips}>
      <span className={styles.none}>sans feature</span>
      <span className={styles.word}>point d'entrée</span>
      <span className={styles.chip}>{entry.key}</span>
      {(reach.services.length + reach.topics.length + reach.tables.length > 0) && <span className={styles.word}>atteint (calculé)</span>}
      {reach.services.map((s) => <span key={s} className={styles.chip}>{s}</span>)}
      {reach.topics.map((t) => <span key={t} className={styles.chip}>file {t}</span>)}
      {reach.tables.length > 0 && <span className={styles.data}>{reach.tables.join(" · ")}</span>}
    </div>
  );
}
