import type { ArchNode, MapPayload, ProjectInfo } from "../api/types";
import type { Crumb } from "./route";
import { Icon } from "./icons";
import { BASE } from "../api/client";

/** La barre du haut de la planche : le fil d'Ariane, la pastille de fraîcheur (date, heure, commit), relancer l'analyse. */
export function Topbar({ project, map, crumbs, back, backLabel, block, clearBlock, refreshing, onRefresh }: { project?: ProjectInfo; map?: MapPayload; crumbs: Crumb[]; back?: () => void; backLabel?: string; block?: ArchNode; clearBlock?: () => void; refreshing: boolean; onRefresh: () => void }) {
  const name = (id: string) => map?.model.nodes.find((n) => n.id === id)?.name ?? id;
  const at = map ? new Date(map.builtAt) : undefined;
  const day = at?.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).toUpperCase().replace(/\./g, ".");
  return (
    <header className="top">
      <div className="top__crumbs">
        {back && backLabel && <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ {name(backLabel)}</button>}
        {Icon.side}
        {BASE ? <a className="top__link" href="/" title="Changer de projet">{project?.name ?? "…"}</a> : <span>{project?.name ?? "…"}</span>}
        {crumbs.map((c, i) => <span key={i} className="top__crumb"><span aria-hidden="true">›</span>{c.back ? <button className="top__link" onClick={() => window.history.go(-c.back)}>{c.node ? name(c.node) : c.label}</button> : <span className={i === crumbs.length - 1 ? "top__here" : ""}>{c.node ? name(c.node) : c.label}</span>}</span>)}
        {block && clearBlock && <button className="top__chip" title="Revenir à tout le système" onClick={clearBlock}>du bloc {block.name} <i>×</i></button>}
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
