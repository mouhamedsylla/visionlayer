import type { Hero } from "../../model/overview";
import { Icon } from "../../shell/icons";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

/** La carte noire de la planche : la phrase et deux gestes à gauche, la liste mono qui la prouve à droite. */
export function HeroCard({ hero, onMap }: { hero: Hero; onMap: () => void }) {
  return (
    <section className="ovh" aria-label={hero.kind === "unread" ? "Technologie non lue" : "Constat"}>
      <div className="ovh__main">
        <span className="vl-tag vl-tag--signal ovh__tag">{hero.tag}</span>
        <h2 className="ovh__title">
          <Rich text={hero.lead} />{hero.code && <><code>{hero.code}</code>.</>}
          {hero.second && <><br />{hero.second}</>}
        </h2>
        {hero.text && <p className="ovh__text"><Rich text={hero.text} /></p>}
        <div className="ovh__actions">
          {hero.kind === "unread" && <a className="vl-btn vl-btn--light" href="#/packs">{Icon.packs}Écrire le pack avec Muse</a>}
          <button className="vl-btn vl-btn--ghost-night" onClick={onMap}>{hero.kind === "unread" ? "Voir ce qui n'est pas lu" : "Voir sur la carte"}</button>
        </div>
      </div>
      <div className="ovh__side">
        <div className="ovh__sidehead"><span className="vl-label vl-label--night">{hero.side.title}</span><span className="mono ovh__note">{hero.side.note}</span></div>
        {hero.side.rows.map((r) => (
          <div key={r.idx} className="ovh__row">
            <span className="mono ovh__idx">{r.idx}</span>
            <div className="ovh__what"><code>{r.code}</code>{r.proof ? <Ref proof={r.proof} className="ovh__ref" /> : <span>{r.what}</span>}</div>
            <span className="vl-tag vl-tag--night">{r.tag}</span>
          </div>
        ))}
        {hero.side.more && <span className="ovh__more">{hero.side.more}</span>}
      </div>
    </section>
  );
}
