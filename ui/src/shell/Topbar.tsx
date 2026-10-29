import type { MapPayload, ProjectInfo } from "../api/types";
import { Freshness } from "./Freshness";
import { Icon } from "./icons";
import styles from "./Topbar.module.css";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  refreshing: boolean;
  onRefresh: () => void;
}

/** La barre du haut : le projet ouvert (nom, branche, commit), la fraîcheur de l'analyse, et le bouton qui la relance. */
export function Topbar({ project, map, refreshing, onRefresh }: Props) {
  return (
    <header className={styles.bar}>
      <div className={styles.project}>
        <span className={styles.tile}><Icon name="folder" size={16} /></span>
        <span className={styles.name}>{project.name}</span>
        {project.branch && <span className={styles.segment} title="Branche lue"><Icon name="branch" size={14} />{project.branch}</span>}
        {project.commit && <span className={`${styles.segment} ${styles.mono}`} title="Commit lu">{project.commit}</span>}
      </div>
      <div className={styles.spacer} />
      <Freshness builtAt={map.builtAt} refreshing={refreshing} />
      <button type="button" className={styles.refresh} onClick={onRefresh} disabled={refreshing} aria-label="Mettre à jour l'analyse">
        <span className={refreshing ? styles.spin : undefined}><Icon name="refresh" size={15} /></span>
        <span className={styles.label}>Mettre à jour l'analyse</span>
      </button>
    </header>
  );
}
