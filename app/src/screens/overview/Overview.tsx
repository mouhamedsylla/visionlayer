import type { Claims } from "../../api/useData";
import type { MapPayload, ProjectInfo } from "../../api/types";
import { greeting, headline, overviewHero, overviewStats } from "../../model/overview";
import { since } from "../../model/words";
import { Icon } from "../../shell/icons";
import type { Screen } from "../../shell/route";
import { HeroCard } from "./HeroCard";
import { StatStrip } from "./StatStrip";
import { CoverageCard } from "./CoverageCard";
import { AttentionCard } from "./AttentionCard";
import { PacksCard } from "./PacksCard";
import "./overview.css";

/** Planche 01, Vue d'ensemble : le salut, la carte noire, le bandeau de faits, la couverture, À savoir, les packs. */
export function Overview({ map, project, claims, go }: { map: MapPayload; project?: ProjectInfo; claims: Claims; go: (s: Screen, item?: string) => void }) {
  const hero = overviewHero(map);
  const line = headline(map);
  return (
    <div className="page">
      <div className="page__head">
        <div className="ov__hello">
          <h1 className="page__title">{greeting(project?.user)}</h1>
          <p className="ov__line">{project?.name ?? map.model.system.name}{line.techs ? ` : ${line.techs}` : ""}. Analyzed {since(map.builtAt)}. <span className="ov__known">{line.known}</span></p>
        </div>
        <div className="ov__actions">
          <button className="vl-btn vl-btn--secondary" disabled title="Filter by deployable: coming soon">All deployables{Icon.down}</button>
          <button className="vl-btn vl-btn--primary" disabled title="Agent settings: coming soon">{Icon.plus}Connect an agent</button>
        </div>
      </div>
      {hero && <HeroCard hero={hero} onMap={(to) => (to ? go(to.screen, to.item) : go("carte"))} />}
      <StatStrip stats={overviewStats(map, claims)} />
      <div className="ov__body">
        <CoverageCard map={map} />
        <div className="ov__side">
          <AttentionCard map={map} go={go} />
          <PacksCard map={map} />
        </div>
      </div>
    </div>
  );
}
