import type { TechLabel } from "../../api/types";
import type { FactCard } from "../../domain/architecture/facts";
import { FactVisualView } from "./FactVisual";
import styles from "./FactsRow.module.css";
import { TechText } from "../../components/TechText";

/** Le bandeau : cinq cases, chacune avec sa phrase et sa propre forme visuelle. */
export function FactsRow({ facts, tech }: { facts: FactCard[]; tech: Record<string, TechLabel> }) {
  return (
    <div className={styles.row}>
      {facts.map((f) => (
        <section key={f.question} className={`${styles.fact} ${f.attention ? styles.attention : ""}`} aria-label={f.question}>
          <span className={styles.question}>{f.question}</span>
          <span className={styles.answer}>{f.answer}</span>
          {f.visual && <FactVisualView visual={f.visual} tech={tech} />}
          {f.detail && <span className={styles.detail}><TechText text={f.detail} /></span>}
        </section>
      ))}
    </div>
  );
}
