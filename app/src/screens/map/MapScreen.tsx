import type { MapPayload } from "../../api/types";
import { defaultSelection, mapGrid } from "../../model/map";
import { mapSentence, mapHero } from "../../model/mapText";
import { MapHero } from "./MapHero";
import { MapGridView } from "./MapGridView";
import { Panel } from "./Panel";
import { StyleBar } from "./StyleBar";
import { Rep } from "../../lang/Rep";
import { Workspace } from "../../ui/Workspace";
import "./map.css";

/** Planche 03, Carte : quelles unités s'exécutent, et comment elles communiquent. */
export function MapScreen({ map, selected, select, enter, openFlow, openData }: { map: MapPayload; selected?: string; select: (id: string) => void; enter: (id: string) => void; openFlow: (id: string) => void; openData: (id: string) => void }) {
  const grid = mapGrid(map);
  const nodes = map.model.nodes.filter((n) => n.level !== "component");
  const chosen = nodes.find((n) => n.id === selected || n.name === selected) ?? nodes.find((n) => n.id === defaultSelection(map));
  const hero = mapHero(map);
  return (
    <Workspace
      head={<div className="mp__intro"><h1 className="page__title">Carte</h1><p className="mp__sentence">Quelles unités s'exécutent, et comment elles communiquent.</p></div>}
      panel={chosen && <Panel map={map} node={chosen} links={grid.links} select={select} enter={enter} openFlow={openFlow} openData={openData} />}>
      {hero && <MapHero hero={hero} onPick={select} />}
      <StyleBar map={map} />
      <Rep code="S1" name="Carte" question="De quoi le système est-il fait ?" sentence={mapSentence(map)} flush
        reads="de gauche à droite : ce qui appelle, ce qui tourne, ce qui est touché. Une file se lit de haut en bas, de qui y dépose à qui la consomme. Choisir un bloc montre ses liens ; double-clic pour entrer.">
        <MapGridView grid={grid} tech={map.tech} selected={chosen?.id} chosen={chosen} select={select} enter={enter} />
        <div className="mp__legend">
          <span className="lg"><span className="a sw"><i /></span>appel</span>
          <span className="lg"><span className="a a--w sw"><i /></span>écriture</span>
          <span className="lg"><span className="a a--r sw"><i /></span>lecture</span>
          <span className="lg"><span className="a a--q sw"><i /></span>message en file</span>
          <span className="lg"><span className="a a--u sw"><i /></span>import, sans pack</span>
          <span className="lg"><span className="mk mk--nl">non lu</span>sans pack pour cette technologie</span>
        </div>
      </Rep>
    </Workspace>
  );
}
