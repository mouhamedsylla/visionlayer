import type { Entrypoint } from "../../api/types";
import { Ref } from "../../ui/Ref";

/** Planche 09, onglet Contrat d'une route : middlewares, corps de la requête, réponses. Tout vient du code ; le reste est dit non lu. */
export function Contract({ entry }: { entry: Entrypoint }) {
  const c = entry.contract;
  const flow = (entry.flow ?? []).filter((s) => (s.kind === "reply" || s.kind === "refuse") && (s.status || s.kind === "reply"));
  const seen = new Set<string>();
  const responses = [
    ...flow.map((s) => ({ code: s.status ?? "200", origin: s.when ? `handler, si ${s.when}` : "handler", proof: s.proof })),
    ...(c?.chain ?? []).flatMap((m) => m.statuses.map((x) => ({ code: x.code, origin: m.name, proof: x.proof }))),
  ].filter((r) => { const k = `${r.code}\0${r.origin}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.code.localeCompare(b.code));
  const unread = (c?.chain ?? []).filter((m) => !m.def).map((m) => m.name);
  return (
    <section className="card">
      <div className="hd"><h2>Middlewares</h2><span>{c?.chain.length ?? 0}</span></div>
      <div className="ct__chain">
        {(c?.chain ?? []).map((m, i) => <span key={i} className="ct__nd"><code>{m.name}</code><Ref proof={m.def ?? m.proof} /></span>)}
        <span className="ct__nd ct__nd--h"><code>{entry.handler?.name && entry.handler.name !== "fonction anonyme" ? entry.handler.name : "handler"}</code>{entry.handler && <Ref proof={{ path: entry.handler.path, line: entry.handler.line }} />}</span>
      </div>
      <div className="ct__two">
        <div>
          <div className="hd"><h2>Corps de la requête</h2><span className="mono">{c?.input ? c.input.schema : ""}</span></div>
          {c?.input?.fields.length ? <>
            <div className="ct__f ct__h"><span>Champ</span><span>Type</span><span>Requis</span></div>
            {c.input.fields.map((f) => <div key={f.name} className="ct__f"><code>{f.name}</code><code>{f.type}</code><span>{f.required ? "oui" : "non"}</span></div>)}
          </> : <p className="foot"><span className="mk mk--nl">non lu</span> {c?.input ? `champs de ${c.input.schema}` : "aucun schéma lu"}</p>}
        </div>
        <div>
          <div className="hd"><h2>Réponses</h2><span>{responses.length}</span></div>
          <div className="ct__r ct__h"><span>Code</span><span>Origine</span><span>Ligne</span></div>
          {responses.map((r, i) => <div key={i} className="ct__r"><span className={`ct__st${/^[45]/.test(r.code) ? " ct__st--r" : ""}`}>{r.code}</span><span className="ct__o">{r.origin}</span><Ref proof={r.proof} /></div>)}
          <div className="ct__r"><span className="mk mk--nl">non lu</span><span className="ct__o">{["schéma du corps de réponse", ...unread.map((n) => `réponses de ${n}`)].join(", ")}</span><span /></div>
        </div>
      </div>
    </section>
  );
}
