import { useLayoutEffect, useRef, useState } from "react";
import type { ArchNode, MapPayload } from "../../api/types";
import { blockView, callCount, COLUMN, entryGroups, type Column, type ModuleCard } from "../../model/block";
import { ROLE } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { EntryRow } from "./EntryRow";
import "./block.css";

const LAYER: Record<string, string> = { entry: "entrée", logic: "logique", data: "données", external: "client externe" };

/** B1, l'intérieur d'un bloc : ses modules par usage, leurs appels, ce qu'ils touchent ; ses points d'entrée, chacun vers son déroulé. */
export function BlockScreen({ map, block, openFlow, back }: { map: MapPayload; block: ArchNode; openFlow: (entryId: string) => void; back: () => void }) {
  const v = blockView(map, block);
  const [chosen, setChosen] = useState<string>();
  const sel = v.modules.find((m) => m.node.id === chosen) ?? v.modules[0];
  return (
    <div className="page">
      <div className="bk__head">
        <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ Carte</button>
        <h1 className="bk__title">{block.name}</h1>
        <span className="bk__sub">{ROLE[block.role]}{block.summary ? `, ${block.summary}` : ""}</span>
      </div>
      <div className="bk__tiles">
        {v.tiles.map((t) => <div key={t.label} className="tile"><small>{t.label}</small><b>{t.value}</b><span>{t.note}</span></div>)}
      </div>
      {v.modules.length > 0 ? (
        <div className="bk__body">
          <Columns v={v} sel={sel} pick={setChosen} />
          {sel && <ModulePanel map={map} m={sel} v={v} openFlow={openFlow} />}
        </div>
      ) : <p className="bk__empty">Ce bloc n'a pas de modules calculés : moins de deux points d'entrée exécutés, ou un code que les packs ne lisent pas encore.</p>}
      <section className="card">
        <div className="hd"><h2>Ses points d'entrée</h2><span>{v.entries.length}, chacun ouvre son déroulé</span></div>
        {entryGroups(v.entries).map((g) => (
          <div key={g.name}>
            <div className="grp">{g.name} <span>{g.entries.length}</span></div>
            {g.entries.map((e) => <EntryRow key={e.id} e={e} open={() => openFlow(e.id)} />)}
          </div>
        ))}
      </section>
    </div>
  );
}

