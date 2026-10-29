import type { TechLabel } from "../../api/types";
import type { TechGroup } from "../../domain/technologies/groups";
import { TechTileLink } from "./TechTileLink";
import styles from "./TechGroupBox.module.css";

/** Quatre tuiles et plus : la famille prend toute la largeur. */
const WIDE = 4;

/** Une famille de technologies : son nom, son compte, ses tuiles. */
export function TechGroupBox({ group, tech, current }: { group: TechGroup; tech: Record<string, TechLabel>; current?: string }) {
  return (
    <section className={`${styles.box} ${group.tiles.length >= WIDE ? styles.wide : ""}`} aria-label={group.title}>
      <h2 className={styles.head}>{group.title}<span className={styles.count}>{group.tiles.length}</span></h2>
      <div className={styles.tiles}>
        {group.tiles.map((t) => <TechTileLink key={t.id} tile={t} label={tech[t.id]} on={t.id === current} />)}
      </div>
    </section>
  );
}
