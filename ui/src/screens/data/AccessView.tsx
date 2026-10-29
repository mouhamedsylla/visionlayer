import type { ArchModelV2, Entity } from "../../api/types";
import { TableAccessList } from "./TableAccessList";
import type { StoreAccess } from "../../domain/data/actors";
import { TableVerdict } from "./TableVerdict";
import styles from "./CycleView.module.css";

interface Props {
  entity: Entity;
  access: StoreAccess;
  model: ArchModelV2;
}

/** Les accès d'une entité : ce que le code montre, puis chaque ligne qui la lit ou l'écrit et le point d'entrée qui l'atteint. */
export function AccessView({ entity, access, model }: Props) {
  return (
    <div className={styles.view}>
      <TableVerdict entity={entity} access={access} model={model} />
      <TableAccessList actors={access.actors} access={access.byEntity.get(entity.name) ?? new Map()} model={model} />
    </div>
  );
}
