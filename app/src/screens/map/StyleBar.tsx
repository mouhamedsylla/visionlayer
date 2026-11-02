import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { MapPayload } from "../../api/types";
import { styles, styleSentence } from "../../model/styles";
import { Ref } from "../../ui/Ref";

/** L3 sur la Carte : les styles reconnus, chacun avec sa ligne ; l'humain confirme ou corrige. */
export function StyleBar({ map }: { map: MapPayload }) {
  const list = styles(map);
  const [confirmed, setConfirmed] = useState<string[]>();
  const [picked, setPicked] = useState<Set<string>>(new Set(list.map((s) => s.id)));
  useEffect(() => { api.style().then((r) => { setConfirmed(r.confirmed); if (r.confirmed) setPicked(new Set(r.confirmed)); }).catch(() => {}); }, []);
  if (!list.length) return null;
  const done = !!confirmed;
  const shown = done ? list.filter((s) => confirmed!.includes(s.id)) : list;
  const toggle = (id: string) => setPicked((p) => { const x = new Set(p); x.has(id) ? x.delete(id) : x.add(id); return x; });
  return (
    <section className="mp__style" aria-label="Style d'architecture">
      <div className="mp__stylehead">
        <span className={`vl-tag ${done ? "vl-tag--live" : "vl-tag--signal"}`}>{done ? "Confirmé" : "Proposé, à confirmer"}</span>
        <b>{styleSentence(shown)}</b>
        <span className="mp__styleact">
          {done ? <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => setConfirmed(undefined)}>Corriger</button>
            : <button className="vl-btn vl-btn--primary vl-btn--sm" onClick={() => api.confirmStyle([...picked]).then((r) => setConfirmed(r.confirmed))}>Confirmer</button>}
        </span>
      </div>
      <div className="mp__reasons">
        {(done ? shown : list).map((s) => (
          <label key={s.id} className={`mp__reason${!done && !picked.has(s.id) ? " is-off" : ""}`}>
            <span className="mp__rtop">{!done && <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />}<span className="vl-label">{s.name}</span></span>
            <span className="mp__rtext">{s.reason}</span>
            {s.warn && <span className="mp__rwarn">{s.warn}</span>}
            {s.proof && s.proof.line > 0 && <Ref proof={s.proof} />}
          </label>
        ))}
      </div>
      <p className="mp__rhow">Reconnu aux signes lus dans le code, sans modèle. Le style ne décide que de la place des blocs ; la disposition client-serveur est celle de la carte ci-dessous.</p>
    </section>
  );
}
