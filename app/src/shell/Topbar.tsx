import type { ArchNode, MapPayload, ProjectInfo } from "../api/types";
import type { Crumb } from "./route";
import { Icon } from "./icons";
import { BASE } from "../api/client";

/** La barre du haut de la planche : le fil d'Ariane, la pastille de fraîcheur (date, heure, commit), relancer l'analyse. */
export function Topbar({ project, map, crumbs, back, backLabel, block, clearBlock, refreshing, onRefresh }: { project?: ProjectInfo; map?: MapPayload; crumbs: Crumb[]; back?: () => void; backLabel?: string; block?: ArchNode; clearBlock?: () => void; refreshing: boolean; onRefresh: () => void }) {
  const name = (id: string) => map?.model.nodes.find((n) => n.id === id)?.name ?? id;
  const at = map ? new Date(map.builtAt) : undefined;
  const day = at?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase().replace(/\./g, ".");
  return (
    <header className="top">
      <div className="top__crumbs">
        {back && backLabel && <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ {name(backLabel)}</button>}
        {Icon.side}
        {BASE ? <a className="top__link" href="/" title="Switch project">{project?.name ?? "…"}</a> : <span>{project?.name ?? "…"}</span>}
        {crumbs.map((c, i) => <span key={i} className="top__crumb"><span aria-hidden="true">›</span>{c.back ? <button className="top__link" onClick={() => window.history.go(-c.back)}>{c.node ? name(c.node) : c.label}</button> : <span className={i === crumbs.length - 1 ? "top__here" : ""}>{c.node ? name(c.node) : c.label}</span>}</span>)}
        {block && clearBlock && <button className="top__chip" title="Back to the whole system" onClick={clearBlock}>of the block {block.name} <i>×</i></button>}
      </div>
      <div className="top__right">
        {at && (
          <span className="vl-pill">
            <i className="vl-dot vl-dot--live" />{day}<span className="vl-pill__sep" />
            {at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            {project?.commit && <><span className="vl-pill__sep" />{project.commit}</>}
          </span>
        )}
        <button className="vl-btn vl-btn--secondary top__icon" aria-label="Analyze again" title="Analyze again" disabled={refreshing} onClick={onRefresh}>{Icon.refresh}</button>
        <button className="vl-btn vl-btn--secondary top__icon" aria-label="Comments" title="Comments, coming soon" disabled>{Icon.comment}</button>
      </div>
    </header>
  );
}
