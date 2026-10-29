import type { ArchModelV2 } from "../../api/types";
import { Pill } from "../../components/Pill";
import type { EntryGroup } from "../../domain/features/list";
import { FeatureRow } from "./FeatureRow";
import styles from "./FeatureList.module.css";

interface Props {
  groups: EntryGroup[];
  model: ArchModelV2;
  names: Map<string, string>;
}

/** Les points d'entrée sans feature, par regroupement proposé ; chaque ligne mène au déroulé. */
export function FeatureList({ groups, model, names }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.caption}>
        <Pill>Points d'entrée sans feature · {groups.reduce((n, g) => n + g.entries.length, 0)}</Pill>
        <span className={styles.hint}>rangés par regroupement proposé · atteint et refus calculés depuis leur code</span>
      </div>
      <div className={styles.head} aria-hidden="true">
        <span /><span>point d'entrée · fonction</span><span>déclenché par</span><span>atteint (calculé)</span><span>refus</span><span />
      </div>
      {groups.map((g) => (
        <section key={g.id} className={styles.group}>
          <h3 className={styles.title}>{g.title}<span className={styles.reason}>{g.reason} · {g.entries.length}</span></h3>
          <ul className={styles.rows}>
            {g.entries.map((item) => <FeatureRow key={item.entry.id} item={item} model={model} names={names} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
