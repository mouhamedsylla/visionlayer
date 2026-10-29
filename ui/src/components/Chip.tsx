import type { ReactNode } from "react";
import styles from "./Chip.module.css";

/** Une pastille en mono : une nature, un effet. `strong` pour ce qui écrit, `missing` pour ce qui manque. */
export function Chip({ tone = "plain", title, children }: { tone?: "plain" | "strong" | "missing"; title?: string; children: ReactNode }) {
  return <span className={`${styles.chip} ${tone !== "plain" ? styles[tone] : ""}`} title={title}>{children}</span>;
}
