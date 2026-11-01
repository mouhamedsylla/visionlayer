import type { MapHeroData } from "../../model/mapText";

/** La carte noire de la planche 03 : la phrase et ses gestes à gauche, la différence en lignes chiffrées à droite. */
export function MapHero({ hero, onPick }: { hero: MapHeroData; onPick: (id: string) => void }) {
  return (
    <section className="mph" aria-label={hero.side}>
      <div className="mph__main">
        <span className="vl-tag vl-tag--night mph__tag">{hero.tag}</span>
        <h2 className="mph__title">{hero.title}</h2>
        <p className="mph__text">{hero.text}</p>
      </div>
      <div className="mph__side">
        <span className="vl-label vl-label--night mph__sidetitle">{hero.side}</span>
        {hero.rows.map((r, i) => (
          <button key={i} className="mph__row" onClick={() => r.node && onPick(r.node)} disabled={!r.node}>
            <span className={`mph__value mph__value--${r.tone ?? "plus"}`}>{r.value}</span>
            <span className="mph__label">{r.label}<span className="mph__note">{r.note}</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}
