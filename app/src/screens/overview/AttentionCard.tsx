import { useState } from "react";
import type { MapPayload } from "../../api/types";
import { attention } from "../../model/overview";
import type { Screen } from "../../shell/route";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

/** À savoir, comme sur la planche : une icône dans son cercle, le titre, la sous-ligne avec sa preuve, une action. */
export function AttentionCard({ map, go }: { map: MapPayload; go: (screen: Screen, item?: string) => void }) {
  const list = attention(map);
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 5);
  const watch = list.filter((a) => a.tone === "signal").length;
  return (
    <section className="vl-card" aria-label="À savoir">
      <div className="vl-card__head">
        <span className="vl-label">À savoir <span className="vl-count vl-count--critical">{list.length}</span></span>
        {list.length > 5 && <button className="vl-link ov__linkbtn" onClick={() => setAll(!all)}>{all ? "Replier ›" : "Tout voir ›"}</button>}
      </div>
      {shown.length === 0 && <p className="ov__empty">Aucun point sur ce qui est lu.</p>}
      {shown.map((a, i) => (
        <div key={i} className="vl-att">
          <span className={`vl-att__icon vl-att__icon--${a.tone}`}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={a.icon} /></svg></span>
          <div className="ov__atttext">
            <p className="vl-att__title"><Rich text={a.title} /></p>
            <p className="vl-att__sub">{a.sub && <><Rich text={a.sub} />, </>}<Ref proof={a.proof} /></p>
          </div>
          <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => go(a.go.screen, a.go.item)}>{a.action}</button>
        </div>
      ))}
      <div className="vl-card__foot"><span>{watch} à surveiller</span>{!all && list.length > 5 && <button className="vl-link ov__linkbtn" onClick={() => setAll(true)}>Voir les {list.length - 5} autres ›</button>}</div>
    </section>
  );
}
