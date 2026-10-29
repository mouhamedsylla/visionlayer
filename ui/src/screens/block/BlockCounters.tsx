import styles from "./BlockCounters.module.css";

export interface Counter {
  value: number;
  label: string;
  attention?: boolean;
}

/** Les grands chiffres du bandeau d'un bloc : ce qu'on peut y déclencher. */
export function BlockCounters({ counters }: { counters: Counter[] }) {
  if (!counters.length) return null;
  return (
    <div className={styles.counters}>
      {counters.map((c) => (
        <div key={c.label} className={styles.counter}>
          <span className={`${styles.value} ${c.attention ? styles.attention : ""}`}>{c.value}</span>
          <span className={styles.label}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}
