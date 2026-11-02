import { useState } from "react";
import type { MapPayload } from "../../api/types";
import { actors, levelsText, plural, reachByResource, type ActorRow } from "../../model/access";
import { Ref } from "../../ui/Ref";
import { EntryRow } from "../block/EntryRow";
import { entryGroups } from "../../model/block";
import "./access.css";

const GROUPS = [["people", "Personnes"], ["outside", "Service extérieur"], ["system", "Le système lui-même"]] as const;

/** Planche 04, Accès par acteur : qui peut entrer, comment il le prouve, ce qu'il atteint. */
export function AccessScreen({ map, openFlow }: { map: MapPayload; openFlow: (id: string) => void }) {
  const a = actors(map);
  const [chosen, setChosen] = useState<string>(a.rows.find((r) => r.id === "authenticated")?.id ?? a.rows[0]?.id ?? "");
  const row = a.rows.find((r) => r.id === chosen) ?? a.rows[0];
  const people = a.rows.filter((r) => r.group === "people" && r.id !== "unknown").length;
  const [tab, setTab] = useState<"actors" | "entries">(people ? "actors" : "entries");
  const allRoutes = map.model.nodes.filter((n) => n.level === "deployable").flatMap((n) => (n.facets.entrypoints ?? []).filter((e) => e.kind === "http" || e.kind === "rpc"));
  const humans = a.rows.filter((r) => r.group === "people").length, outside = a.rows.filter((r) => r.group === "outside").length, system = a.rows.filter((r) => r.group === "system").length;
  return (
    <div className="page ax">
      <div className="ax__intro">
        <h1 className="ax__title">Qui peut entrer, et ce qu'il a le droit d'y faire</h1>
        <p className="ax__lead">Lu dans le code : qui appelle le système, comment chacun prouve qui il est, ce qu'il peut appeler et toucher. Les comptes réels et les rôles attribués en base ne sont pas lus.</p>
      </div>
      <div className="tiles">
        <div className="tile"><small>Qui peut appeler</small><b>{plural(a.total, "point d'entrée", "points d'entrée")}</b><span>{levelsText(a.byLevel)}</span></div>
        <div className="tile"><small>Les acteurs</small><b>{plural(a.rows.length, "acteur", "acteurs")}</b><span>{[humans && plural(humans, "sorte de personne", "sortes de personnes"), outside && plural(outside, "service extérieur", "services extérieurs"), system && plural(system, "tâche du système", "tâches du système")].filter(Boolean).join(", ")}</span></div>
        <div className="tile"><small>Comment on prouve qui on est</small><b>{a.mechanism ? a.mechanism.name : "Non lu"}</b><span>{a.mechanism ? <Ref proof={a.mechanism.proof} /> : "aucun pack ne lit encore la preuve que présente l'appelant"}</span></div>
        <div className="tile tile--cr"><small>Vérifié sur la donnée</small><b>Non lu</b><span>la comparaison entre la donnée et l'appelant n'est pas encore lue</span></div>
      </div>
      <div className="ax__body">
        <section className="card">
          <div className="tabs">
            <button className={`seg${tab === "actors" ? " seg--on" : ""}`} onClick={() => setTab("actors")}>Par acteur <span className="vl-count">{a.rows.length}</span></button>
            <button className={`seg${tab === "entries" ? " seg--on" : ""}`} onClick={() => setTab("entries")}>Par point d'entrée <span className="vl-count">{a.total}</span></button>
            <span className="note">Deux façons de lire la même chose</span>
          </div>
          {tab === "entries" && entryGroups(allRoutes).map((g) => (
            <div key={g.name}><div className="grp">{g.name} <span>{g.entries.length}</span></div>{g.entries.map((e) => <EntryRow key={e.id} e={e} open={() => openFlow(e.id)} />)}</div>
          ))}
          {tab === "actors" && <><div className="ac ac--h"><span>Acteur</span><span>Sa preuve</span><span>Reconnu par</span><span>Routes atteintes</span><span>Sur la donnée</span><span>À aller voir</span></div>
          {GROUPS.map(([g, label]) => {
            const list = a.rows.filter((r) => r.group === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="grp">{label} <span>{g === "system" ? `${list.length}, aucune preuve demandée, accès complet à la base` : list.length}</span></div>
                {list.map((r) => <Actor key={r.id} r={r} on={r.id === row?.id} pick={() => setChosen(r.id)} />)}
              </div>
            );
          })}</>}
        </section>
        {row && <Side map={map} row={row} />}
      </div>
    </div>
  );
}

