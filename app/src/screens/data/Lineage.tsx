import { useState } from "react";
import type { Lineage as L, LineageEnd } from "../../model/lineage";
import { Rep } from "../../lang/Rep";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

/** F3, la lignée d'un champ (catalogue L2) : à gauche qui l'écrit, au centre le champ, à droite où il va. En rouge, ce qui fuit. */
export function Lineage({ table, list, openFlow }: { table: string; list: L[]; openFlow: (id: string) => void }) {
  const [pick, setPick] = useState(0);
  const l = list[pick] ?? list[0];
  if (!l) return null;
  const rows = Math.max(l.from.length, l.to.length, 1);
  return (
    <Rep code="F3" name="Lignée d'une donnée" question="D'où vient ce champ, où va-t-il ?" sentence={<Rich text={l.sentence} />}
      reads="de gauche à droite : qui l'écrit, le champ, où il va. En rouge, ce qui fuit ; en gris, un service que le déroulé qui lit le champ appelle (que la valeur y parte n'est pas suivi).">
      {list.length > 1 && (
        <div className="ln__pick">
          {list.map((x, i) => <button key={x.field.name} className={`seg${i === pick ? " seg--on" : ""}`} onClick={() => setPick(i)}>{x.field.name}</button>)}
        </div>
      )}
      <div className="ln" style={{ gridTemplateRows: `auto repeat(${rows}, auto)` }}>
        <span className="vl-label">Écrit par</span><span /><span /><span /><span className="vl-label">Va vers</span>
        {l.from.map((x, i) => <End key={x.key} x={x} row={i + 2} col={1} openFlow={openFlow} />)}
        {l.from.map((x, i) => <Arrow key={`a${x.key}`} x={x} row={i + 2} col={2} />)}
        {!l.from.length && <span className="n n--o" style={{ gridRow: 2, gridColumn: 1 }}><b>aucun écrivain lu</b></span>}
        <span className="n n--k ln__mid" style={{ gridRow: `2 / ${rows + 2}`, gridColumn: 3 }}>
          <b>{table}.{l.field.name}</b>
          <small>{l.personal ? "donnée personnelle" : l.field.type ?? "champ"}{l.field.comment ? `, « ${l.field.comment} »` : ""}</small>
        </span>
        {l.to.map((x, i) => <Arrow key={`b${x.key}`} x={x} row={i + 2} col={4} />)}
        {l.to.map((x, i) => <End key={x.key} x={x} row={i + 2} col={5} openFlow={openFlow} />)}
      </div>
      <div className="ln__foot">
        {l.deletes.length
          ? <><span className="pill">effacé : {l.deletes.length} endroit{l.deletes.length > 1 ? "s" : ""}</span>{l.deletes.slice(0, 3).map((d, i) => <span key={i} className="ln__del">{d.fn ? `${d.fn} ` : ""}<Ref proof={d.proof} /></span>)}</>
          : <><span className="pill pill--o">effacé : jamais</span><span className="ln__note">aucune suppression de ligne de {table} dans le code lu</span></>}
        {l.whole > 0 && <span className="ln__note">et lu avec toute sa ligne par {l.whole} autre{l.whole > 1 ? "s" : ""} point{l.whole > 1 ? "s" : ""} d'entrée</span>}
      </div>
    </Rep>
  );
}

function End({ x, row, col, openFlow }: { x: LineageEnd; row: number; col: number; openFlow: (id: string) => void }) {
  const cls = x.tone === "danger" ? "n n--c" : x.tone === "outside" ? "n n--x" : "n";
  const body = <><b>{x.label}</b><small>{x.sub}{x.proof && !x.entry ? <> <Ref proof={x.proof} /></> : null}</small></>;
  return x.entry
    ? <button className={`${cls} ln__end`} style={{ gridRow: row, gridColumn: col }} onClick={() => openFlow(x.entry!)} title="Ouvrir son déroulé">{body}</button>
    : <span className={`${cls} ln__end`} style={{ gridRow: row, gridColumn: col }}>{body}</span>;
}

function Arrow({ x, row, col }: { x: LineageEnd; row: number; col: number }) {
  const cls = x.tone === "danger" ? "a a--c" : x.verb === "écrit" ? "a a--w" : x.tone === "outside" ? "a a--r a--q" : "a a--r";
  return <div className={cls} style={{ gridRow: row, gridColumn: col }}><span>{x.verb}</span><i /></div>;
}
