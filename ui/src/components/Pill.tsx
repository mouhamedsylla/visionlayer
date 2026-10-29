import type { ReactNode } from "react";
import styles from "./Pill.module.css";

/** Étiquette de section, en mono, sur un fond à peine teinté. */
export function Pill({ children }: { children: ReactNode }) {
  return <span className={styles.pill}>{children}</span>;
}
