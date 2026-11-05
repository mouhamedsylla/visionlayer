import { Obj } from "../../ui/open";
import { useState, type CSSProperties } from "react";
import type { ArchNode, MapPayload } from "../../api/types";
import { blockView, COLUMN, entryGroups, focusSentence, focusView, offered, type Column, type FocusLink, type ModuleCard } from "../../model/block";
import { Rep } from "../../lang/Rep";
import { Component } from "../../lang/objects";
import { Arrow, Effect } from "../../lang/marks";
import { ROLE } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { useOpenCode } from "../../ui/code";
import { Workspace } from "../../ui/Workspace";
import "./block.css";

const LAYER: Record<string, string> = { entry: "entry", logic: "logique", data: "data", external: "client externe" };
const GRID: Record<Column, number> = { own: 1, shared: 3, base: 5 };

/** L'intérieur d'un bloc : S2 (sa composition, centrée sur un module), S3 (ce que ce module offre) ; le panneau dit le module et mène aux déroulés. */
export function BlockScreen({ map, block, openFlow, back, backLabel }: { map: MapPayload; block: ArchNode; openFlow: (entryId: string) => void; back: () => void; backLabel?: string }) {
  const v = blockView(map, block);
  // Par défaut, comme la planche : le module qui s'appuie sur le plus d'autres, d'où la descente se lit jusqu'au socle.
  const uses = (m: ModuleCard) => new Set(v.calls.filter((c) => c.from === m.node.id).map((c) => c.to)).size;
  const [chosen, setChosen] = useState<string>(() => [...v.modules].sort((a, b) => uses(b) - uses(a) || b.serves - a.serves)[0]?.node.id ?? "");
  const sel = v.modules.find((m) => m.node.id === chosen) ?? v.modules[0];
  return (
    <Workspace panelWidth={400}
      head={<>
        <div className="bk__head">
          <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ {backLabel ?? "Map"}</button>
          <h1 className="bk__title">{block.name}</h1>
          <span className="bk__sub">{ROLE[block.role]}{block.summary ? `, ${block.summary}` : ""}</span>
        </div>
      </>}
      panel={<>
        {sel && <ModulePanel map={map} m={sel} openFlow={openFlow} />}
        <Entries v={v} openFlow={openFlow} />
      </>}>
      <div className="bk__tiles">
        {v.tiles.map((t) => <div key={t.label} className="tile"><small>{t.label}</small><b>{t.value}</b><span>{t.note}</span></div>)}
      </div>
      {sel ? <>
        <Rep code="S2" name="Inside a block" question="How is this deployable composed?" sentence={<Rich text={focusSentence(sel, focusView(v, sel))} />}
          reads="left to right: calls go right, each arrow carries the function called. In one column, the call goes down the line. Dotted: a computed module; solid: a contract read from the code. Pick a module to center it and fade the others.">
          <Focus v={v} sel={sel} pick={setChosen} />
        </Rep>
        <Offered block={block} m={sel} openFlow={openFlow} />
      </> : <p className="bk__empty">This block has no computed modules: fewer than two entry points run, or code the packs don't read yet.</p>}
    </Workspace>
  );
}

/** Ce qu'une carte de module dit sous son nom : sa route s'il est propre à une seule, sinon combien d'entrées il sert. */
const under = (m: ModuleCard) => m.serves === 1 && m.entries[0] ? m.entries[0].key : `${m.serves} entr${m.serves > 1 ? "ies" : "y"}`;

function Card({ m, on, far, pick }: { m: ModuleCard; on?: boolean; far?: boolean; pick: (id: string) => void }) {
  return <Component name={m.node.name} contract={m.contract} on={on} far={far} onClick={() => pick(m.node.id)}><small className="bk__under">{under(m)}</small></Component>;
}

/** S2, le dessin : une grille à cinq colonnes (propres, flèches, partagés, flèches, socle), comme la planche. */
function Focus({ v, sel, pick }: { v: ReturnType<typeof blockView>; sel: ModuleCard; pick: (id: string) => void }) {
  const f = focusView(v, sel);
  const c = GRID[sel.column];
  const leftItems = [...f.left.map((x) => ({ ...x, back: false })), ...f.back.filter((x) => f.col(x.m) < f.col(sel)).map((x) => ({ ...x, back: true }))];
  const rightItems = [...f.right.map((x) => ({ ...x, back: false })), ...f.back.filter((x) => f.col(x.m) > f.col(sel)).map((x) => ({ ...x, back: true }))];
  const top = 2 + (f.above.length ? 1 : 0);
  const span = Math.max(1, leftItems.length, rightItems.length);
  const below = top + span + (f.below.length ? 1 : 0);
  const at = (col: number, row: number, rows = 1): CSSProperties => ({ gridColumn: col, gridRow: `${row} / span ${rows}` });
  const gap = (a: number, b: number, row: number): CSSProperties => ({ gridColumn: `${Math.min(a, b) + 1} / ${Math.max(a, b)}`, gridRow: row });
  return (
    <div className="bk__grid">
      {(["own", "shared", "base"] as Column[]).map((k) => (
        <span key={k} className="bk__lane" style={at(GRID[k], 1)}>{COLUMN[k].title}<small>{v.modules.filter((m) => m.column === k).length}</small></span>
      ))}
      {f.above.length > 0 && <Tree items={f.above} pick={pick} into style={at(c, 2)} />}
      <div className="bk__sel" style={at(c, top, span)}><Card m={sel} on pick={pick} /></div>
      {leftItems.map((x, i) => [
        <div key={x.m.node.id} className="bk__cell" style={at(GRID[x.m.column], top + i)}><Card m={x.m} pick={pick} /></div>,
        <div key={`${x.m.node.id}>`} className="bk__cell" style={gap(GRID[x.m.column], c, top + i)}><Arrow label={x.label} back={x.back} /></div>,
      ])}
      {rightItems.map((x, i) => [
        <div key={`<${x.m.node.id}`} className="bk__cell" style={gap(c, GRID[x.m.column], top + i)}><Arrow label={x.label} back={x.back} /></div>,
        <div key={x.m.node.id} className="bk__cell" style={at(GRID[x.m.column], top + i)}><Card m={x.m} pick={pick} /></div>,
      ])}
      {f.below.length > 0 && <Tree items={f.below} pick={pick} style={at(c, top + span)} />}
      {f.rest.length > 0 && <span className="bk__restlbl" style={{ gridColumn: "1 / -1", gridRow: below + 1 }}>No call with {sel.node.name}</span>}
      {(["own", "shared", "base"] as Column[]).map((k) => {
        const list = f.rest.filter((m) => m.column === k);
        return list.length ? <div key={k} className="bk__rest" style={at(GRID[k], below + 2)}>{list.map((m) => <Card key={m.node.id} m={m} far pick={pick} />)}</div> : null;
      })}
    </div>
  );
}

/** Les appels dans la même colonne : un tronc depuis le module choisi (ou vers lui), une branche par module, la fonction sur la branche. */
function Tree({ items, pick, into, style }: { items: FocusLink[]; pick: (id: string) => void; into?: boolean; style: CSSProperties }) {
  return (
    <div className={`bk__tree${into ? " bk__tree--into" : ""}`} style={style}>
      {items.map((x) => (
        <div key={x.m.node.id} className="bk__branch">
          <span className="bk__twig">{x.label}</span>
          <Card m={x.m} pick={pick} />
        </div>
      ))}
    </div>
  );
}

/** S3, les fonctions offertes par le module choisi. */
function Offered({ block, m, openFlow }: { block: ArchNode; m: ModuleCard; openFlow: (id: string) => void }) {
  const open = useOpenCode();
  const list = offered(block, m.node);
  const max = Math.max(1, ...list.map((x) => x.callers));
  return (
    <Rep code="S3" name="Functions offered" question="What does this module provide, and to whom?" flush
      sentence={list[0] && list[0].callers > 0 ? <><code>{m.node.name}</code> mostly serves <code>{list[0].fn.name}</code> : {list[0].callers} line{list[0].callers > 1 ? "s" : ""} call it.</> : list.some((x) => x.route) ? <><code>{m.node.name}</code> carries {list.filter((x) => x.route).length} function{list.filter((x) => x.route).length > 1 ? "s" : ""} called, each through its route.</>
        : <><code>{m.node.name}</code> offers no function called elsewhere.</>}
      reads="top to bottom, from most called to least called. A name opens its code.">
      <table className="bk__fns">
        <thead><tr><th>Function</th><th>Called by</th><th>Effect</th></tr></thead>
        <tbody>
          {list.slice(0, 12).map((x) => (
            <tr key={x.fn.id}>
              <td><button className="bk__fn" onClick={() => open(x.fn.proof)}>{x.fn.name}</button></td>
              <td>{x.callers > 0 ? <span className="bk__callers"><i style={{ width: `${Math.max(4, (x.callers / max) * 96)}px` }} />{x.callers} line{x.callers > 1 ? "s" : ""}</span>
                : x.route ? <button className="bk__route" onClick={() => openFlow(x.route!.id)}>the route <code>{x.route.key}</code> ›</button> : <span className="q">no line read</span>}</td>
              <td><span className="bk__fx">{x.effects.slice(0, 3).map((e, i) => <Obj key={i} to={e.kind === "message" ? { topic: e.what } : e.kind === "read" || e.kind === "write" ? { entity: e.what } : { service: e.what }}><Effect kind={e.kind} what={e.what} /></Obj>)}{!x.effects.length && <span className="q">none</span>}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length > 12 && <p className="bk__more">and {list.length - 12} more</p>}
    </Rep>
  );
}

/** Le panneau : le module choisi, ce qu'il touche, les entrées qu'il sert (chacune vers son déroulé), ses fichiers. */
function ModulePanel({ map, m, openFlow }: { map: MapPayload; m: ModuleCard; openFlow: (id: string) => void }) {
  const c = m.node.facets.component!;
  const touches = c.touches.filter((t) => t.entity || t.topic);
  const name = (id: string) => map.model.nodes.find((n) => n.id === id)?.name ?? id;
  return (
    <section className="bk__panel">
      <div className="bk__ptags"><span className="vl-tag vl-tag--neutral">{m.column === "own" ? "module propre" : m.column === "shared" ? "shared module" : "socle"}</span><span className="vl-tag vl-tag--neutral">{m.contract ? "contract read" : "computed"}</span></div>
      <p className="bk__pname">{m.node.name}</p>
      {m.node.subtitle && <p className="bk__pline">{m.node.subtitle}</p>}
      {touches.length > 0 && <>
        <div className="bk__sec"><span className="vl-label">Data access</span></div>
        <div className="bk__chips">{touches.map((t, i) => <Obj key={i} to={t.entity ? { entity: t.entity, node: t.node } : t.topic ? { topic: t.topic, node: t.node } : undefined}><Effect kind={t.kind} what={`${t.entity ?? t.topic}, ${name(t.node)}`} /></Obj>)}</div>
      </>}
      <div className="bk__sec"><span className="vl-label">Serves {m.serves} entr{m.serves > 1 ? "ies" : "y"} out of {m.of}</span></div>
      {m.entries.slice(0, 8).map((e) => <button key={e.id} className="bk__pentry" onClick={() => openFlow(e.id)}><code>{e.key}</code><span>{e.flow?.length ? `${e.flow.length} steps ›` : "›"}</span></button>)}
      {m.entries.length > 8 && <p className="bk__more">and {m.entries.length - 8} more, below</p>}
      <div className="bk__sec"><span className="vl-label">Its files</span></div>
      {(m.node.files ?? []).slice(0, 10).map((f) => (
        <div key={f} className="bk__row"><Ref proof={{ path: f, line: 1 }} /><span className="bk__layer">{LAYER[c.layers?.[f] ?? "logic"]}</span></div>
      ))}
      {(m.node.files?.length ?? 0) > 10 && <p className="bk__more">and {(m.node.files?.length ?? 0) - 10} more</p>}
    </section>
  );
}

/** Tous les points d'entrée du bloc, rangés par ressource ; chacun ouvre son déroulé. */
function Entries({ v, openFlow }: { v: ReturnType<typeof blockView>; openFlow: (id: string) => void }) {
  return (
    <section className="bk__panel">
      <div className="bk__sec bk__sec--row"><span className="vl-label">Block entry points</span><span className="mono">{v.entries.length}</span></div>
      {entryGroups(v.entries).map((g) => (
        <div key={g.name}>
          <div className="bk__grp">{g.name}<span>{g.entries.length}</span></div>
          {g.entries.map((e) => <button key={e.id} className="bk__pentry" onClick={() => openFlow(e.id)}><code>{e.key}</code><span>{e.flow?.length ? `${e.flow.length} steps ›` : "›"}</span></button>)}
        </div>
      ))}
    </section>
  );
}
