import { Obj } from "../../ui/open";
import { useState } from "react";
import type { FlowRow, flowView } from "../../model/flow";
import { txRuns } from "../../model/flow";
import { Effect, Frame, Moment, Step } from "../../lang/marks";

/**
 * Les couloirs de F1 (le déroulé) : les colonnes, puis les étapes groupées en moments. Les étapes d'une même
 * transaction sont entourées du cadre de cohérence (L1) ; une lecture qu'un constat met en cause est en rouge.
 * Le même dessin sert au Déroulé et à la vue d'une table.
 */
export function FlowLanes({ v, pick, picked }: { v: ReturnType<typeof flowView>; pick?: (n: number) => void; picked?: number }) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const n = v.cols.length;
  return <>
    <div className="fl__cols" style={{ gridTemplateColumns: `minmax(220px, 1.1fr) repeat(${n}, minmax(64px, 1fr))` }}>
      <span className="vl-label">Étape</span>
      {v.cols.map((c) => <span key={c.id} className={`fl__col fl__col--${c.kind}`}><b>{c.name}</b><small>{c.sub}</small></span>)}
    </div>
    {frames(v.moments).map((g, gi) => {
      const body = g.segments.map((seg) => {
        const key = `${seg.mi}:${seg.title}`;
        const open = !closed.has(key);
        const rows = open ? seg.rows.map((r) => <StepRow key={r.n} r={r} n={n} on={r.n === picked} pick={() => pick?.(r.n)} />) : null;
        return seg.head
          ? <Moment key={`${key}:h`} title={seg.title} count={seg.count} open={open} toggle={() => setClosed((x) => { const y = new Set(x); y.has(key) ? y.delete(key) : y.add(key); return y; })}>{rows}</Moment>
          : <div key={`${key}:${seg.rows[0]?.n}`}>{rows}</div>;
      });
      return g.tx ? <Frame key={gi} className="fl__tx" label={`Transaction, ${g.tx.path.split("/").pop()}:${g.tx.from}`}>{body}</Frame> : <div key={gi}>{body}</div>;
    })}
  </>;
}

/**
 * Les cadres de transaction par-dessus les moments : chaque moment est coupé là où une transaction commence ou
 * finit, puis les morceaux d'une même transaction se suivent dans un seul cadre. L'en-tête d'un moment reste sur son premier morceau.
 */
function frames(moments: ReturnType<typeof flowView>["moments"]) {
  type Seg = { mi: number; title: string; count: number; head: boolean; rows: FlowRow[]; tx?: FlowRow["step"]["tx"] };
  const segs: Seg[] = moments.flatMap((m, mi) => txRuns(m.rows).map((run, i) => ({ mi, title: m.title, count: m.rows.length, head: i === 0, rows: run.rows, ...(run.tx ? { tx: run.tx } : {}) })));
  const key = (t?: FlowRow["step"]["tx"]) => (t ? `${t.path}:${t.from}` : "");
  const out: { tx?: FlowRow["step"]["tx"]; segments: Seg[] }[] = [];
  for (const sg of segs) {
    const last = out[out.length - 1];
    if (last && key(last.tx) === key(sg.tx)) last.segments.push(sg);
    else out.push({ ...(sg.tx ? { tx: sg.tx } : {}), segments: [sg] });
  }
  return out;
}

export function StepRow({ r, n, on, pick }: { r: FlowRow; n: number; on: boolean; pick: () => void }) {
  const x = (k: number) => `${((k + 0.5) / n) * 100}%`;
  const s = r.step;
  return (
    <button className={`fl__row${on ? " is-on" : ""}`} style={{ gridTemplateColumns: `minmax(220px, 1.1fr) minmax(0, ${n}fr)` }} onClick={pick}>
      <span className="fl__label" style={{ paddingLeft: s.depth * 12 }}>
        <Step n={r.n} tone={r.tone === "refuse" ? "refuse" : r.tone === "effect" || r.tone === "reply" ? undefined : "quiet"} />
        <span className="fl__what">
          {r.tone === "effect" ? <Obj to={s.target?.entity ? { entity: s.target.entity, node: s.target.node } : s.target?.topic ? { topic: s.target.topic, node: s.target.node } : s.target ? { service: s.target.node } : undefined}><Effect kind={s.kind as "write"} what={r.what} /></Obj>
            : r.tone === "refuse" ? <Effect kind="refuse" what={[s.status, s.code ?? s.name].filter(Boolean).join(" ")} />
            : r.tone === "invoke" ? <span className="fl__inv">appelle <code>{s.name}()</code></span>
            : r.tone === "reply" ? <span className="fl__inv">répond <code>{[s.status, s.name].filter(Boolean).join(" ")}</code></span>
            : <span className="fl__inv">s'arrête</span>}
          {s.when && <small>si <code>{s.when}</code></small>}
          {s.onError && <small>quand l'appel juste avant échoue</small>}
        </span>
      </span>
      <span className="fl__lanes">
        {Array.from({ length: n }, (_, k) => <i key={k} className="fl__life" style={{ left: x(k) }} />)}
        {r.to !== undefined ? <span className={`fl__arrow fl__arrow--${s.kind}${r.to < r.from ? " fl__arrow--back" : ""}${r.danger ? " fl__arrow--danger" : ""}`} style={{ left: x(Math.min(r.from, r.to)), width: `${(Math.abs(r.to - r.from) / n) * 100}%` }} />
          : <span className={`fl__dot fl__dot--${r.tone}`} style={{ left: x(r.from) }} />}
      </span>
    </button>
  );
}

