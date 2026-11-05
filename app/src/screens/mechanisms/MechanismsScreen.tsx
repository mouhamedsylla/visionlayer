import type { ArchNode, MapPayload } from "../../api/types";
import { mechanismsOf, type ContractView, type OutageView, type QueueView } from "../../model/mechanisms";
import { plural } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rep } from "../../lang/Rep";
import { Arrow } from "../../lang/marks";
import { Provenance } from "../../lang/marks";
import { Workspace } from "../../ui/Workspace";
import "./mechanisms.css";

type Tab = "contrats" | "files" | "pannes";
const TABS: { id: Tab; label: string }[] = [{ id: "contrats", label: "Contracts" }, { id: "files", label: "Queues" }, { id: "pannes", label: "Outages" }];

/** Planche L6, Mécanismes : comment le système choisit ce qui s'exécute. Les contrats (X3), les files (F2), les dépendances qui peuvent tomber (X4). */
export function MechanismsScreen({ map, block, item, open }: { map: MapPayload; block?: ArchNode; item?: string; open: (id: string) => void }) {
  const { contracts: list, queues: qs, outages: outs } = mechanismsOf(map, block);
  const has = (t: Tab) => (t === "contrats" ? list.length : t === "files" ? qs.length : outs.length) > 0;
  const [prefix, key] = item?.includes(":") && ["files", "pannes"].includes(item.split(":")[0]!) ? [item.split(":")[0] as Tab, item.slice(item.indexOf(":") + 1)] : ["contrats" as Tab, item];
  const tab: Tab = item && has(prefix) ? prefix : list.length ? "contrats" : qs.length ? "files" : "pannes";
  const v = list.find((x) => x.id === key) ?? list[0];
  const q = qs.find((x) => x.id === key) ?? qs[0];
  const o = outs.find((x) => x.id === key) ?? outs[0];
  const received = list.reduce((n, x) => n + x.consumers.length, 0);
  const count: Record<Tab, number> = { contrats: list.length, files: qs.length, pannes: outs.length };
  return (
    <Workspace
      head={<div className="mc__intro">
        <h1 className="mc__title">Mechanisms</h1>
      </div>}
      panel={tab === "contrats" ? v && <Side v={v} /> : <How tab={tab} />}>
      <div className="tiles">
        <div className="tile"><small>Contracts</small><b>{plural(list.length, "contrat", "contrats")}</b><span>{received ? `received by ${plural(received, "class", "classes")}` : "interfaces and abstract classes filled twice"}</span></div>
        <div className="tile"><small>Queues</small><b>{qs.length ? qs.map((x) => x.topic).join(", ") : "none"}</b><span>{qs.length ? `${plural(qs.reduce((n, x) => n + x.producers.length, 0), "place enqueues", "places enqueue")}` : "no queue read"}</span></div>
        <div className={`tile${outs.length ? " tile--cr" : ""}`}><small>No timeout</small><b>{outs.length ? outs.map((x) => x.dep.name).join(", ") : "none found"}</b><span>{outs.length ? "no maximum timeout read" : "none found, among the clients whose timeout a pack reads"}</span></div>
        <div className="tile"><small>Write then enqueue</small><b>{plural(map.model.findings.filter((f) => f.code === "write_then_enqueue" && (!block || f.nodes?.includes(block.id))).length, "place", "places")}</b><span>if the queue fails, the write stays</span></div>
      </div>
      <section className="card">
        <div className="tabs">{TABS.map((t) => <button key={t.id} className={`seg${t.id === tab ? " seg--on" : ""}`} onClick={() => open(t.id === "contrats" ? "" : `${t.id}:`)}>{t.label}<span className="vl-count">{count[t.id]}</span></button>)}</div>
        {tab === "contrats" && <>
          {list.length === 0 && <p className="mc__empty">No contract read: no interface or abstract class in the repository is filled by two classes.</p>}
          {list.length > 0 && <div className="mc__row mc__row--h"><span>Contract</span><span>Implementations</span><span>Bound by</span><span>Received by</span></div>}
          {list.map((x) => (
            <button key={x.id} className={`mc__row${x === v ? " mc__row--on" : ""}`} onClick={() => open(x.id)}>
              <code>{x.c.name}</code><span>{x.impls.map((i) => i.name).join(", ")}</span>
              <span className={x.impls.some((i) => i.bound.length) ? "" : "q"}>{x.impls.some((i) => i.bound.length) ? "the container" : x.c.selector ? x.c.selector.symbol.name : "not read"}</span>
              <span className={x.consumers.length ? "" : "q"}>{x.consumers.length ? x.consumers.map((k) => k.name).join(", ") : "no class read"}</span>
            </button>
          ))}
        </>}
        {tab === "files" && <>
          {qs.length === 0 && <p className="mc__empty">No queue read: no queue pack finds a queue in this repository.</p>}
          {qs.map((x) => (
            <button key={x.id} className={`mc__row mc__row--q${x === q ? " mc__row--on" : ""}`} onClick={() => open(`files:${x.id}`)}>
              <code>{x.topic}</code><span>{x.node.name}</span><span>{plural(x.producers.length, "place enqueues", "places enqueue")}</span><span>{x.consumers.map((c) => `${c.node.name}, ${c.entry.handler?.name ?? c.entry.key}`).join("; ") || "nobody consumes it"}</span>
            </button>
          ))}
        </>}
        {tab === "pannes" && <>
          {outs.length === 0 && <p className="mc__empty">None found. The timeout is only read for clients whose defaults a pack knows, from their documentation; any other client is not checked.</p>}
          {outs.map((x) => (
            <button key={x.id} className={`mc__row mc__row--q${x === o ? " mc__row--on" : ""}`} onClick={() => open(`pannes:${x.id}`)}>
              <code>{x.dep.name}</code><span>{x.dependents.map((d) => d.node.name).join(", ")}</span><span>{plural(x.dependents.reduce((n, d) => n + d.entries.length, 0), "entry point", "entry points")}</span><span className="see">no maximum timeout</span>
            </button>
          ))}
        </>}
      </section>
      {tab === "contrats" && v && <Contract v={v} />}
      {tab === "files" && q && <Queue q={q} />}
      {tab === "pannes" && o && <Outage o={o} />}
    </Workspace>
  );
}

