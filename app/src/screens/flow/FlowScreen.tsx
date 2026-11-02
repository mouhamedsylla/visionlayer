import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { MapPayload, SourceExcerpt } from "../../api/types";
import { flowView, type findEntry, type FlowRow } from "../../model/flow";
import { Entry } from "../../lang/objects";
import { Effect, Moment, Step } from "../../lang/marks";
import { Rep } from "../../lang/Rep";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import "./flow.css";

/** Le déroulé d'un point d'entrée : F1 (le déroulé), A1 (l'algorithme indexé), A2 (l'aiguillage), du catalogue. */
export function FlowScreen({ map, entryId, found, back, toBlock }: { map: MapPayload; entryId: string; found: ReturnType<typeof findEntry>; back: () => void; toBlock: () => void }) {
  const [pick, setPick] = useState(1);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  if (!found) return <div className="page"><p className="fl__empty">Ce point d'entrée n'est plus sur la carte ({entryId}).</p></div>;
  const v = flowView(map, found.entry, found.owner);
  const row = v.rows.find((r) => r.n === pick) ?? v.rows[0];
  const n = v.cols.length;
  return (
    <div className="page">
      <div className="fl__head">
        <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={toBlock}>‹ {found.owner.name}</button>
        <Entry e={found.entry} />
        <span className="fl__sub">{found.entry.handler?.name}, <Ref proof={found.entry.handler ? { path: found.entry.handler.path, line: found.entry.handler.line } : found.entry.proof} /></span>
        <button className="vl-btn vl-btn--secondary vl-btn--sm fl__map" onClick={back}>Carte</button>
      </div>
      <div className="fl__body">
        <Rep code="F1" name="Déroulé" question="Que fait cette exécution, dans quel ordre ?" sentence={<Rich text={v.sentence} />} flush
          reads="de haut en bas, dans l'ordre. Chaque flèche part du code vers ce qu'il touche : épaisse, il écrit ; grise, il lit ; pointillée, il met en file. Choisir une étape montre son code.">
          {v.rows.length === 0 ? <p className="fl__empty">Aucune étape lue : son code n'appelle ni stockage, ni file, ni service, et ne refuse rien qu'un pack sache lire.</p> : <>
            <div className="fl__cols" style={{ gridTemplateColumns: `minmax(220px, 1.1fr) repeat(${n}, minmax(64px, 1fr))` }}>
              <span className="vl-label">Étape</span>
              {v.cols.map((c) => <span key={c.id} className={`fl__col fl__col--${c.kind}`}><b>{c.name}</b><small>{c.sub}</small></span>)}
            </div>
            {v.moments.map((m, mi) => {
              const key = `${mi}:${m.title}`;
              return (
                <Moment key={key} title={m.title} count={m.rows.length} open={!closed.has(key)} toggle={() => setClosed((s) => { const x = new Set(s); x.has(key) ? x.delete(key) : x.add(key); return x; })}>
                  {m.rows.map((r) => <StepRow key={r.n} r={r} n={n} on={r.n === row?.n} pick={() => setPick(r.n)} />)}
                </Moment>
              );
            })}
          </>}
        </Rep>
        <div className="fl__side">
          {row && <Indexed row={row} rows={v.rows} />}
          {v.gates.length > 0 && (
            <Rep code="A2" name="Aiguillage" question="Quand refuse-t-il, et que laisse-t-il ?" sentence={`${v.gates.length} façon${v.gates.length > 1 ? "s" : ""} de refuser.`}
              reads="de haut en bas : chaque question est la condition d'un refus ; oui, la flèche part à droite vers le refus et son code ; non, l'exécution descend à la question suivante.">
              <div className="fl__gates">
                {v.gates.map((g, i) => (
                  <div key={g.n} className="fl__gate">
                    <button className="fl__q" onClick={() => setPick(g.n)}><Rich text={g.question.replace(/^(.*)$/, "`$1`").replace(/^`sans condition`$/, "sans condition")} /></button>
                    <span className="fl__no"><em>oui</em><i /></span>
                    <span className="vl-tag vl-tag--critical">{g.refusal}{g.leaves.length ? `, après avoir écrit ${g.leaves.join(", ")}` : ", avant toute écriture"}</span>
                    {i < v.gates.length - 1 && <span className="fl__yes">non</span>}
                  </div>
                ))}
              </div>
            </Rep>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({ r, n, on, pick }: { r: FlowRow; n: number; on: boolean; pick: () => void }) {
  const x = (k: number) => `${((k + 0.5) / n) * 100}%`;
  const s = r.step;
  return (
    <button className={`fl__row${on ? " is-on" : ""}`} style={{ gridTemplateColumns: `minmax(220px, 1.1fr) minmax(0, ${n}fr)` }} onClick={pick}>
      <span className="fl__label" style={{ paddingLeft: s.depth * 12 }}>
        <Step n={r.n} tone={r.tone === "refuse" ? "refuse" : r.tone === "effect" || r.tone === "reply" ? undefined : "quiet"} />
        <span className="fl__what">
          {r.tone === "effect" ? <Effect kind={s.kind as "write"} what={r.what} />
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
        {r.to !== undefined ? <span className={`fl__arrow fl__arrow--${s.kind}${r.to < r.from ? " fl__arrow--back" : ""}`} style={{ left: x(Math.min(r.from, r.to)), width: `${(Math.abs(r.to - r.from) / n) * 100}%` }} />
          : <span className={`fl__dot fl__dot--${r.tone}`} style={{ left: x(r.from) }} />}
      </span>
    </button>
  );
}

/** A1, l'algorithme indexé : le code du fichier de l'étape, les numéros des étapes dans la marge, l'étape choisie surlignée. */
function Indexed({ row, rows }: { row: FlowRow; rows: FlowRow[] }) {
  const [code, setCode] = useState<SourceExcerpt>();
  const p = row.step.proof;
  const here = rows.filter((r) => r.step.proof.path === p.path);
  const from = Math.max(1, Math.min(...here.map((r) => r.step.proof.line), p.line) - 2), to = Math.max(...here.map((r) => r.step.proof.line), p.line) + 2;
  useEffect(() => { setCode(undefined); api.source(p.path, from, Math.min(to, from + 79)).then(setCode).catch(() => {}); }, [p.path, from, to]);
  const stepAt = new Map<number, number[]>();
  for (const r of here) stepAt.set(r.step.proof.line, [...(stepAt.get(r.step.proof.line) ?? []), r.n]);
  return (
    <Rep code="A1" name="Algorithme indexé" question="Que fait ce code, ligne par ligne ?" sentence={<>Étape {row.n} choisie, dans <code>{p.path.split("/").slice(-2).join("/")}</code>.</>} flush
      reads="en face : chaque étape porte un numéro, et le même numéro marque ses lignes dans le code.">
      <div className="fl__code">
        {row.step.why && <p className="fl__why">« {row.step.why.text} »</p>}
        {code ? code.lines.map((l, i) => {
          const ln = code.from + i, marks = stepAt.get(ln);
          return <div key={ln} className={ln === p.line ? "hl" : ""}><span className="fl__mk">{marks ? marks.map((m) => <span key={m} className={`lx-step fl__mkstep${m === row.n ? " is-on" : ""}`}>{m}</span>) : null}</span><span className="fl__ln">{ln}</span><span>{l}</span></div>;
        }) : <p className="fl__wait">Lecture du code…</p>}
      </div>
    </Rep>
  );
}
