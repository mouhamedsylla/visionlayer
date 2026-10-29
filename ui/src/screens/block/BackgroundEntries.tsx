import type { ArchModelV2, Entrypoint } from "../../api/types";
import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import { entryNature, triggeredBy } from "../../domain/block/entries";
import { EffectList } from "./EffectList";
import styles from "./BackgroundEntries.module.css";

interface Props {
  entries: Entrypoint[];
  model: ArchModelV2;
  names: Map<string, string>;
  selected?: string;
  onSelect: (id: string) => void;
}

/** Ce qui tourne sans qu'une personne clique : tâches planifiées, files écoutées, et les autres points d'entrée. */
export function BackgroundEntries({ entries, model, names, selected, onSelect }: Props) {
  if (!entries.length) return null;
  return (
    <section className={styles.section}>
      <Pill>Tourne sans clic · {entries.length}</Pill>
      <ul className={styles.grid}>
        {entries.map((e) => (
          <li key={e.id} className={`${styles.card} ${e.id === selected ? styles.selected : ""}`}>
            <button type="button" className={styles.hit} aria-pressed={e.id === selected} aria-label={e.handler?.name ?? e.key} onClick={() => onSelect(e.id)} />
            <span className={styles.nature}>{entryNature(e)}</span>
            <b className={styles.when}>{triggeredBy(e, names, model).join(", ") || e.key}</b>
            <span className={styles.handler}>{e.handler ? e.handler.name : <span className={styles.missing}>fonction non reliée</span>}{e.kind === "message" ? ` · file ${e.key}` : ""}</span>
            <EffectList entryId={e.id} model={model} names={names} />
            <ProofRef proof={e.proof} />
          </li>
        ))}
      </ul>
    </section>
  );
}
