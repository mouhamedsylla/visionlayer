import type { MapPayload, ProjectInfo } from "../api/types";
import { sidebarCounts } from "../model/overview";
import { Icon, Logo } from "./icons";
import { SCREENS, type Screen } from "./route";
import { useVigie } from "../vigie/Vigie";
import "./shell.css";

/** La barre latérale de la planche 01 : logo, projet, recherche, quatre groupes avec leurs compteurs, Vigie, Réglages, la personne. */
export function Sidebar({ project, map, screen, go }: { project?: ProjectInfo; map?: MapPayload; screen: Screen; go: (s: Screen) => void }) {
  const vigie = useVigie();
  const counts = map ? sidebarCounts(map) : {};
  const groups = [...new Set(SCREENS.map((s) => s.group))].filter(Boolean);
  const initials = (project?.user ?? "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <nav className="side" aria-label="Navigation">
      <div className="side__brand">
        {Logo}
        <div className="side__who">
          <span className="side__name">VisionLayer</span>
          <span className="mono side__proj">{project ? `${project.name}${project.branch ? `, ${project.branch}` : ""}` : "…"}</span>
        </div>
        <span className="side__fold" aria-hidden="true">{Icon.side}</span>
      </div>
      <label className="side__search">
        {Icon.search}
        <input placeholder="Rechercher…" aria-label="Rechercher une route, une table, un fichier" />
        <span className="vl-kbd">⌘K</span>
      </label>
      {groups.map((g) => (
        <div key={g} className="side__group">
          <span className="vl-label side__title">{g}</span>
          {SCREENS.filter((s) => s.group === g).map((s) => {
            const c = counts[s.id];
            return (
              <a key={s.id} href={s.built ? `#/${s.id}` : undefined} aria-disabled={!s.built} title={s.built ? undefined : "Écran à venir"}
                className={`vl-nav${screen === s.id ? " vl-nav--active" : ""}${s.built ? "" : " vl-nav--soon"}`}
                onClick={(e) => { e.preventDefault(); if (s.built) go(s.id); }}>
                {Icon[s.id as keyof typeof Icon]}<span>{s.label}</span>
                {c && <span className={`vl-count${c.tone ? ` vl-count--${c.tone}` : ""}`}>{c.n}</span>}
              </a>
            );
          })}
        </div>
      ))}
      <div className="side__foot">
        <a className="side__vigie" href="#" onClick={(e) => { e.preventDefault(); vigie(); }}>
          <span className="side__vigieicon">{Icon.vigie}</span>
          <span className="side__vigietext"><b>Demander à Vigie</b><small>Muse Spark, cite ses preuves</small></span>
          <span className="vl-kbd side__kbd">⌘J</span>
        </a>
        <a href="#/reglages" className={`vl-nav${screen === "reglages" ? " vl-nav--active" : ""}`} onClick={(e) => { e.preventDefault(); go("reglages"); }}>{Icon.reglages}<span>Réglages</span></a>
        {project?.user && (
          <div className="side__user">
            <span className="side__avatar">{initials}</span>
            <span className="side__username">{project.user}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
