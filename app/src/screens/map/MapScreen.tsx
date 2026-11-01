import type { MapPayload } from "../../api/types";
import { defaultSelection, mapGrid } from "../../model/map";
import { mapSentence, mapHero } from "../../model/mapText";
import { MapHero } from "./MapHero";
import { MapGridView } from "./MapGridView";
import { Panel } from "./Panel";
import "./map.css";

/** Planche 03, Carte : quelles unités s'exécutent, et comment elles communiquent. */
export function MapScreen({ map, selected, select }: { map: MapPayload; selected?: string; select: (id: string) => void }) {
  const grid = mapGrid(map);
  const nodes = map.model.nodes.filter((n) => n.level !== "component");
  const chosen = nodes.find((n) => n.id === selected || n.name === selected) ?? nodes.find((n) => n.id === defaultSelection(map));
  const hero = mapHero(map);
  return (
    <div className="page">
      <div className="page__head">
        <div className="mp__intro">
          <div className="mp__titlerow"><h1 className="page__title">Carte</h1></div>
          <p className="mp__sentence">{mapSentence(map)}</p>
        </div>
      </div>
      {hero && <MapHero hero={hero} onPick={select} />}
      <div className="mp__body">
        <section className="vl-card mp__card" aria-label="La carte">
          <div className="vl-card__head">
            <span className="vl-label">Carte de {map.model.system.name}</span>
            <span className="mp__hint">Choisir un bloc montre ses liens</span>
          </div>
          <p className="mp__howto"><b>Se lit :</b> de gauche à droite, de ce qui appelle à ce qui est touché. Une file se lit de haut en bas, de qui y dépose à qui la consomme.</p>
          <MapGridView grid={grid} tech={map.tech} selected={chosen?.id} chosen={chosen} select={select} />
          <div className="vl-card__foot mp__legend">
            <span className="lg"><span className="a sw"><i /></span>appel</span>
            <span className="lg"><span className="a a--w sw"><i /></span>écriture</span>
            <span className="lg"><span className="a a--r sw"><i /></span>lecture</span>
            <span className="lg"><span className="a a--q sw"><i /></span>message en file</span>
            <span className="lg"><span className="a a--u sw"><i /></span>import, sans pack</span>
            <span className="lg"><span className="mk mk--nl">non lu</span>sans pack pour cette technologie</span>
          </div>
        </section>
        {chosen && <Panel map={map} node={chosen} links={grid.links} select={select} />}
      </div>
    </div>
  );
}