/** Les trois colonnes de modules ; les appels du module choisi tracés d'après la place réelle des cartes. */
function Columns({ v, sel, pick }: { v: ReturnType<typeof blockView>; sel?: ModuleCard; pick: (id: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const [lines, setLines] = useState<{ d: string; key: string; n: number; x: number; y: number }[]>([]);
  const linked = new Set(v.calls.filter((c) => c.from === sel?.node.id || c.to === sel?.node.id).flatMap((c) => [c.from, c.to]));
  useLayoutEffect(() => {
    const root = wrap.current?.getBoundingClientRect();
    if (!root || !sel) { setLines([]); return; }
    const box = (id: string) => { const r = els.current.get(id)?.getBoundingClientRect(); return r ? { x: r.left - root.left, y: r.top - root.top, w: r.width, h: r.height } : undefined; };
    const out: typeof lines = [];
    for (const c of v.calls.filter((x) => x.from === sel.node.id || x.to === sel.node.id)) {
      const a = box(c.from), b = box(c.to);
      if (!a || !b) continue;
      const right = a.x < b.x;
      const x1 = right ? a.x + a.w : a.x, x2 = right ? b.x : b.x + b.w;
      const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
      const mx = (x1 + x2) / 2;
      if (Math.abs(a.x - b.x) < 4) {
        const x = a.x + a.w - 8, ya = a.y < b.y ? a.y + a.h : a.y, yb = a.y < b.y ? b.y : b.y + b.h;
        out.push({ d: `M${x} ${ya} C${x + 30} ${ya} ${x + 30} ${yb} ${x} ${yb}`, key: c.id, n: c.count, x: x + 26, y: (ya + yb) / 2 });
      } else out.push({ d: `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, key: c.id, n: c.count, x: mx, y: (y1 + y2) / 2 });
    }
    setLines(out);
  }, [v, sel?.node.id]);
  return (
    <section className="card bk__cols" ref={wrap}>
      <svg className="bk__svg" aria-hidden="true">
        <defs><marker id="bk-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--ink)" /></marker></defs>
        {lines.map((l) => <g key={l.key}><path d={l.d} markerEnd="url(#bk-arrow)" /><text x={l.x} y={l.y - 4} className="bk__n">{l.n}</text></g>)}
      </svg>
      {(["own", "shared", "base"] as Column[]).map((c) => (
        <div key={c} className="bk__col">
          <div className="bk__colhead"><span className="vl-label">{COLUMN[c].title}</span><small>{COLUMN[c].note}</small></div>
          {v.modules.filter((m) => m.column === c).map((m) => {
            const on = m === sel, far = !!sel && !on && !linked.has(m.node.id);
            const n = sel ? callCount(v.calls, m.node.id, sel.node.id) || callCount(v.calls, sel.node.id, m.node.id) : 0;
            return (
              <button key={m.node.id} ref={(el) => { if (el) els.current.set(m.node.id, el); }} className={`mod${on ? " mod--on" : ""}${far ? " mod--far" : ""}${m.contract ? " mod--contract" : ""}`} onClick={() => pick(m.node.id)}>
                <b className="mod__name">{m.node.name}</b>
                <span className="mod__head">{!on && n > 0 && <span className="mod__calls">{callCount(v.calls, m.node.id, sel!.node.id) ? `appelle ×${n}` : `appelé ×${n}`}</span>}<span className="mod__n">{m.serves} entrée{m.serves > 1 ? "s" : ""} sur {m.of}</span></span>
                <span className="mod__bar">{(["entry", "logic", "data", "external"] as const).map((l) => m.layers[l] ? <i key={l} className={`ly--${l}`} style={{ flex: m.layers[l] }} title={`${m.layers[l]} fichier(s) ${LAYER[l]}`} /> : null)}</span>
                <span className="mod__fx">{m.writes > 0 && <span className="fxw">écrit {m.writes}</span>}{m.reads > 0 && <span className="fxr">lit {m.reads}</span>}{m.contract && <span className="fxc">contrat</span>}</span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="bk__legend"><span><i className="ly--entry" />entrée</span><span><i className="ly--logic" />logique</span><span><i className="ly--data" />données</span><span><i className="ly--external" />client externe</span><span>la barre : les couches de ses fichiers</span></div>
    </section>
  );
}

function ModulePanel({ map, m, v, openFlow }: { map: MapPayload; m: ModuleCard; v: ReturnType<typeof blockView>; openFlow: (id: string) => void }) {
  const c = m.node.facets.component!;
  const callers = v.calls.filter((x) => x.to === m.node.id).map((x) => ({ name: v.modules.find((y) => y.node.id === x.from)?.node.name ?? x.from, n: x.count }));
  const touches = c.touches.filter((t) => t.entity || t.topic);
  const name = (id: string) => map.model.nodes.find((n) => n.id === id)?.name ?? id;
  return (
    <aside className="card bk__panel">
      <div className="hd"><h2>{m.node.name}</h2><span className={`mk ${m.contract ? "mk--k" : "mk--q"}`}>{m.contract ? "contrat lu" : "calculé"}</span></div>
      <p className="bk__line">{m.node.subtitle}</p>
      {touches.length > 0 && <>
        <div className="bk__sec"><span className="vl-label">Ce qu'il touche</span></div>
        <div className="bk__chips">{touches.map((t, i) => <span key={i} className={t.kind === "write" ? "fxw" : "fxr"} title={`${t.count} ligne(s)`}>{t.kind === "write" ? "écrit" : t.kind === "read" ? "lit" : t.kind} {t.entity ?? t.topic}, {name(t.node)}</span>)}</div>
      </>}
      <div className="bk__sec"><span className="vl-label">Sert {m.serves} entrée{m.serves > 1 ? "s" : ""} sur {m.of}</span></div>
      <div className="bk__chips">{m.entries.slice(0, 12).map((e) => <button key={e.id} className="vl-ref" onClick={() => openFlow(e.id)}><b>{e.key}</b></button>)}{m.entries.length > 12 && <span className="q">et {m.entries.length - 12} autres</span>}</div>
      {callers.length > 0 && <>
        <div className="bk__sec"><span className="vl-label">Appelé par</span></div>
        {callers.map((x) => <div key={x.name} className="bk__row"><span>{x.name}</span><span className="mono">{x.n} appel{x.n > 1 ? "s" : ""}</span></div>)}
      </>}
      <div className="bk__sec"><span className="vl-label">Ses fichiers</span></div>
      {(m.node.files ?? []).slice(0, 12).map((f) => (
        <div key={f} className="bk__row"><Ref proof={{ path: f, line: 1 }} /><span className={`lytag ly--${c.layers?.[f] ?? "logic"}`}>{LAYER[c.layers?.[f] ?? "logic"]}</span></div>
      ))}
    </aside>
  );
}
