import type { MapPayload } from "../../api/types";
import { processes, type ProcStage, type ProcStep, type Process, type TriggerKind } from "../../model/process";
import { Entry, State } from "../../lang/objects";
import { Rep } from "../../lang/Rep";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { chainRuns } from "../../model/features";
import { Fragment } from "react";
import { Links } from "../features/FeaturesScreen";
import "../features/features.css";
import "./process.css";

const WHO: Record<TriggerKind, string> = { client: "client", external: "external service", clock: "clock", queue: "queue", none: "not read" };

function Chain({ step }: { step: ProcStep }) {
  if (!step.chain.length) return <span className="ft-r__empty">no effect read</span>;
  return <span className="ft-r__chain">{chainRuns(step.chain).map((run, i) => (
    <Fragment key={i}>{i > 0 && <i className="ft-ar" />}{run.tx ? <span className="ft-tx"><small>transaction</small><Links links={run.links} /></span> : <Links links={run.links} />}</Fragment>
  ))}</span>;
}

function Step({ step, openFlow }: { step: ProcStep; openFlow: (id: string) => void }) {
  const e = step.entry;
  return (
    <div className="pc-step">
      <span className={`pc-who pc-who--${step.trigger.kind}`}><small>{WHO[step.trigger.kind]}</small><b>{step.trigger.label}</b></span>
      <i className="ft-ar pc-step__ar" />
      <div className={`pc-card${e ? " is-link" : ""}`} onClick={e ? () => openFlow(e.id) : undefined} role={e ? "button" : undefined}>
        <div className="pc-card__head">
          {e ? <Entry e={e} /> : <code>{step.fns[0] ?? "function"}</code>}
          {step.fns.length > 0 && e && <code className="pc-card__fn">{step.fns.join(", ")}()</code>}
          <span className="pc-card__ref" onClick={(ev) => ev.stopPropagation()}><Ref proof={step.proof} /></span>
        </div>
        {step.guards.map((g, i) => <div key={i} className="pc-guard"><span className="ft-c ft-c--refuse">{g.status}</span> si <code>{g.when}</code></div>)}
        <Chain step={step} />
        {step.then.map((t) => t.steps.map((c) => (
          <div key={`${t.topic}/${c.id}`} className="pc-then" onClick={(ev) => { ev.stopPropagation(); if (c.entry) openFlow(c.entry.id); }}>
            <span className="pc-then__head"><span className="ft-c ft-c--message"><em>queue</em> {t.topic}</span><i className="ft-ar" /><code>{c.entry?.handler?.name && c.entry.handler.name !== "anonymous function" ? c.entry.handler.name : "consumer"}</code></span>
            <Chain step={c} />
          </div>
        )))}
      </div>
    </div>
  );
}

function Stage({ stage, openFlow }: { stage: ProcStage; openFlow: (id: string) => void }) {
  return (
    <section className={`pc-stage pc-stage--${stage.tone}`}>
      <div className="pc-stage__steps">
        {stage.steps.length ? stage.steps.map((s) => <Step key={s.id} step={s} openFlow={openFlow} />) : <p className="ft-r__empty">no entry point read</p>}
      </div>
      <div className="pc-bracket"><i /></div>
      <div className="pc-stage__state">
        {stage.tone === "queue" ? <span className="ft-c ft-c--message">{stage.label}</span> : stage.tone === "any" ? <span className="ft-c">{stage.label}</span> : <State value={stage.label} />}
        {stage.note && <small>{stage.note}</small>}
      </div>
    </section>
  );
}

function Item({ x, on, open }: { x: Process; on: boolean; open: () => void }) {
  return (
    <button className={`pc-item${on ? " is-on" : ""}`} onClick={open}>
      <span className="pc-item__name">{x.name}{x.kind === "state" && <small>.{x.sub}</small>}</span>
      <span className="pc-item__who">{x.triggers.map((t) => WHO[t]).join(", ")}</span>
    </button>
  );
}

/** Parcours : un processus suivi à travers ses points d'entrée, d'après les écritures et les déroulés lus. */
export function ProcessScreen({ map, item, open, openFlow, openTable }: { map: MapPayload; item?: string; open: (id: string) => void; openFlow: (id: string) => void; openTable: (id: string) => void }) {
  const list = processes(map);
  const cur = list.find((x) => x.id === item) ?? list[0];
  const states = list.filter((x) => x.kind === "state"), files = list.filter((x) => x.kind === "queue");
  return (
    <div className="page pc">
      <h1 className="page__title">Process</h1>
      {!cur ? <section className="vl-card pc__none"><b>No process read</b><p>No state field written by the code, no queue: this project's routes read one by one in Features.</p></section> : (
        <div className="pc__grid">
          <nav className="pc__list" aria-label="Process">
            {states.length > 0 && <span className="vl-label">Stateful data</span>}
            {states.map((x) => <Item key={x.id} x={x} on={x.id === cur.id} open={() => open(x.id)} />)}
            {files.length > 0 && <span className="vl-label">Queues</span>}
            {files.map((x) => <Item key={x.id} x={x} on={x.id === cur.id} open={() => open(x.id)} />)}
          </nav>
          <Rep name={cur.kind === "state" ? `${cur.name}.${cur.sub}` : `Queue ${cur.name}`} sentence={<Rich text={cur.sentence} />} {...(cur.table ? { action: <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => openTable(cur.table!)}>Table {cur.name}</button> } : {})} flush>
            <div className="pc-lanes"><span>Trigger</span><span>Entry point, what it does</span><span>{cur.kind === "state" ? "State written" : "Role"}</span></div>
            {cur.stages.map((s) => <Stage key={s.id} stage={s} openFlow={openFlow} />)}
            {cur.never.length > 0 && <div className="pc-never"><b>Never written by the code:</b> {cur.never.map((v) => <State key={v} value={v} never />)}</div>}
          </Rep>
        </div>
      )}
    </div>
  );
}
