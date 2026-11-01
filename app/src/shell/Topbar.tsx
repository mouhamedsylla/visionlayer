import type { MapPayload, ProjectInfo } from "../api/types";
import { Icon } from "./icons";

/** La barre du haut de la planche : le fil d'Ariane, la pastille de fraîcheur (date, heure, commit), relancer l'analyse. */
export function Topbar({ project, map, title, refreshing, onRefresh }: { project?: ProjectInfo; map?: MapPayload; title: string; refreshing: boolean; onRefresh: () => void }) {
  const at = map ? new Date(map.builtAt) : undefined;
  const day = at?.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase().replace(/\./g, ".");
  return (
    <header className="top">
      <div className="top__crumbs">
        {Icon.side}
        <span>{project?.name ?? "…"}</span><span aria-hidden="true">›</span><span className="top__here">{title}</span>
      </div>
      <div className="top__right">
        {at && (
          <span className="vl-pill">
            <i className="vl-dot vl-dot--live" />{day}<span className="vl-pill__sep" />
            {at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            {project?.commit && <><span className="vl-pill__sep" />{project.commit}</>}
          </span>
        )}
        <button className="vl-btn vl-btn--secondary top__icon" aria-label="Analyser de nouveau" title="Analyser de nouveau" disabled={refreshing} onClick={onRefresh}>{Icon.refresh}</button>
        <button className="vl-btn vl-btn--secondary top__icon" aria-label="Commentaires" title="Commentaires, à venir" disabled>{Icon.comment}</button>
      </div>
    </header>
  );
}