/** F2 : de gauche à droite, qui dépose, la file, qui la consomme, ce qu'il fait. Le pointillé : celui qui dépose n'attend pas. */
function Queue({ q }: { q: QueueView }) {
  const c = q.consumers[0];
  const risky = q.producers.filter((p) => p.risk).length;
  return (
    <Rep code="F2" name="Async path" question="What happens to this message?"
      sentence={`${plural(q.producers.length, "place enqueues", "places enqueue")} into queue ${q.topic}${c ? `; ${c.node.name} consumes it with ${c.entry.handler?.name ?? c.entry.key}` : "; nobody consumes it"}.${risky ? ` ${plural(risky, "writes", "write")} to the database first: if the queue fails, the write stays.` : ""}`}
      reads="left to right. Dotted is a message: the sender doesn't wait. In red, an enqueue after a write, with no shared transaction.">
      <div className="mc__f2">
        <div className="mc__col">
          <span className="vl-label">Enqueue</span>
          {q.producers.map((p) => (
            <div key={p.proof.path + p.proof.line} className={`mc__k${p.risk ? " mc__k--cr" : ""}`}>
              <b>{p.entries[0] ?? p.proof.path.split("/").pop()}</b>
              <Ref proof={p.proof} />
              {p.risk && <small className="mc__risk">writes then enqueues</small>}
            </div>
          ))}
        </div>
        <div className="mc__mid"><Arrow kind="message" label="enqueues" /></div>
        <div className="mc__col">
          <span className="vl-label">Queue</span>
          <div className="mc__iface"><b>{q.topic}</b><small>{q.node.name}</small><Ref proof={q.proof} /></div>
          <small className="q">retries and timeouts: not read</small>
        </div>
        <div className="mc__mid"><Arrow kind="message" label="consomme" /></div>
        <div className="mc__col">
          <span className="vl-label">Consumes</span>
          {c ? <div className="mc__cls"><b>{c.node.name}, {c.entry.handler?.name ?? c.entry.key}</b>{c.entry.handler && <Ref proof={{ path: c.entry.handler.path, line: c.entry.handler.line }} />}
            <div className="mc__fx">{c.effects.map((e, i) => <span key={i} className={`mc__fx1${e.verb === "writes" ? " mc__fx1--w" : ""}`}>{e.verb} <b>{e.what}</b></span>)}</div>
            {c.refuses.length > 0 && <small>gives up without retry: {c.refuses.join(", ")}</small>}
          </div> : <span className="mc__none">nobody consumes it</span>}
        </div>
      </div>
    </Rep>
  );
}

/** X4 : la dépendance, puis qui en dépend, par où, et ce qui reste écrit. */
function Outage({ o }: { o: OutageView }) {
  return (
    <Rep code="X4" name="Dependency outage" question="What happens to the system?"
      sentence={`If ${o.dep.name} stops responding, ${o.dependents.map((d) => d.node.name).join(" and ")} ${o.dependents.length > 1 ? "wait" : "waits"} forever: ${o.message.split(": ")[0]}.`}
      reads="per row: who depends on it, through which entry points, and what the outage leaves behind.">
      <div className="mc__fig">
        <div className="mc__top"><div className="mc__iface mc__iface--cr"><b>{o.dep.name}</b><small>no maximum timeout</small><Ref proof={o.proof} /></div></div>
        <table className="mc__tbl">
          <thead><tr><th className="mc__c1">Who depends on it</th><th className="mc__c2">How</th><th>Entry points touched</th></tr></thead>
          <tbody>
            {o.dependents.map((d) => (
              <tr key={d.node.id}><td><b className="mc__mono">{d.node.name}</b></td><td>{d.how}</td><td className="mc__entries">{d.entries.length ? d.entries.slice(0, 6).join(", ") + (d.entries.length > 6 ? `, and ${d.entries.length - 6} more` : "") : <span className="q">at startup</span>}</td></tr>
            ))}
          </tbody>
        </table>
        {o.leftover.length > 0 && <div className="mc__left"><span className="vl-label">What stays written</span>{o.leftover.map((l) => <p key={l.proof.path + l.proof.line}>{l.message.replace(/^./, (x) => x.toUpperCase())}. <Ref proof={l.proof} /></p>)}</div>}
      </div>
    </Rep>
  );
}

