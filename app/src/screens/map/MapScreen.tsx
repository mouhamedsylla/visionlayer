import type { KnowledgePayload, MapPayload } from "../../api/types";
import type { Question } from "../../model/questions";
import { defaultSelection, mapGrid } from "../../model/map";
import { mapSentence, mapHero } from "../../model/mapText";
import { MapHero } from "./MapHero";
import { MapGridView } from "./MapGridView";
import { Panel } from "./Panel";
import { StyleBar } from "./StyleBar";
import { Rep } from "../../lang/Rep";
import { Workspace } from "../../ui/Workspace";
import { ZoomPan } from "../../ui/ZoomPan";
import "./map.css";

/** Planche 03, Carte : quelles unités s'exécutent, et comment elles communiquent. */
export function MapScreen({ map, knowledge, selected, select, enter, ask }: { map: MapPayload; knowledge?: KnowledgePayload; selected?: string; select: (id: string) => void; enter: (id: string) => void; ask: (block: string, q: Question) => void }) {
  const grid = mapGrid(map);
  const nodes = map.model.nodes.filter((n) => n.level !== "component");
  const chosen = nodes.find((n) => n.id === selected || n.name === selected) ?? nodes.find((n) => n.id === defaultSelection(map));
  const hero = mapHero(map);
  const running = map.model.nodes.some((n) => n.level === "deployable");
  return (
    <Workspace
      head={<div className="mp__intro mp__intro--row"><h1 className="page__title">Carte</h1><a className="vl-btn vl-btn--secondary vl-btn--sm" href="#/reglages">Relier un agent</a></div>}
      panel={chosen && <Panel map={map} {...(knowledge ? { knowledge } : {})} node={chosen} ask={(q) => ask(chosen.id, q)} />}>
      {!running && <section className="vl-card mp__none"><b>0 programme lu</b><p>Aucun script de lancement, Dockerfile, page ou manifeste. Bibliothèque : non représentée.</p></section>}
      {running && <Rep code="S1" name="Carte" question="De quoi le système est-il fait ?" sentence={mapSentence(map)} flush
        reads="de gauche à droite : ce qui appelle, ce qui tourne, ce qui est touché. Une file se lit de haut en bas, de qui y dépose à qui la consomme. Choisir un bloc montre ses liens ; double-clic pour entrer. Ctrl ou ⌘ et la molette zooment, glisser déplace.">
        <ZoomPan><MapGridView grid={grid} tech={map.tech} selected={chosen?.id} chosen={chosen} select={select} enter={enter} /></ZoomPan>
        <div className="mp__legend">
          <span className="lg"><span className="a sw"><i /></span>appel</span>
          <span className="lg"><span className="a a--w sw"><i /></span>écriture</span>
          <span className="lg"><span className="a a--r sw"><i /></span>lecture</span>
          <span className="lg"><span className="a a--q sw"><i /></span>message en file</span>
          <span className="lg"><span className="a a--u sw"><i /></span>import, sans pack</span>
          <span className="lg"><span className="mk mk--nl">non lu</span>sans pack pour cette technologie</span>
        </div>
      </Rep>}
      {running && <StyleBar map={map} />}
      {hero && <MapHero hero={hero} onPick={select} />}
    </Workspace>
  );
}
