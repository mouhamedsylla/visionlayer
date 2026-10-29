import type { Entity } from "../../api/types";
import type { Access, Actor } from "../../domain/data/actors";
import { controlsOf, writtenByTriggers } from "../../domain/data/controls";
import { Icon } from "../../shell/icons";
import { AccessCell } from "./AccessCell";
import styles from "./TableRow.module.css";

interface Props {
  entity: Entity;
  entities: Entity[];
  actors: Actor[];
  access?: Map<string, Access>;
  /** L'adresse de son cycle de vie, quand un champ en porte un. */
  cycleHref?: string;
  selected: boolean;
  onSelect: () => void;
}

/** Une table de la grille : son nom, une case par acteur, ses contrôles, ce qu'elle déclenche. */
export function TableRow({ entity, entities, actors, access, cycleHref, selected, onSelect }: Props) {
  const controls = controlsOf(entity);
  const byTrigger = writtenByTriggers(entity, entities);
  return (
    <tr className={`${styles.row} ${selected ? styles.selected : ""}`} onClick={onSelect}>
      <td>
        <span className={styles.nameCell}>
          <button type="button" className={styles.name} aria-pressed={selected}>{entity.name}</button>
          {cycleHref && (
            <a className={styles.cycle} href={cycleHref} onClick={(ev) => ev.stopPropagation()} title={`Le cycle de vie de ${entity.name}`}>
              <Icon name="state" size={12} />cycle
            </a>
          )}
        </span>
      </td>
      {actors.map((a) => <td key={a.id}><AccessCell access={access?.get(a.id)} /></td>)}
      <td>
        {controls.length
          ? <span className={styles.lines}>{controls.map((c) => <span key={c.proof.line} title={`${c.proof.path}:${c.proof.line}`}>:{c.proof.line}</span>)}</span>
          : <span className={styles.none}>aucun</span>}
      </td>
      <td>
        <span className={styles.triggers}>
          {(entity.triggers ?? []).map((t) => <span key={t.name} className={styles.trigger}><Icon name="trigger" size={12} />{t.name}</span>)}
          {byTrigger.map(({ trigger }) => <span key={trigger.name} className={styles.muted}>écrite par {trigger.name}</span>)}
        </span>
      </td>
    </tr>
  );
}
