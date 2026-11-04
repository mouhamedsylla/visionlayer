import type { KnowledgePayload, MapPayload } from "../../api/types";
import { readers } from "../../model/data";
import { tableView, type Said } from "../../model/table";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { Workspace } from "../../ui/Workspace";
import { Lifecycle } from "./Lifecycle";
import { Race } from "./Race";
import { races } from "../../model/race";
import { lineageFields } from "../../model/lineage";
import { Lineage } from "./Lineage";
import "./data.css";
import "../flow/flow.css";

const STATE: Record<string, { label: string; tone: string }> = {
  verified: { label: "tient", tone: "ok" }, current: { label: "en vigueur", tone: "q" }, stale: { label: "à reconfirmer", tone: "sg" },
  contradicted: { label: "contredite", tone: "cr" }, orphan: { label: "code introuvable", tone: "sg" }, unanchored: { label: "sans code", tone: "q" },
};

type Tab = "colonnes" | "etats" | "routes" | "lignee" | "constats" | "regles";

/** Planche 05b, une table : une page, un onglet à la fois. Un déroulé n'est jamais répété ici : l'onglet Routes y mène. */
export function TableScreen({ map, store, entity, knowledge, tab, openTab, back, backLabel, openFlow }: {
  map: MapPayload; store: Parameters<typeof tableView>[1]; entity: Parameters<typeof tableView>[2]; knowledge?: KnowledgePayload;
  tab?: string; openTab: (tab: string) => void; back: () => void; backLabel?: string; openFlow: (id: string) => void;
}) {
  const v = tableView(map, store, entity, knowledge);
  const status = entity.fields?.find((f) => f.values?.length);
  const fields = entity.fields ?? [];
  const reading = readers(map, store, entity);
  const lineage = lineageFields(map, entity);
  const raceList = races(entity, v.watch);
  const tabs: { id: Tab; label: string; n?: number; on: boolean; cr?: boolean }[] = [
    { id: "colonnes", label: "Colonnes", n: fields.length, on: true },
    { id: "etats", label: "États", ...(status ? { n: status.values!.length } : {}), on: !!status },
    { id: "routes", label: "Routes", n: v.writers.length + reading.length, on: true },
    { id: "lignee", label: "Lignée", on: lineage.length > 0 },
    { id: "constats", label: "Constats", n: v.watch.length, on: v.watch.length > 0, cr: true },
    { id: "regles", label: "Règles", n: v.said.length, on: v.said.length > 0 },
  ];
  const shown = tabs.filter((t) => t.on);
  const current = shown.find((t) => t.id === tab)?.id ?? "colonnes";
  return (
    <Workspace
      head={<div className="tb5__top">
        <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ {backLabel ?? "Données"}</button>
        <h1 className="tb5__name">{entity.name}</h1>
        <span className="vl-tag vl-tag--neutral">{store.name}</span>
        {entity.proof && <span className="tb5__where"><Ref proof={entity.proof} /></span>}
      </div>}>
      <section className="card">
        <div className="tabs">{shown.map((t) => <button key={t.id} className={`seg${t.id === current ? " seg--on" : ""}`} onClick={() => openTab(t.id)}>{t.label}{t.n !== undefined && <span className={`vl-count${t.cr ? " vl-count--critical" : ""}`}>{t.n}</span>}</button>)}</div>
        {current === "colonnes" && <>
          <div className="tb6 tb6--h"><span>Colonne</span><span>Type</span><span>Null</span><span>Défaut</span><span>Écritures</span><span>Lectures</span><span>Commentaire</span><span>Ligne</span></div>
          {fields.map((f) => <div key={f.name} className="tb6"><code>{f.name}</code><code>{f.type ?? ""}</code><span>{f.nullable ? "oui" : "non"}</span><code>{f.default ?? ""}</code><span>{f.writes?.length ?? 0}</span><span>{f.reads?.length ?? 0}</span><small>{f.comment ?? ""}</small>{f.proof ? <Ref proof={f.proof} /> : <span />}</div>)}
          {fields.length === 0 && <p className="foot"><span className="mk mk--nl">non lu</span> colonnes</p>}
          {v.base.length > 0 && <><div className="hd"><h2>Contraintes</h2><span>{v.base.length}</span></div>{v.base.map((g, i) => <div key={i} className="tb5__g"><span><Rich text={g.text} /></span><Ref proof={g.proof} /></div>)}</>}
        </>}
        {current === "etats" && (v.life ? <Lifecycle name={entity.name} life={v.life} /> : <div className="tb5__states">{status?.values?.map((x) => <code key={x} className="vl-code">{x}</code>)}</div>)}
        {current === "routes" && <>
          <div className="tb7 tb7--h"><span>Point d'entrée</span><span>Accès</span><span>Valeur écrite</span></div>
          {v.writers.map((w) => <button key={w.id} className="tb7" onClick={() => openFlow(w.id)}><code>{w.key}</code><span className={`mk ${w.danger ? "mk--cr" : "mk--q"}`}>write</span><code>{w.verb.startsWith("pose ") ? w.verb.slice(5) : ""}</code></button>)}
          {reading.map((r) => <button key={r.id} className="tb7" onClick={() => openFlow(r.id)}><code>{r.key}</code><span className="mk mk--q">read</span><span /></button>)}
        </>}
        {current === "lignee" && <Lineage table={entity.name} list={lineage} openFlow={openFlow} />}
        {current === "constats" && <>
          {v.watch.map((f, i) => <div key={i} className="tb5__g"><span><Rich text={f.message} /></span><span className="dx__refs">{f.proof.slice(0, 2).map((p, k) => <Ref key={k} proof={p} />)}</span></div>)}
          {raceList.map((r, i) => <Race key={i} race={r} />)}
        </>}
        {current === "regles" && <div className="tb5__said">{v.said.map((x, i) => <SaidRow key={i} s={x} />)}</div>}
      </section>
    </Workspace>
  );
}

function SaidRow({ s }: { s: Said }) {
  const st = s.state ? STATE[s.state] : undefined;
  return (
    <div className="tb5__row">
      <div className={`tb5__quote${s.who === "agent" ? " tb5__quote--agent" : ""}`}>
        <span className="vl-label">{s.who === "agent" ? `Déclaré par un agent${s.type ? `, ${s.type}` : ""}` : `Commentaire de l'auteur${s.about ? `, sur ${s.about}` : ""}`}</span>
        <p>« {s.text} »</p>
      </div>
      <span className={`mk mk--${st?.tone ?? "q"}`}>{st?.label ?? "dit, non vérifié"}</span>
      {s.proof ? <Ref proof={s.proof} /> : <span />}
    </div>
  );
}