function Actor({ r, on, pick }: { r: ActorRow; on: boolean; pick: () => void }) {
  return (
    <button className={`ac ac--row${on ? " ac--on" : ""}`} onClick={pick}>
      <span><b>{r.name}</b>{r.note && <small>{r.note}</small>}</span>
      <span className={`pf${r.proofKind ? ` pf--${r.proofKind}` : ""}`}>{r.proof}</span>
      <span className={r.by ? "fn" : "q"}>{r.by?.name ?? "rien"}</span>
      {r.reachText ? <span className="q">{r.reachText}</span> : <span className="reach"><i><b style={{ width: `${Math.round((r.reach / Math.max(1, r.total)) * 100)}%` }} /></i>{r.reach} / {r.total}</span>}
      <span className={r.data === "non lu" ? "nl" : "q"}>{r.data}</span>
      <span className={r.see ? "see" : "q"}>{r.see ?? "rien"}</span>
    </button>
  );
}

function Side({ map, row }: { map: MapPayload; row: ActorRow }) {
  const res = reachByResource(map, row);
  return (
    <aside className="ax__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Acteur choisi</span>
          <h2>{row.name}</h2>
          <p className="sub">{row.by ? <>reconnu par {row.by.name}{row.by.proof && <>, {row.by.proof.path.split("/").pop()}:{row.by.proof.line}</>}</> : row.group === "system" ? "le système lui-même, sans preuve" : "aucune garde"}</p>
        </div>
        <div className="nst">
          <div><b>{row.reachText ? "—" : row.reach}</b><span>routes atteintes</span></div>
          <div><b>—</b><span>vérifiées sur sa donnée, non lu</span></div>
          <div><b>—</b><span>durée de la session, non lue</span></div>
        </div>
        <span className="lbl">Sa preuve, de la naissance au retrait</span>
        <div className="life">
          <div className={row.proofKind ? "" : "nlrow"}><i /><b>présentée</b><p>{row.proof}{map.model.nodes.flatMap((n) => n.facets.trust?.mechanisms ?? [])[0] && <code>{map.model.nodes.flatMap((n) => n.facets.trust?.mechanisms ?? [])[0]!.proof.path}:{map.model.nodes.flatMap((n) => n.facets.trust?.mechanisms ?? [])[0]!.proof.line}</code>}</p></div>
          <div className={row.by ? "now" : "nlrow"}><i /><b>relue</b><p>{row.by ? `à chaque appel, par ${row.by.name}` : "par aucune garde"}{row.by?.proof && <code>{row.by.proof.path}:{row.by.proof.line}</code>}</p></div>
          <div className="nlrow"><i /><b>obtenue, expire, retirée</b><p>non lu : aucun pack ne lit encore la vie de la preuve</p></div>
        </div>
        {row.see && <div className="warn">{row.see.replace(/^./, (c) => c.toUpperCase())}.{row.seeProof && <> <Ref proof={row.seeProof} /></>}</div>}
      </section>
      {res.length > 0 && (
        <section className="card">
          <div className="hd"><h2>Ce qu'il atteint</h2><span>{row.reach} sur {row.total}</span></div>
          {res.map((r) => (
            <div key={r.name} className={`res${r.danger ? " res--cr" : ""}`}>
              <span className="fn">{r.name}</span>
              {r.danger ? <span className="mk mk--cr">sans rôle</span> : <span />}
              <span className="reach"><i><b style={{ width: `${Math.round((r.reached / r.of) * 100)}%`, ...(r.danger ? { background: "var(--critical)" } : {}) }} /></i></span>
              <span>{r.reached} / {r.of}</span>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}
