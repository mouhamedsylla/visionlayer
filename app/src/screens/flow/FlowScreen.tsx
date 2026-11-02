import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { MapPayload, SourceExcerpt } from "../../api/types";
import { flowView, type FlowRow } from "../../model/flow";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import "./flow.css";

/** Le déroulé d'un point d'entrée (B4, F1) : ce que son code fait, dans l'ordre, et vers quoi ; le code de l'étape choisie à côté. */
export function FlowScreen({ map, entryId, found, back, toBlock }: { map: MapPayload; entryId: string; found: ReturnType<typeof import("../../model/flow").findEntry>; back: () => void; toBlock: () => void }) {
  const [pick, setPick] = useState(0);
  if (!found) return <div className="page"><p className="fl__empty">Ce point d'entrée n'est plus sur la carte ({entryId}).</p></div>;
  const v = flowView(map, found.entry, found.owner);
  const row = v.rows[pick] ?? v.rows[0];
  const n = v.columns.length;
  return (
    <div className="page">
      <div className="fl__head">
        <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={toBlock}>‹ {found.owner.name}</button>
        <h1 className="fl__title">{found.entry.key}</h1>
        <span className="fl__sub">{found.entry.handler?.name ? `${found.entry.handler.name}, ` : ""}<Ref proof={found.entry.handler ? { path: found.entry.handler.path, line: found.entry.handler.line } : found.entry.proof} />, {v.rows.length} étapes lues</span>
        <button className="vl-btn vl-btn--ghost fl__map" onClick={back}>Carte</button>
      </div>
      <div className="fl__tiles">{v.tiles.map((t) => <div key={t.label} className="tile"><small>{t.label}</small><b>{t.value}</b><span>{t.note}</span></div>)}</div>
      <div className="fl__body">
        <section className="card fl__seq">
          {v.rows.length === 0 ? <p className="fl__empty">Aucune étape lue dans son code : il n'appelle ni stockage, ni file, ni service, et ne refuse rien qu'un pack sache lire.</p> : <>
            <div className="fl__cols" style={{ gridTemplateColumns: `260px repeat(${n}, minmax(0, 1fr))` }}>
              <span className="vl-label">Étape</span>
              {v.columns.map((c) => <span key={c.id} className="fl__col"><b>{c.name}</b><small>{c.sub}</small></span>)}
            </div>
            {v.rows.map((r, i) => <Step key={i} r={r} i={i} n={n} on={i === pick} pick={() => setPick(i)} />)}
          </>}
        </section>
        {row && <CodePanel row={row} />}
      </div>
    </div>
  );
}

function Step({ r, i, n, on, pick }: { r: FlowRow; i: number; n: number; on: boolean; pick: () => void }) {
  const col = (k: number) => `${((k + 0.5) / n) * 100}%`;
  return (
    <button className={`fl__row fl__row--${r.tone}${on ? " fl__row--on" : ""}`} style={{ gridTemplateColumns: `260px minmax(0, 1fr)` }} onClick={pick}>
      <span className="fl__label" style={{ paddingLeft: r.step.depth * 14 }}>
        <span className="fl__num">{i + 1}</span>
        <span><Rich text={r.label} />{r.step.when && <small>si {r.step.when}</small>}{r.step.onError && <small>quand l'appel juste avant échoue</small>}</span>
      </span>
      <span className="fl__lanes">
        {Array.from({ length: n }, (_, k) => <i key={k} className="fl__life" style={{ left: col(k) }} />)}
        {r.target !== undefined && r.target > 0 && <span className={`fl__arrow fl__arrow--${r.step.kind}`} style={{ left: col(0), width: `${(r.target / n) * 100}%` }} />}
        {r.target === undefined && <span className={`fl__dot fl__dot--${r.tone}`} style={{ left: col(0) }} />}
      </span>
    </button>
  );
}

function CodePanel({ row }: { row: FlowRow }) {
  const [code, setCode] = useState<SourceExcerpt>();
  const p = row.step.proof;
  useEffect(() => { setCode(undefined); api.source(p.path, Math.max(1, p.line - 6), p.line + 8).then(setCode).catch(() => {}); }, [p.path, p.line]);
  return (
    <aside className="fl__panel">
      <section className="night">
        <span className="lbl">Étape choisie</span>
        <h2><Rich text={row.label} /></h2>
        {row.step.when && <p className="sub">si <code>{row.step.when}</code></p>}
        {row.step.why && <p className="fl__why">« {row.step.why.text} »</p>}
        <span className="lbl">{p.path}</span>
        {code ? <div className="ed">{code.lines.map((l, i) => <div key={i} className={code.from + i === p.line ? "hl" : ""}><span>{code.from + i}</span><span>{l}</span></div>)}</div> : <p className="sub">Lecture du code…</p>}
      </section>
    </aside>
  );
}
