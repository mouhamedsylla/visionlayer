import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { MapPayload, SourceExcerpt } from "../../api/types";
import { flowView, type findEntry, type FlowRow } from "../../model/flow";
import { Contract } from "./Contract";
import { Entry } from "../../lang/objects";
import { FlowLanes } from "./FlowLanes";
import { Rep } from "../../lang/Rep";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { Workspace } from "../../ui/Workspace";
import "./flow.css";

/** Le déroulé d'un point d'entrée : F1 (le déroulé), A1 (l'algorithme indexé), A2 (l'aiguillage), du catalogue. */
export function FlowScreen({ map, entryId, found, tab, openTab, back, backLabel, toBlock }: { map: MapPayload; entryId: string; found: ReturnType<typeof findEntry>; tab?: string; openTab: (tab: string) => void; back: () => void; backLabel?: string; toBlock: () => void }) {
  const [pick, setPick] = useState(1);
  if (!found) return <div className="page"><p className="fl__empty">This entry point is no longer on the map ({entryId}).</p></div>;
  const v = flowView(map, found.entry, found.owner);
  const row = v.rows.find((r) => r.n === pick) ?? v.rows[0];
  const http = found.entry.kind === "http" || found.entry.kind === "rpc";
  const current = http && tab === "contrat" ? "contrat" : "deroule";
  return (
    <Workspace panelWidth={460}
      panel={current === "deroule" && <>
        {row && <Indexed row={row} rows={v.rows} />}
        {v.gates.length > 0 && (
            <Rep code="A2" name="Branching" question="When does it refuse, and what does it leave behind?"
              reads="top to bottom: each question is a refusal's condition; yes, the arrow goes right to the refusal and its code; no, the run goes down to the next question.">
              <div className="fl__gates">
                {v.gates.map((g, i) => (
                  <div key={g.n} className="fl__gate">
                    <button className="fl__q" onClick={() => setPick(g.n)}><Rich text={g.question.replace(/^(.*)$/, "`$1`").replace(/^`no condition`$/, "no condition")} /></button>
                    <span className="fl__no"><em>oui</em><i /></span>
                    <span className="vl-tag vl-tag--critical">{g.refusal}{g.leaves.length ? `, after writing ${g.leaves.join(", ")}` : ", before any write"}</span>
                    {i < v.gates.length - 1 && <span className="fl__yes">non</span>}
                  </div>
                ))}
              </div>
            </Rep>
          )}
      </>}
      head={<div className="fl__head">
        <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ {backLabel ?? "Map"}</button>
        <Entry e={found.entry} />
        <span className="fl__sub">{found.entry.handler?.name}, <Ref proof={found.entry.handler ? { path: found.entry.handler.path, line: found.entry.handler.line } : found.entry.proof} /></span>
        {backLabel !== found.owner.name && <button className="vl-btn vl-btn--secondary vl-btn--sm fl__map" onClick={toBlock}>Inside {found.owner.name}</button>}
      </div>}>
        {http && <div className="tabs fl__tabs"><button className={`seg${current === "deroule" ? " seg--on" : ""}`} onClick={() => openTab("deroule")}>Flow <span className="vl-count">{v.rows.length}</span></button><button className={`seg${current === "contrat" ? " seg--on" : ""}`} onClick={() => openTab("contrat")}>Contract</button></div>}
        {current === "contrat" && <Contract entry={found.entry} />}
        {current === "deroule" && <Rep code="F1" name="Flow" question="What does this run do, in what order?" sentence={<Rich text={v.sentence} />} flush
          reads="top to bottom, in order. Each arrow goes from the code to what it touches: thick, it writes; gray, it reads; dotted, it enqueues. Pick a step to see its code.">
          {v.rows.length === 0 ? <p className="fl__empty">No step read: its code calls no storage, queue or service, and refuses nothing a pack can read.</p> : <>
            <FlowLanes v={v} pick={setPick} picked={row?.n} />
          </>}
        </Rep>}
    </Workspace>
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
    <Rep code="A1" name="Indexed algorithm" question="What does this code do, line by line?" flush
      reads="alongside: each step carries a number, and the same number marks its lines in the code.">
      <div className="fl__code">
        {row.step.why && <p className="fl__why">“{row.step.why.text}”</p>}
        {code ? code.lines.map((l, i) => {
          const ln = code.from + i, marks = stepAt.get(ln);
          return <div key={ln} className={ln === p.line ? "hl" : ""}><span className="fl__mk">{marks ? marks.map((m) => <span key={m} className={`lx-step fl__mkstep${m === row.n ? " is-on" : ""}`}>{m}</span>) : null}</span><span className="fl__ln">{ln}</span><span>{l}</span></div>;
        }) : <p className="fl__wait">Reading the code…</p>}
      </div>
    </Rep>
  );
}
