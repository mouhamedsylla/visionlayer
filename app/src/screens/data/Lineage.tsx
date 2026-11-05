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
    <Rep code="F3" name="Data lineage" question="Where does this field come from, where does it go?" sentence={<Rich text={l.sentence} />}
      reads="left to right: who writes it, the field, where it goes. In red, what leaks; in gray, a service called by the flow reading the field (whether the value goes there isn't tracked).">
      {list.length > 1 && (
        <div className="ln__pick">
          {list.map((x, i) => <button key={x.field.name} className={`seg${i === pick ? " seg--on" : ""}`} onClick={() => setPick(i)}>{x.field.name}</button>)}
        </div>
      )}
      <div className="ln" style={{ gridTemplateRows: `auto repeat(${rows}, auto)` }}>
        <span className="vl-label">Written by</span><span /><span /><span /><span className="vl-label">Goes to</span>
        {l.from.map((x, i) => <End key={x.key} x={x} row={i + 2} col={1} openFlow={openFlow} />)}
        {l.from.map((x, i) => <Arrow key={`a${x.key}`} x={x} row={i + 2} col={2} />)}
        {!l.from.length && <span className="n n--o" style={{ gridRow: 2, gridColumn: 1 }}><b>no writer read</b></span>}
        <span className="n n--k ln__mid" style={{ gridRow: `2 / ${rows + 2}`, gridColumn: 3 }}>
          <b>{table}.{l.field.name}</b>
          <small>{l.personal ? "personal data" : l.field.type ?? "field"}{l.field.comment ? `, “${l.field.comment}”` : ""}</small>
        </span>
        {l.to.map((x, i) => <Arrow key={`b${x.key}`} x={x} row={i + 2} col={4} />)}
        {l.to.map((x, i) => <End key={x.key} x={x} row={i + 2} col={5} openFlow={openFlow} />)}
      </div>
      <div className="ln__foot">
        {l.deletes.length
          ? <><span className="pill">erased: {l.deletes.length} endroit{l.deletes.length > 1 ? "s" : ""}</span>{l.deletes.slice(0, 3).map((d, i) => <span key={i} className="ln__del">{d.fn ? `${d.fn} ` : ""}<Ref proof={d.proof} /></span>)}</>
          : <><span className="pill pill--o">erased: never</span><span className="ln__note">no row deletion of {table} in the code read</span></>}
        {l.whole > 0 && <span className="ln__note">and read with its whole row by {l.whole} other entry point{l.whole > 1 ? "s" : ""}</span>}
      </div>
    </Rep>
  );
}

function End({ x, row, col, openFlow }: { x: LineageEnd; row: number; col: number; openFlow: (id: string) => void }) {
  const cls = x.tone === "danger" ? "n n--c" : x.tone === "outside" ? "n n--x" : "n";
  const body = <><b>{x.label}</b><small>{x.sub}{x.proof && !x.entry ? <> <Ref proof={x.proof} /></> : null}</small></>;
  return x.entry
    ? <button className={`${cls} ln__end`} style={{ gridRow: row, gridColumn: col }} onClick={() => openFlow(x.entry!)} title="Open its flow">{body}</button>
    : <span className={`${cls} ln__end`} style={{ gridRow: row, gridColumn: col }}>{body}</span>;
}

function Arrow({ x, row, col }: { x: LineageEnd; row: number; col: number }) {
  const cls = x.tone === "danger" ? "a a--c" : x.verb === "writes" ? "a a--w" : x.tone === "outside" ? "a a--r a--q" : "a a--r";
  return <div className={cls} style={{ gridRow: row, gridColumn: col }}><span>{x.verb}</span><i /></div>;
}
