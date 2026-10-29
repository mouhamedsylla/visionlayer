import type { ArchModelV2 } from "../../api/types";
import type { Resource } from "../../domain/block/resources";
import { count, joinWords } from "../../domain/text/plural";
import { Icon } from "../../shell/icons";
import { RouteRow } from "./RouteRow";
import styles from "./ResourceCard.module.css";

interface Props {
  resource: Resource;
  model: ArchModelV2;
  names: Map<string, string>;
  selected?: string;
  onSelect: (id: string) => void;
}

/** Une ressource de l'API : son chemin, ce que ses routes touchent ensemble, puis chaque route. */
export function ResourceCard({ resource, model, names, selected, onSelect }: Props) {
  const r = resource;
  return (
    <section className={styles.card} aria-label={r.path}>
      <header className={styles.head}>
        <div className={styles.title}>
          <h3>{r.path}</h3>
          <span>{count(r.entries.length, "route", "routes")}</span>
        </div>
        <div className={styles.touch}>
          {r.reads.length > 0 && <span><Icon name="read" size={12} />lit {joinWords(r.reads)}</span>}
          {r.writes.length > 0 && <span className={styles.write}><Icon name="write" size={12} />écrit {joinWords(r.writes)}</span>}
          {r.queues.length > 0 && <span>met en file {joinWords(r.queues)}</span>}
          {r.calls.length > 0 && <span>appelle {joinWords(r.calls)}</span>}
          {!r.reads.length && !r.writes.length && !r.queues.length && !r.calls.length && <span className={styles.pale}>ne touche aucune donnée</span>}
        </div>
      </header>
      <ul className={styles.rows}>
        {r.entries.map((e) => <RouteRow key={e.id} entry={e} model={model} names={names} selected={e.id === selected} onSelect={onSelect} />)}
      </ul>
    </section>
  );
}
