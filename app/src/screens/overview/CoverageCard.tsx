import { useState } from "react";
import type { MapPayload } from "../../api/types";
import { coverage, shortName, TILE_LABEL, type Tile } from "../../model/overview";

const CLS = { i: "vl-tile", q: "vl-tile vl-tile--quiet", s: "vl-tile vl-tile--signal", c: "vl-tile vl-tile--critical" } as const;

/** La grille de couverture de la planche : une colonne par dossier, deux cases de front, la case choisie sur fond nuit. */
export function CoverageCard({ map }: { map: MapPayload }) {
  const grid = coverage(map);
  const [tip, setTip] = useState<Tile | undefined>(grid.first);
  return (
    <section className="vl-card ov__cov" aria-label="Couverture par fichier">
      <div className="vl-card__head ov__covhead">
        <span className="vl-label">Couverture par fichier</span>
        <div className="vl-legend"><span><i />Lu</span><span><i className="q" />Sans fait</span><span><i className="s" />À surveiller</span><span><i className="c" />Constat</span></div>
      </div>
      <div className="ov__covlead">
        <p><span className="ov__covbig">{grid.understood}</span> <span className="ov__muted">de {grid.total} fichiers lus entièrement</span></p>
        <p className="ov__covhow"><b>Se lit</b> par colonne : un dossier, une case par fichier.</p>
      </div>
      <div className="ov__covgrid">
        <div className="ov__folders">
          {grid.folders.map((d) => (
            <div key={d.name} className="ov__folder">
              <div className="ov__tiles" style={{ gridTemplateColumns: `repeat(${Math.max(2, Math.ceil(d.tiles.length / 14))}, 20px)` }}>
                {d.tiles.map((t) => (
                  <button key={t.path} className={`${CLS[t.state]}${tip?.path === t.path ? " vl-tile--focus" : ""}`} aria-label={`${t.path}, ${TILE_LABEL[t.state]}`}
                    onMouseEnter={() => setTip(t)} onFocus={() => setTip(t)} />
                ))}
              </div>
              <span className="mono ov__fname" title={d.name}>{shortName(d.name)}</span>
              <span className="mono ov__fcount">{d.tiles.length}</span>
            </div>
          ))}
        </div>
        {tip && (
          <div className="ov__tip">
            <span className="mono ov__tiplabel">CASE CHOISIE</span>
            <span className="ov__tiptext"><span><code className="mono">{tip.path}</code><span className="ov__tipstate">, {TILE_LABEL[tip.state]}</span></span><span className="ov__tipwhat">{tip.what}</span></span>
          </div>
        )}
      </div>
      <div className="vl-card__foot ov__covfoot">
        <span>{map.packs.length} packs actifs{grid.biggest ? `, plus grand dossier : ${grid.biggest.name}, ${grid.biggest.tiles.length} fichiers` : ""}</span>
      </div>
    </section>
  );
}
