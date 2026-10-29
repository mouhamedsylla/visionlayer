import type { ArchModelV2 } from "../../api/types";
import { entryNature } from "../../domain/block/entries";
import type { EntryRef } from "../../domain/features/list";
import { traceFailures } from "../../domain/features/trace";
import { doesLabel, whenLabel } from "../../domain/messages/triggers";
import styles from "./TriggerTable.module.css";
import { TechText } from "../../components/TechText";

interface Props {
  entries: EntryRef[];
  model: ArchModelV2;
  names: Map<string, string>;
  selected?: string;
  onSelect: (id: string) => void;
}

/** Les déclencheurs lus dans le code : quand, ce que fait leur code, et ce qui est constaté si ça rate. */
export function TriggerTable({ entries, model, names, selected, onSelect }: Props) {
  return (
    <table className={styles.table}>
      <colgroup><col className={styles.first} /><col className={styles.when} /><col /><col className={styles.fail} /></colgroup>
      <thead><tr><th>déclencheur</th><th>quand</th><th>ce qu'il fait (calculé)</th><th>si ça rate</th></tr></thead>
      <tbody>
        {entries.map((x) => {
          const kinds = [...new Set(traceFailures(x, model).map((f) => f.type))];
          return (
            <tr key={x.entry.id} className={x.entry.id === selected ? styles.on : ""}>
              <td>
                <button type="button" className={styles.name} aria-pressed={x.entry.id === selected} onClick={() => onSelect(x.entry.id)}>
                  {x.entry.handler?.name ?? x.entry.key}
                </button>
                <span className={styles.nature}>{entryNature(x.entry)}</span>
              </td>
              <td className={styles.soft}><TechText text={whenLabel(x.entry, model, names)} /></td>
              <td>{doesLabel(x.entry, names) ? <TechText text={doesLabel(x.entry, names)} /> : <span className={styles.soft}>rien de reconnu dans son code</span>}</td>
              <td>{kinds.length ? kinds.map((k) => <span key={k} className={styles.tag}>{k}</span>) : <span className={styles.soft}>rien de constaté</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
