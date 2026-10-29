import type { ArchNode, TechLabel } from "../../api/types";
import { TechLogo } from "../../components/TechLogo";
import type { Actor } from "../../domain/data/actors";
import { primaryTechId } from "../../domain/architecture/describe";
import { Icon } from "../../shell/icons";
import styles from "./ActorHead.module.css";

interface Props {
  actor: Actor;
  node?: ArchNode;
  tech: Record<string, TechLabel>;
  /** La marque au-dessus du nom, pour un en-tête de colonne étroit. */
  stacked?: boolean;
}

/** Un acteur nommé avec sa marque : le logo de son bloc, ou une horloge pour une tâche planifiée. */
export function ActorHead({ actor, node, tech, stacked = false }: Props) {
  const techId = node && primaryTechId(node, tech);
  return (
    <span className={`${styles.head} ${stacked ? styles.stacked : ""}`}>
      {actor.detail
        ? <span className={styles.clock}><Icon name="clock" size={13} /></span>
        : techId ? <TechLogo id={techId} label={tech[techId]} size={13} bare /> : null}
      <span>{actor.label}</span>
    </span>
  );
}
