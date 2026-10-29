import type { ArchModelV2, TechLabel } from "../../api/types";
import { findScreen, screenHref } from "../../app/screens";
import { overviewStats } from "../../domain/overview/stats";
import styles from "./HeroStats.module.css";

/** Les compteurs du bas du bandeau ; chacun mène à l'écran qui le détaille, quand cet écran est recodé. */
export function HeroStats({ model, tech }: { model: ArchModelV2; tech: Record<string, TechLabel> }) {
  return (
    <div className={styles.stats}>
      {overviewStats(model, tech).map((s, i) => {
        const body = (
          <>
            <i className={styles.cross} aria-hidden="true" />
            <span className={styles.value}>{s.value}</span>
            <span className={styles.label}>{s.label}</span>
          </>
        );
        return findScreen(s.screen)
          ? <a key={i} className={styles.stat} href={screenHref(s.screen)}>{body}</a>
          : <div key={i} className={styles.stat} title="Cet écran n'est pas encore recodé">{body}</div>;
      })}
    </div>
  );
}
