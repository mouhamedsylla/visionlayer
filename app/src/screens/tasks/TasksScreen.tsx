import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ArchNode, MapPayload, SourceExcerpt } from "../../api/types";
import { triggers, type Trigger } from "../../model/tasks";
import { plural } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { Rep } from "../../lang/Rep";
import { Workspace } from "../../ui/Workspace";
import "./tasks.css";

/** Planche 06, Tâches planifiées : ce qui tourne sans que personne clique. */
export function TasksScreen({ map, block, openFlow }: { map: MapPayload; block?: ArchNode; openFlow: (id: string) => void }) {
  const list = triggers(map, block);
  const [chosen, setChosen] = useState<string>();
  const t = list.find((x) => x.id === chosen) ?? list.find((x) => x.seeTone === "cr") ?? list[0];
  const schedules = list.filter((x) => x.kind === "schedule"), queues = list.filter((x) => x.kind === "queue"), hooks = list.filter((x) => x.kind === "webhook");
  const twice = schedules.filter((x) => x.machines > 1);
  const decl = schedules[0]?.entry.proof;
  const clock = schedules.length === 0 ? `No scheduled task; ${plural(list.length, "on-demand trigger", "on-demand triggers")}.`
    : twice.length ? `${twice.length === schedules.length ? `The ${plural(schedules.length, "task", "tasks")}` : plural(twice.length, "task", "tasks")} run in ${twice[0]!.node.name}, deployed on ${twice[0]!.machines} machines: each one runs ${twice[0]!.machines} times.`
    : `${plural(schedules.length, "scheduled task", "scheduled tasks")}, each run once.`;
  return (
    <Workspace
      head={<div className="tk__intro">
        <h1 className="tk__title">Scheduled tasks</h1>
      </div>}
      panel={t && <Side t={t} openFlow={openFlow} />}>
      <div className="tiles">
        <div className="tile"><small>Scheduled tasks</small><b>{plural(schedules.length, "task", "tasks")}</b><span>{decl ? `declared in ${decl.path.split("/").slice(-2).join("/")}` : "none read"}</span></div>
        <div className="tile"><small>Queues</small><b>{queues.length ? `${plural(queues.length, "queue", "queues")}: ${queues.map((q) => q.entry.key).join(", ")}` : "no queue"}</b><span>{queues.map((q) => `${q.node.name}, ${q.onFail}`).join("; ") || "no consumer read"}</span></div>
        <div className="tile"><small>Webhooks</small><b>{plural(hooks.length, "signed webhook", "signed webhooks")}</b><span>{hooks.map((h) => h.entry.key).join(", ") || "none"}</span></div>
        <div className={`tile${twice.length ? " tile--cr" : ""}`}><small>Multi-instance</small><b>{twice.length ? (twice.length === schedules.length ? `The ${schedules.length} tasks` : plural(twice.length, "task", "tasks")) : "none"}</b><span>{twice.length ? `they run in ${twice[0]!.node.name}, deployed on ${twice[0]!.machines} machines` : "each task starts once"}</span></div>
      </div>
          <Rep code="T3" name="Clock" question="What runs with nobody around, and when?" sentence={clock} flush
            reads={<>over one day of {map.model.system.name} : each mark is a run, a solid band a run so frequent it fills the day; “×N”, it happens on each machine. Pick a row to see its details on the right.</>}>
            <div className="tk__day">
              <div className="tk__dh"><span /><div className="tk__axis"><span style={{ left: 0, transform: "none" }}>0 h</span><span style={{ left: "25%" }}>6 h</span><span style={{ left: "50%" }}>12 h</span><span style={{ left: "75%" }}>18 h</span><span style={{ left: "100%", transform: "translateX(-100%)" }}>24 h</span></div></div>
              {list.map((x) => (
                <button key={x.id} className="tk__dr" onClick={() => setChosen(x.id)}>
                  <div><b>{x.name}</b><small>{x.when}</small></div>
                  <div className="tk__tr">
                    {x.fill && <span className="tk__fill" />}
                    {x.fill && <em className={x.machines > 1 ? "cr" : ""} style={{ right: 6 }}>{x.perDay?.toLocaleString("en-GB")} times{x.machines > 1 ? `, ×${x.machines}` : ""}</em>}
                    {!x.fill && x.ticks.map((h, i) => <i key={i} className={x.machines > 1 ? "x2" : ""} style={{ left: `${(h / 24) * 100}%` }} />)}
                    {!x.fill && x.ticks.length > 0 && x.ticks.length < 4 && x.machines > 1 && <em style={{ left: `calc(${(x.ticks[0]! / 24) * 100}% + 14px)` }}>×{x.machines}</em>}
                    {x.kind !== "schedule" && <span className="tk__ondemand">on demand</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="lg"><span><i />scheduled, fixed time</span><span><i className="ev" />on demand</span><span>×N: once per machine</span></div>
          </Rep>
          <section className="card">
            <div className="trg trg--h"><span>Trigger</span><span>When</span><span>Effects</span><span>Failure</span><span>Finding</span></div>
            {list.map((x) => (
              <button key={x.id} className={`trg trg--row${x === t ? " trg--on" : ""}`} onClick={() => setChosen(x.id)}>
                <code>{x.name}</code><span>{x.when}</span><span>{x.does}</span><span className={x.onFail.includes("not read") ? "q" : ""}>{x.onFail}</span>
                <span className={x.seeTone === "cr" ? "see" : "q"}>{x.see ? <Rich text={x.see} /> : "nothing"}</span>
              </button>
            ))}
            {list.length === 0 && <p className="foot">Nothing runs without a click on this project, from what is read: no scheduled task, no queue consumer, no signed webhook. A scheduling technology with no pack would stay invisible here; the Overview says what is not read.</p>}
          </section>
    </Workspace>
  );
}

function Side({ t, openFlow }: { t: Trigger; openFlow: (id: string) => void }) {
  const [code, setCode] = useState<SourceExcerpt>();
  useEffect(() => { setCode(undefined); api.source(t.entry.proof.path, Math.max(1, t.entry.proof.line - 1), t.entry.proof.line).then(setCode).catch(() => {}); }, [t.id]);
  const steps = (t.entry.flow ?? []).filter((s) => ["read", "write", "message", "request", "refuse"].includes(s.kind)).slice(0, 4);
  const verb: Record<string, string> = { read: "reads", write: "writes", message: "enqueues", request: "calls", refuse: "refuse" };
  return (
    <aside className="tk__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Selected trigger</span>
          <h2>{t.name}</h2>
          <p className="sub">{t.when}, {t.entry.proof.path.split("/").slice(-2).join("/")}:{t.entry.proof.line}</p>
        </div>
        {code && <div className="ed">{code.lines.map((l, i) => <div key={i} className={code.from + i === t.entry.proof.line ? "hl" : ""}><span>{code.from + i}</span><span>{l}</span></div>)}</div>}
        <button className="vl-btn vl-btn--light vl-btn--sm tk__open" onClick={() => openFlow(t.entry.id)}>Open its flow</button>
        <span className="lbl">Its path</span>
        <div className="life">
          {steps.length === 0 && <div className="nlrow"><i /><b>—</b><p>no effect read in its code</p></div>}
          {steps.map((s, i) => (
            <div key={i} className={i === steps.length - 1 ? "now" : ""}><i /><b>{verb[s.kind]}</b><p>{s.target?.entity ?? s.target?.topic ?? s.target?.node ?? s.name ?? s.code ?? ""}{s.when ? `, if ${s.when}` : ""}<code>{s.proof.path.split("/").pop()}:{s.proof.line}</code></p></div>
          ))}
        </div>
        {t.finding && (
          <div className="race">
            <b>{t.machines > 1 && t.finding.code === "scheduled_on_every_instance" ? `Started by each copy of ${t.node.name}` : "Worth checking"}</b>
            <p><Rich text={t.finding.message.replace(/^./, (c) => c.toUpperCase())} />.</p>
            <span className="dx__refs">{t.finding.proof.slice(0, 2).map((x, i) => <Ref key={i} proof={x} />)}</span>
          </div>
        )}
      </section>
      <section className="card">
        <div className="hd"><h2>Source</h2></div>
        <p className="tk__how">Through scheduler calls, queue consumers, routes an external service calls with a signature, and the number of machines declared at deployment. Each pack says how its technology starts: a scheduler written in the code runs in every process that loads it, a task declared at deployment starts once per schedule.</p>
      </section>
    </aside>
  );
}
