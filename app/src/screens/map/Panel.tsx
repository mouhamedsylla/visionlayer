import type { ArchNode, EdgeKind, MapPayload } from "../../api/types";
import { countLabel, type MapLink } from "../../model/map";
import { isUnread, sentence } from "../../model/overview";
import { ROLE } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

const OUT: Record<EdgeKind, string> = { call: "appelle", request: "appelle", read: "lit", write: "écrit", message: "met en file", trigger: "déclenche", use: "importe", deploy: "déploie" };
const IN: Record<EdgeKind, string> = { call: "appelé par", request: "appelé par", read: "lue par", write: "écrite par", message: "reçoit de", trigger: "déclenché par", use: "importé par", deploy: "déployé par" };

/** Le panneau « Bloc choisi » de la planche : nom, phrase, origine ; ses liens avec leur verbe, leur compte, une preuve ; ses constats. */
export function Panel({ map, node, links, select, enter, openFlow }: { map: MapPayload; node: ArchNode; links: MapLink[]; select: (id: string) => void; enter: (id: string) => void; openFlow: (id: string) => void }) {
  const name = (id: string) => map.model.nodes.find((n) => n.id === id)?.name ?? id;
  const mine = links.filter((l) => l.from === node.id || l.to === node.id).sort((a, b) => b.count - a.count);
  const findings = map.model.findings.filter((f) => f.nodes?.includes(node.id));
  const kind = `${ROLE[node.role]}${node.instances && node.instances.min > 1 ? ` ×${node.instances.min}` : ""}`;
  const line = node.summary ? node.summary.replace(/^./, (c) => c.toUpperCase()) + "." : isUnread(node) ? `${node.subtitle}. Aucun pack ne lit sa technologie : la carte ne dit rien de ce que son code fait.` : "";
  return (
    <aside className="vl-card mp__panel" aria-label="Bloc choisi">
      <div className="vl-card__head"><span className="vl-label">Bloc choisi</span><span className="mono mp__kind">{kind}</span></div>
      <div className="mp__pintro">
        <p className="mp__pname">{node.name}</p>
        {line && <p className="mp__pline">{line}</p>}
        {node.proof[0] && node.proof[0].line > 0 && <Ref proof={node.proof[0]} className="mp__pref" />}
        {(node.facets.entrypoints?.length ?? 0) > 1 && <button className="vl-btn vl-btn--primary mp__enter" onClick={() => enter(node.id)}>Entrer dans {node.name}</button>}
      </div>
      {(node.facets.entrypoints ?? []).filter((e) => e.kind !== "main").length > 0 && <>
        <div className="mp__psec mp__psec--row"><span className="vl-label">Points d'entrée</span><span className="mono mp__kind">{(node.facets.entrypoints ?? []).filter((e) => e.kind !== "main").length}</span></div>
        {(node.facets.entrypoints ?? []).filter((e) => e.kind !== "main").slice(0, 8).map((e) => (
          <button key={e.id} className="mp__pentry" onClick={() => openFlow(e.id)}><code>{e.key}</code><span>{e.flow?.length ? `${e.flow.length} étapes ›` : "›"}</span></button>
        ))}
        {(node.facets.entrypoints ?? []).length > 9 && <button className="mp__pmore" onClick={() => enter(node.id)}>Tous ses points d'entrée ›</button>}
      </>}
      <div className="mp__psec"><span className="vl-label">Liens</span></div>
      {mine.length === 0 && <p className="mp__pempty">Aucun lien lu.</p>}
      {mine.map((l) => {
        const out = l.from === node.id;
        const other = out ? l.to : l.from;
        const what = l.entities.length ? `${l.entities.length > 1 ? `${l.entities.length} ${l.kind === "message" ? "files" : "tables"}` : l.entities[0]} de ${name(other)}` : name(other);
        return (
          <div key={l.id} className="mp__plink">
            <span className="mp__pwhat"><span className={`fx${l.kind === "write" ? " fx--w" : ""}`}>{out ? OUT[l.kind] : IN[l.kind]}</span> <button className="mp__pother" onClick={() => select(other)}>{what}</button></span>
            <span className="mono mp__pcount">{l.kind === "trigger" ? "" : l.count}</span>
            {l.first && l.first.line > 0 && <Ref proof={l.first} className="mp__plref" />}
          </div>
        );
      })}
      <div className="mp__psec mp__psec--row"><span className="vl-label">Constats</span><span className="mono mp__kind">{findings.length}</span></div>
      {findings.length === 0 && <p className="mp__pempty">Aucun constat sur ce bloc.</p>}
      {findings.slice(0, 6).map((f, i) => (
        <div key={i} className="mp__pfact">
          <span className="mp__pplus">!</span>
          <div className="mp__pfactbody"><p className="mp__pfacttext"><Rich text={sentence(f.message)} /></p><Ref proof={f.proof[0]!} /></div>
        </div>
      ))}
      {mine.length > 0 && <p className="mp__pempty">{countLabel(mine[0]!.kind, mine[0]!.count)} au plus fort, vers {name(mine[0]!.from === node.id ? mine[0]!.to : mine[0]!.from)}.</p>}
    </aside>
  );
}
