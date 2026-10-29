import type { ArchModelV2, Entity, TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Pill } from "../../components/Pill";
import { useWidth } from "../../components/useWidth";
import type { StoreAccess } from "../../domain/data/actors";
import { entityGroups } from "../../domain/data/groups";
import { stateFields } from "../../domain/data/lifecycle";
import { ActorHead } from "./ActorHead";
import { AccessLegend } from "./AccessCell";
import { TableRow } from "./TableRow";
import styles from "./TableGrid.module.css";

interface Props {
  word: string;
  storeId: string;
  entities: Entity[];
  access: StoreAccess;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
  selected?: string;
  onSelect: (name: string) => void;
}

/** Une ligne par table, rangées par section du schéma ; une colonne par acteur ; puis ce que la base contrôle et déclenche. */
export function TableGrid({ word, storeId, entities, access, model, tech, selected, onSelect }: Props) {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const groups = entityGroups(entities);
  const span = access.actors.length + 3;
  const [box, width] = useWidth<HTMLDivElement>();
  // défile de côté seulement quand il ne tient pas : sinon l'en-tête reste collé sous le bandeau
  const slide = width > 0 && (box.current?.firstElementChild?.scrollWidth ?? 0) > width + 1;
  return (
    <div className={styles.wrap}>
      <div className={styles.caption}>
        <Pill>{word} · {entities.length}</Pill>
        <AccessLegend />
      </div>
      <div ref={box} className={`${styles.scroll} ${slide ? styles.slide : ""}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{word.toLowerCase()}</th>
              {access.actors.map((a) => (
                <th key={a.id} title={a.detail && `tâche planifiée, ${a.detail}`}>
                  <ActorHead actor={a} node={nodes.get(a.nodeId)} tech={tech} stacked />
                  {a.detail && <span className={styles.detail}>{a.detail}</span>}
                </th>
              ))}
              <th>contrôle</th>
              <th>déclenche</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => [
              g.title && <tr key={`g-${g.title}`} className={styles.group}><td colSpan={span}>{g.title.toLowerCase()} · {g.entities.length}</td></tr>,
              ...g.entities.map((e) => (
                <TableRow key={e.name} entity={e} entities={entities} actors={access.actors} access={access.byEntity.get(e.name)}
                  cycleHref={stateFields(e).length ? screenHref("donnees", storeId, e.name, "cycle") : undefined}
                  selected={e.name === selected} onSelect={() => onSelect(e.name)} />
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
