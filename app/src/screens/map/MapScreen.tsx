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
      head={<div className="mp__intro mp__intro--row"><h1 className="page__title">Map</h1><a className="vl-btn vl-btn--secondary vl-btn--sm" href="#/reglages">Link an agent</a></div>}
      panel={chosen && <Panel map={map} {...(knowledge ? { knowledge } : {})} node={chosen} ask={(q) => ask(chosen.id, q)} />}>
      {!running && <section className="vl-card mp__none"><b>0 programs read</b><p>No start script, Dockerfile, page or manifest. Library: not drawn.</p></section>}
      {running && <Rep code="S1" name="Map" question="What is the system made of?" sentence={mapSentence(map)} flush
        reads="left to right: what calls, what runs, what is touched. A queue reads top to bottom, from who enqueues to who consumes. Pick a block to see its links; double-click to enter. Ctrl or ⌘ and the wheel zoom, drag moves.">
        <ZoomPan><MapGridView grid={grid} tech={map.tech} selected={chosen?.id} chosen={chosen} select={select} enter={enter} /></ZoomPan>
        <div className="mp__legend">
          <span className="lg"><span className="a sw"><i /></span>call</span>
          <span className="lg"><span className="a a--w sw"><i /></span>write</span>
          <span className="lg"><span className="a a--r sw"><i /></span>lecture</span>
          <span className="lg"><span className="a a--q sw"><i /></span>queued message</span>
          <span className="lg"><span className="a a--u sw"><i /></span>import, no pack</span>
          <span className="lg"><span className="mk mk--nl">not read</span>no pack for this technology</span>
        </div>
      </Rep>}
      {running && <StyleBar map={map} />}
      {hero && <MapHero hero={hero} onPick={select} />}
    </Workspace>
  );
}
