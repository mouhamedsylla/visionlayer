import styles from "./StatusMessage.module.css";

/** Un écran entier pour dire où on en est : chargement, ou erreur avec sa cause. */
export function StatusMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className={styles.status} role="status">
      <p className={styles.title}>{title}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  );
}
