import type { ArchModelV2, Entrypoint } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { isUncalled, triggeredBy } from "../../domain/block/entries";
import { RouteMethod, RoutePath } from "../../components/RouteKey";
import { guardLabel } from "../../domain/block/resources";
import { EffectList } from "./EffectList";
import styles from "./RouteRow.module.css";

interface Props {
  entry: Entrypoint;
  model: ArchModelV2;
  names: Map<string, string>;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Une route : sa méthode, son chemin et ses paramètres, la fonction qui répond, qui l'appelle, ce qu'elle fait. */
export function RouteRow({ entry, model, names, selected, onSelect }: Props) {
  const by = triggeredBy(entry, names, model);
  const guard = guardLabel(entry);
  return (
    <li className={`${styles.row} ${selected ? styles.selected : ""}`}>
      <button type="button" className={styles.hit} aria-pressed={selected} aria-label={entry.key} onClick={() => onSelect(entry.id)} />
      <RouteMethod routeKey={entry.key} />
      <span className={styles.route}>
        <RoutePath routeKey={entry.key} />
        {entry.handler ? <span className={styles.handler}>{entry.handler.name}</span>
          : <span className={styles.uncalled} title="Le moteur n'a pas relié cette route à sa fonction : ce qu'elle fait n'est pas rattaché ici.">fonction non reliée</span>}
      </span>
      <span className={styles.caller}>
        {isUncalled(entry, model) ? <span className={styles.uncalled}>aucun appel lu</span> : by.length ? by.join(", ") : <span className={styles.pale}>rien de lu</span>}
        {guard && <span className={styles.guard}>{guard}</span>}
      </span>
      <EffectList entryId={entry.id} model={model} names={names} />
      <ProofRef proof={entry.proof} />
    </li>
  );
}
