import type { Stat } from "../../model/overview";

/** Le bandeau de faits de la planche : cinq cartes, chacune avec son nombre, sa petite forme et sa note. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="ov__stats">
      {stats.map((s) => (
        <div key={s.label} className="vl-stat">
          <span className="vl-label">{s.label}</span>
          <div className="vl-stat__row">
            <span className="vl-stat__value">{s.value}{s.unit && <span className="vl-stat__unit">{s.unit}</span>}</span>
            {s.mini.kind === "tiles"
              ? <span className="vl-mini" aria-hidden="true">{s.mini.cells.map((c, i) => <i key={i} className={c} />)}</span>
              : <span className="vl-bars" aria-hidden="true">{s.mini.bars.map((b, i) => <i key={i} className={b.cls} style={{ height: `${b.height}%` }} />)}</span>}
          </div>
          <span className="vl-stat__note">{s.note}</span>
        </div>
      ))}
    </div>
  );
}
