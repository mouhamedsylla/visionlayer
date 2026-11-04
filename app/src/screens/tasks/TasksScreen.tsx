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
  const clock = schedules.length === 0 ? `Aucune tâche planifiée ; ${plural(list.length, "déclencheur à la demande", "déclencheurs à la demande")}.`
    : twice.length ? `${twice.length === schedules.length ? `Les ${plural(schedules.length, "tâche", "tâches")}` : plural(twice.length, "tâche", "tâches")} tournent dans ${twice[0]!.node.name}, déployé sur ${twice[0]!.machines} machines : chacune s'exécute ${twice[0]!.machines} fois.`
    : `${plural(schedules.length, "tâche planifiée", "tâches planifiées")}, chacune lancée une fois.`;
  return (
    <Workspace
      head={<div className="tk__intro">
        <h1 className="tk__title">Ce qui tourne sans que personne clique</h1>
        <p className="tk__lead">Lu dans le code et dans les manifestes de déploiement : les tâches planifiées, les files, les événements qu'un service extérieur envoie. Leurs exécutions réelles ne sont pas lues.</p>
      </div>}
      panel={t && <Side t={t} openFlow={openFlow} />}>
      <div className="tiles">
        <div className="tile"><small>Tâches planifiées</small><b>{plural(schedules.length, "tâche", "tâches")}</b><span>{decl ? `déclarées dans ${decl.path.split("/").slice(-2).join("/")}` : "aucune lue"}</span></div>
        <div className="tile"><small>Files</small><b>{queues.length ? `${plural(queues.length, "file", "files")} : ${queues.map((q) => q.entry.key).join(", ")}` : "aucune file"}</b><span>{queues.map((q) => `${q.node.name}, ${q.onFail}`).join(" ; ") || "aucun consommateur lu"}</span></div>
        <div className="tile"><small>Événements reçus</small><b>{plural(hooks.length, "webhook signé", "webhooks signés")}</b><span>{hooks.map((h) => h.entry.key).join(", ") || "aucun"}</span></div>
        <div className={`tile${twice.length ? " tile--cr" : ""}`}><small>Lancées plusieurs fois</small><b>{twice.length ? (twice.length === schedules.length ? `Les ${schedules.length} tâches` : plural(twice.length, "tâche", "tâches")) : "aucune"}</b><span>{twice.length ? `elles tournent dans ${twice[0]!.node.name}, déployé sur ${twice[0]!.machines} machines` : "chaque tâche part une fois"}</span></div>
      </div>
          <Rep code="T3" name="Horloge" question="Qu'est-ce qui tourne sans personne, et quand ?" sentence={clock} flush
            reads={<>sur une journée de {map.model.system.name} : chaque marque est un passage, une bande pleine un passage si fréquent qu'il remplit la journée ; « ×N », il a lieu sur chaque machine. Choisir une ligne la détaille à droite.</>}>
            <div className="tk__day">
              <div className="tk__dh"><span /><div className="tk__axis"><span style={{ left: 0, transform: "none" }}>0 h</span><span style={{ left: "25%" }}>6 h</span><span style={{ left: "50%" }}>12 h</span><span style={{ left: "75%" }}>18 h</span><span style={{ left: "100%", transform: "translateX(-100%)" }}>24 h</span></div></div>
              {list.map((x) => (
                <button key={x.id} className="tk__dr" onClick={() => setChosen(x.id)}>
                  <div><b>{x.name}</b><small>{x.when}</small></div>
                  <div className="tk__tr">
                    {x.fill && <span className="tk__fill" />}
                    {x.fill && <em className={x.machines > 1 ? "cr" : ""} style={{ right: 6 }}>{x.perDay?.toLocaleString("fr-FR")} fois{x.machines > 1 ? `, ×${x.machines}` : ""}</em>}
                    {!x.fill && x.ticks.map((h, i) => <i key={i} className={x.machines > 1 ? "x2" : ""} style={{ left: `${(h / 24) * 100}%` }} />)}
                    {!x.fill && x.ticks.length > 0 && x.ticks.length < 4 && x.machines > 1 && <em style={{ left: `calc(${(x.ticks[0]! / 24) * 100}% + 14px)` }}>×{x.machines}</em>}
                    {x.kind !== "schedule" && <span className="tk__ondemand">à la demande</span>}
                  </div>
                </button>
              ))}
            </div>
            <div className="lg"><span><i />planifié, heure fixe</span><span><i className="ev" />à la demande</span><span>×N : une fois par machine</span></div>
          </Rep>
          <section className="card">
            <div className="trg trg--h"><span>Déclencheur</span><span>Quand</span><span>Ce qu'il fait</span><span>Si ça rate</span><span>À aller voir</span></div>
            {list.map((x) => (
              <button key={x.id} className={`trg trg--row${x === t ? " trg--on" : ""}`} onClick={() => setChosen(x.id)}>
                <code>{x.name}</code><span>{x.when}</span><span>{x.does}</span><span className={x.onFail.includes("non lu") ? "q" : ""}>{x.onFail}</span>
                <span className={x.seeTone === "cr" ? "see" : "q"}>{x.see ? <Rich text={x.see} /> : "rien"}</span>
              </button>
            ))}
            {list.length === 0 && <p className="foot">Rien ne tourne sans clic sur ce projet, d'après ce qui est lu : aucune tâche planifiée, aucun consommateur de file, aucun webhook signé. Une technologie de planification sans pack resterait invisible ici ; la Vue d'ensemble dit ce qui n'est pas lu.</p>}
          </section>
    </Workspace>
  );
}

function Side({ t, openFlow }: { t: Trigger; openFlow: (id: string) => void }) {
  const [code, setCode] = useState<SourceExcerpt>();
  useEffect(() => { setCode(undefined); api.source(t.entry.proof.path, Math.max(1, t.entry.proof.line - 1), t.entry.proof.line).then(setCode).catch(() => {}); }, [t.id]);
  const steps = (t.entry.flow ?? []).filter((s) => ["read", "write", "message", "request", "refuse"].includes(s.kind)).slice(0, 4);
  const verb: Record<string, string> = { read: "lit", write: "écrit", message: "met en file", request: "appelle", refuse: "refuse" };
  return (
    <aside className="tk__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Déclencheur choisi</span>
          <h2>{t.name}</h2>
          <p className="sub">{t.when}, {t.entry.proof.path.split("/").slice(-2).join("/")}:{t.entry.proof.line}</p>
        </div>
        {code && <div className="ed">{code.lines.map((l, i) => <div key={i} className={code.from + i === t.entry.proof.line ? "hl" : ""}><span>{code.from + i}</span><span>{l}</span></div>)}</div>}
        <button className="vl-btn vl-btn--light vl-btn--sm tk__open" onClick={() => openFlow(t.entry.id)}>Ouvrir son déroulé</button>
        <span className="lbl">Son trajet</span>
        <div className="life">
          {steps.length === 0 && <div className="nlrow"><i /><b>—</b><p>aucun effet lu dans son code</p></div>}
          {steps.map((s, i) => (
            <div key={i} className={i === steps.length - 1 ? "now" : ""}><i /><b>{verb[s.kind]}</b><p>{s.target?.entity ?? s.target?.topic ?? s.target?.node ?? s.name ?? s.code ?? ""}{s.when ? `, si ${s.when}` : ""}<code>{s.proof.path.split("/").pop()}:{s.proof.line}</code></p></div>
          ))}
        </div>
        {t.finding && (
          <div className="race">
            <b>{t.machines > 1 && t.finding.code === "scheduled_on_every_instance" ? `Lancé par chaque copie de ${t.node.name}` : "À aller voir"}</b>
            <p><Rich text={t.finding.message.replace(/^./, (c) => c.toUpperCase())} />.</p>
            <span className="dx__refs">{t.finding.proof.slice(0, 2).map((x, i) => <Ref key={i} proof={x} />)}</span>
          </div>
        )}
      </section>
      <section className="card">
        <div className="hd"><h2>Comment c'est trouvé</h2></div>
        <p className="tk__how">Par les appels aux planificateurs, les consommateurs de file, les routes qu'un service extérieur appelle avec une signature, et le nombre de machines déclaré au déploiement. Chaque pack dit comment sa technologie se lance : un planificateur écrit dans le code tourne dans chaque processus qui le charge, une tâche déclarée au déploiement part une fois par horaire.</p>
      </section>
    </aside>
  );
}
