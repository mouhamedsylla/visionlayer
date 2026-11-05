import type { MapPayload } from "../../api/types";

/** Packs chargés, comme sur la planche : un pack par puce, puis chaque technologie employée qu'aucun pack ne lit, en orange. */
export function PacksCard({ map }: { map: MapPayload }) {
  const missing = map.model.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "pack_missing").map((g) => g.subject);
  return (
    <section className="vl-card" aria-label="What VisionLayer reads">
      <div className="vl-card__head">
        <span className="vl-label">Loaded packs</span>
        <span className="mono ov__packcount">{map.packs.length}{missing.length ? ` + ${missing.length} manquant${missing.length > 1 ? "s" : ""}` : ""}</span>
      </div>
      <div className="vl-card__body ov__packs">
        {map.packs.map((p) => <span key={p} className="vl-ref ov__pack"><b>{p}</b></span>)}
        {missing.map((m) => <span key={m} className="vl-ref vl-ref--declared ov__missing"><b>{m}</b><span>not read</span></span>)}
      </div>
    </section>
  );
}