function How({ tab }: { tab: Tab }) {
  return (
    <aside className="mc__side">
      <section className="card">
        <div className="hd"><h2>Source</h2></div>
        <p className="mc__how">{tab === "files"
          ? "Through the queue technology's pack: the queue created, each add and the worker consuming it. The pack doesn't read retry settings or a message's unique key yet."
          : "Through the dependency clients: the connection to the database and the queue, read with its options. No timeout written, or unlimited retries, and the outage blocks instead of failing."}</p>
        <div className="mc__prov"><Provenance kind="read" /></div>
      </section>
    </aside>
  );
}

/** X3 : le contrat au centre, chaque implémentation sur sa ligne avec ce qui la choisit, ceux qui le reçoivent à gauche. */
function Contract({ v }: { v: ContractView }) {
  const { c } = v;
  const wired = v.impls.some((i) => i.bound.length);
  return (
    <Rep code="X3" name="Contract" question="Which implementation answers?" sentence={v.sentence}
      reads="left to right: who receives the contract, the contract, then each implementation on its row with where the container binds it, or the value that picks it. Dotted: never bound, from what is read.">
      <div className="mc__fig">
        <div className={v.consumers.length ? "mc__top" : "mc__top mc__top--alone"}>
          {v.consumers.length > 0 && <div className="mc__recv">{v.consumers.map((k) => <div key={k.name + k.proof.path} className="mc__k"><b>{k.name}</b><Ref proof={k.proof} /></div>)}</div>}
          {v.consumers.length > 0 && <Arrow kind="call" label="receives" />}
          <div className="mc__iface"><b>{c.name}</b><small>{plural(c.operations.length, "operation", "operations")}</small><Ref proof={{ path: c.interface.path, line: c.interface.line }} /></div>
          {v.consumers.length === 0 && <span className="mc__none">no class receives it from a container, from what is read</span>}
        </div>
        <table className="mc__tbl">
          <thead><tr>{c.selector && <th className="mc__c1">Picked when</th>}{wired && <th className="mc__c2">Bound in</th>}<th className="mc__arrow" /><th>Implementation</th></tr></thead>
          <tbody>
            {v.impls.map((i) => (
              <tr key={i.name}>
                {c.selector && <td>{i.when ? <code className="mc__when">{i.when === "sinon" ? "sinon" : i.when}</code> : <span className="q">not read</span>}</td>}
                {wired && <td>{i.bound.length ? i.bound.map((b) => <Ref key={b.path + b.line} proof={b} />) : <span className="q">not read</span>}</td>}
                <td className="mc__arrow"><Arrow kind="call" /></td>
                <td><div className={`mc__cls${i.bound.length || i.when ? "" : " mc__cls--o"}`}><b>{i.name}</b><Ref proof={i.proof} />{i.packages.length > 0 && <small>emploie {i.packages.join(", ")}</small>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Rep>
  );
}

function Side({ v }: { v: ContractView }) {
  const { c } = v;
  const packs = [...new Set([...(c.bindings ?? []), ...v.consumers].map((x) => x.proof.pack).filter(Boolean))];
  return (
    <aside className="mc__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Selected contract</span>
          <h2>{c.name}</h2>
          <p className="sub">{c.interface.path}:{c.interface.line}</p>
        </div>
        {c.summary && <p className="sub">{c.summary.text}</p>}
        <span className="lbl">Operations</span>
        <div className="mc__ops">
          {c.operations.map((o) => <div key={o.name}><b>{o.name}</b><span>line {o.line}</span></div>)}
        </div>
      </section>
      <section className="card">
        <div className="hd"><h2>Source</h2></div>
        <p className="mc__how">The contract and its implementations are read from the syntax: <code>implements</code>, an interface or an abstract class. {packs.length ? <>What the container binds, and who receives it, comes from the capture {packs.map((p) => <b key={p}>{p}</b>)}.</> : "No capture here says what a container binds."}</p>
        <div className="mc__prov"><Provenance kind="read" /></div>
      </section>
    </aside>
  );
}
