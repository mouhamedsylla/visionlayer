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
const TABS: { id: Tab; label: string }[] = [{ id: "contrats", label: "Contrats" }, { id: "files", label: "Files" }, { id: "pannes", label: "Si une dépendance tombe" }];

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
        <h1 className="mc__title">Comment le système choisit ce qui s'exécute</h1>
        <p className="mc__lead">Ce qui décide, sans qu'une route le dise : quelle implémentation répond à un contrat, ce qui passe par une file et qui le reprend, ce qui attend sans fin quand une dépendance tombe. Tout est lu dans le code, chaque ligne à l'appui.</p>
      </div>}
      panel={tab === "contrats" ? v && <Side v={v} /> : <How tab={tab} />}>
      <div className="tiles">
        <div className="tile"><small>Contrats</small><b>{plural(list.length, "contrat", "contrats")}</b><span>{received ? `reçus par ${plural(received, "classe", "classes")}` : "interfaces et classes abstraites remplies deux fois"}</span></div>
        <div className="tile"><small>Files</small><b>{qs.length ? qs.map((x) => x.topic).join(", ") : "aucune"}</b><span>{qs.length ? `${plural(qs.reduce((n, x) => n + x.producers.length, 0), "lieu y dépose", "lieux y déposent")}` : "aucune file lue"}</span></div>
        <div className={`tile${outs.length ? " tile--cr" : ""}`}><small>Attendent sans fin</small><b>{outs.length ? outs.map((x) => x.dep.name).join(", ") : "aucune trouvée"}</b><span>{outs.length ? "aucun délai maximum lu" : "aucune trouvée, parmi les clients dont un pack lit le délai"}</span></div>
        <div className="tile"><small>Écrit puis met en file</small><b>{plural(map.model.findings.filter((f) => f.code === "write_then_enqueue" && (!block || f.nodes?.includes(block.id))).length, "lieu", "lieux")}</b><span>si la file tombe, l'écriture reste</span></div>
      </div>
      <section className="card">
        <div className="tabs">{TABS.map((t) => <button key={t.id} className={`seg${t.id === tab ? " seg--on" : ""}`} onClick={() => open(t.id === "contrats" ? "" : `${t.id}:`)}>{t.label}<span className="vl-count">{count[t.id]}</span></button>)}</div>
        {tab === "contrats" && <>
          {list.length === 0 && <p className="mc__empty">Aucun contrat lu : aucune interface ni classe abstraite du dépôt n'est remplie par deux classes.</p>}
          {list.length > 0 && <div className="mc__row mc__row--h"><span>Contrat</span><span>Implémentations</span><span>Branché par</span><span>Reçu par</span></div>}
          {list.map((x) => (
            <button key={x.id} className={`mc__row${x === v ? " mc__row--on" : ""}`} onClick={() => open(x.id)}>
              <code>{x.c.name}</code><span>{x.impls.map((i) => i.name).join(", ")}</span>
              <span className={x.impls.some((i) => i.bound.length) ? "" : "q"}>{x.impls.some((i) => i.bound.length) ? "le conteneur" : x.c.selector ? x.c.selector.symbol.name : "non lu"}</span>
              <span className={x.consumers.length ? "" : "q"}>{x.consumers.length ? x.consumers.map((k) => k.name).join(", ") : "aucune classe lue"}</span>
            </button>
          ))}
        </>}
        {tab === "files" && <>
          {qs.length === 0 && <p className="mc__empty">Aucune file lue : aucun pack de file ne trouve de file dans ce dépôt.</p>}
          {qs.map((x) => (
            <button key={x.id} className={`mc__row mc__row--q${x === q ? " mc__row--on" : ""}`} onClick={() => open(`files:${x.id}`)}>
              <code>{x.topic}</code><span>{x.node.name}</span><span>{plural(x.producers.length, "lieu y dépose", "lieux y déposent")}</span><span>{x.consumers.map((c) => `${c.node.name}, ${c.entry.handler?.name ?? c.entry.key}`).join(" ; ") || "personne ne la consomme"}</span>
            </button>
          ))}
        </>}
        {tab === "pannes" && <>
          {outs.length === 0 && <p className="mc__empty">Aucune trouvée. Le délai n'est lu que pour les clients dont un pack connaît les valeurs par défaut, d'après leur documentation ; un autre client n'est pas vérifié.</p>}
          {outs.map((x) => (
            <button key={x.id} className={`mc__row mc__row--q${x === o ? " mc__row--on" : ""}`} onClick={() => open(`pannes:${x.id}`)}>
              <code>{x.dep.name}</code><span>{x.dependents.map((d) => d.node.name).join(", ")}</span><span>{plural(x.dependents.reduce((n, d) => n + d.entries.length, 0), "point d'entrée", "points d'entrée")}</span><span className="see">aucun délai maximum</span>
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
    <Rep code="F2" name="Trajet asynchrone" question="Que devient ce message ?"
      sentence={`${plural(q.producers.length, "lieu dépose", "lieux déposent")} dans la file ${q.topic}${c ? ` ; ${c.node.name} la consomme avec ${c.entry.handler?.name ?? c.entry.key}` : " ; personne ne la consomme"}.${risky ? ` ${plural(risky, "écrit", "écrivent")} d'abord en base : si la file tombe, l'écriture reste.` : ""}`}
      reads="de gauche à droite. Le pointillé est un message : celui qui l'envoie n'attend pas. En rouge, un dépôt fait après une écriture, sans transaction commune.">
      <div className="mc__f2">
        <div className="mc__col">
          <span className="vl-label">Déposent</span>
          {q.producers.map((p) => (
            <div key={p.proof.path + p.proof.line} className={`mc__k${p.risk ? " mc__k--cr" : ""}`}>
              <b>{p.entries[0] ?? p.proof.path.split("/").pop()}</b>
              <Ref proof={p.proof} />
              {p.risk && <small className="mc__risk">écrit puis met en file</small>}
            </div>
          ))}
        </div>
        <div className="mc__mid"><Arrow kind="message" label="met en file" /></div>
        <div className="mc__col">
          <span className="vl-label">File</span>
          <div className="mc__iface"><b>{q.topic}</b><small>{q.node.name}</small><Ref proof={q.proof} /></div>
          <small className="q">reprises et délais : non lus</small>
        </div>
        <div className="mc__mid"><Arrow kind="message" label="consomme" /></div>
        <div className="mc__col">
          <span className="vl-label">Consomme</span>
          {c ? <div className="mc__cls"><b>{c.node.name}, {c.entry.handler?.name ?? c.entry.key}</b>{c.entry.handler && <Ref proof={{ path: c.entry.handler.path, line: c.entry.handler.line }} />}
            <div className="mc__fx">{c.effects.map((e, i) => <span key={i} className={`mc__fx1${e.verb === "écrit" ? " mc__fx1--w" : ""}`}>{e.verb} <b>{e.what}</b></span>)}</div>
            {c.refuses.length > 0 && <small>abandonne sans reprise : {c.refuses.join(", ")}</small>}
          </div> : <span className="mc__none">personne ne la consomme</span>}
        </div>
      </div>
    </Rep>
  );
}

/** X4 : la dépendance, puis qui en dépend, par où, et ce qui reste écrit. */
function Outage({ o }: { o: OutageView }) {
  return (
    <Rep code="X4" name="Si une dépendance tombe" question="Que devient le système ?"
      sentence={`Si ${o.dep.name} ne répond plus, ${o.dependents.map((d) => d.node.name).join(" et ")} ${o.dependents.length > 1 ? "attendent" : "attend"} sans fin : ${o.message.split(" : ")[0]}.`}
      reads="par ligne : qui en dépend, par quels points d'entrée, et ce que la panne laisse derrière elle.">
      <div className="mc__fig">
        <div className="mc__top"><div className="mc__iface mc__iface--cr"><b>{o.dep.name}</b><small>aucun délai maximum</small><Ref proof={o.proof} /></div></div>
        <table className="mc__tbl">
          <thead><tr><th className="mc__c1">Qui en dépend</th><th className="mc__c2">Comment</th><th>Points d'entrée touchés</th></tr></thead>
          <tbody>
            {o.dependents.map((d) => (
              <tr key={d.node.id}><td><b className="mc__mono">{d.node.name}</b></td><td>{d.how}</td><td className="mc__entries">{d.entries.length ? d.entries.slice(0, 6).join(", ") + (d.entries.length > 6 ? `, et ${d.entries.length - 6} autres` : "") : <span className="q">au démarrage</span>}</td></tr>
            ))}
          </tbody>
        </table>
        {o.leftover.length > 0 && <div className="mc__left"><span className="vl-label">Ce qui reste écrit</span>{o.leftover.map((l) => <p key={l.proof.path + l.proof.line}>{l.message.replace(/^./, (x) => x.toUpperCase())}. <Ref proof={l.proof} /></p>)}</div>}
      </div>
    </Rep>
  );
}

function How({ tab }: { tab: Tab }) {
  return (
    <aside className="mc__side">
      <section className="card">
        <div className="hd"><h2>Comment c'est trouvé</h2></div>
        <p className="mc__how">{tab === "files"
          ? "Par le pack de la technologie de file : la file créée, chaque ajout et le worker qui la consomme. Le pack ne lit pas encore les réglages de reprise ni la clé d'unicité d'un message."
          : "Par les clients des dépendances : la connexion à la base et à la file, lue avec ses options. Aucun délai écrit, ou des reprises sans limite, et la panne bloque au lieu d'échouer."}</p>
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
    <Rep code="X3" name="Contrat" question="Quelle implémentation répond ?" sentence={v.sentence}
      reads="de gauche à droite : qui reçoit le contrat, le contrat, puis chaque implémentation sur sa ligne avec l'endroit où le conteneur la branche, ou la valeur qui la choisit. Pointillé : jamais branchée d'après ce qui est lu.">
      <div className="mc__fig">
        <div className={v.consumers.length ? "mc__top" : "mc__top mc__top--alone"}>
          {v.consumers.length > 0 && <div className="mc__recv">{v.consumers.map((k) => <div key={k.name + k.proof.path} className="mc__k"><b>{k.name}</b><Ref proof={k.proof} /></div>)}</div>}
          {v.consumers.length > 0 && <Arrow kind="call" label="reçoit" />}
          <div className="mc__iface"><b>{c.name}</b><small>{plural(c.operations.length, "opération", "opérations")}</small><Ref proof={{ path: c.interface.path, line: c.interface.line }} /></div>
          {v.consumers.length === 0 && <span className="mc__none">aucune classe ne le reçoit d'un conteneur, d'après ce qui est lu</span>}
        </div>
        <table className="mc__tbl">
          <thead><tr>{c.selector && <th className="mc__c1">Choisie quand</th>}{wired && <th className="mc__c2">Branchée dans</th>}<th className="mc__arrow" /><th>Implémentation</th></tr></thead>
          <tbody>
            {v.impls.map((i) => (
              <tr key={i.name}>
                {c.selector && <td>{i.when ? <code className="mc__when">{i.when === "sinon" ? "sinon" : i.when}</code> : <span className="q">non lu</span>}</td>}
                {wired && <td>{i.bound.length ? i.bound.map((b) => <Ref key={b.path + b.line} proof={b} />) : <span className="q">non lu</span>}</td>}
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
          <span className="lbl">Contrat choisi</span>
          <h2>{c.name}</h2>
          <p className="sub">{c.interface.path}:{c.interface.line}</p>
        </div>
        {c.summary && <p className="sub">{c.summary.text}</p>}
        <span className="lbl">Ce qu'il promet</span>
        <div className="mc__ops">
          {c.operations.map((o) => <div key={o.name}><b>{o.name}</b><span>ligne {o.line}</span></div>)}
        </div>
      </section>
      <section className="card">
        <div className="hd"><h2>Comment c'est trouvé</h2></div>
        <p className="mc__how">Le contrat et ses implémentations sont lus dans la syntaxe : <code>implements</code>, une interface ou une classe abstraite. {packs.length ? <>Ce que le conteneur branche, et qui le reçoit, vient de la capture {packs.map((p) => <b key={p}>{p}</b>)}.</> : "Aucune capture ne dit ici ce que branche un conteneur."}</p>
        <div className="mc__prov"><Provenance kind="read" /></div>
      </section>
    </aside>
  );
}
