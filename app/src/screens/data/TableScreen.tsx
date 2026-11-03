import { useState } from "react";
import type { KnowledgePayload, MapPayload } from "../../api/types";
import { findEntry, flowView } from "../../model/flow";
import { tableView, type Said } from "../../model/table";
import { Entry } from "../../lang/objects";
import { Rep } from "../../lang/Rep";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { Workspace } from "../../ui/Workspace";
import { plural } from "../../model/words";
import { FlowLanes } from "../flow/FlowLanes";
import { Lifecycle } from "./Lifecycle";
import { Race } from "./Race";
import { races } from "../../model/race";
import "./data.css";
import "../flow/flow.css";

const STATE: Record<string, { label: string; tone: string }> = {
  verified: { label: "tient", tone: "ok" }, current: { label: "en vigueur", tone: "q" }, stale: { label: "à reconfirmer", tone: "sg" },
  contradicted: { label: "contredite", tone: "cr" }, orphan: { label: "code introuvable", tone: "sg" }, unanchored: { label: "sans code", tone: "q" },
};

/** Planche 05b, Données, une table : ce qu'elle veut dire. Qui la fait naître et la change, ses états, ce qui en est dit, ce que la base garantit. */
export function TableScreen({ map, store, entity, knowledge, back, backLabel, openFlow }: {
  map: MapPayload; store: Parameters<typeof tableView>[1]; entity: Parameters<typeof tableView>[2]; knowledge?: KnowledgePayload;
  back: () => void; backLabel?: string; openFlow: (id: string) => void;
}) {
  const v = tableView(map, store, entity, knowledge);
  const [open, setOpen] = useState<Set<string>>(() => new Set(v.writers.slice(0, 1).map((w) => w.id)));
  const status = entity.fields?.find((f) => f.values?.length);
  const author = v.said.filter((s) => s.who === "author");
  const agents = v.said.filter((s) => s.who === "agent");
  return (
    <Workspace panelWidth={380}
      head={<div className="tb5__head">
        <div className="tb5__top">
          <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ {backLabel ?? "Données"}</button>
          <span className="tb5__where">table de {store.name}{entity.proof ? <>, <Ref proof={entity.proof} /></> : null}</span>
        </div>
        <h1 className="tb5__name">{entity.name}</h1>
        <p className="dx__lead"><Rich text={v.sentence} /></p>
      </div>}
      panel={<div className="dx__side">
        <section className="night">
          <div className="ax__nhead">
            <span className="lbl">Sa forme</span>
            <h2 className="tb5__mono">{entity.name}</h2>
            <p className="sub">{plural(entity.fields?.length ?? 0, "champ", "champs")} ; en italique, ce qu'en dit l'auteur</p>
          </div>
          <div className="tb5__fields">
            {(entity.fields ?? []).map((f) => (
              <div key={f.name} className="tb5__field">
                <code>{f.name}</code>
                <span>{[f.type, f.nullable ? "facultatif" : "", f.values ? `${f.values.length} états` : "", f.default !== undefined ? `${f.default} par défaut` : ""].filter(Boolean).join(", ")}{f.comment ? <em> ; « {f.comment} »</em> : null}</span>
              </div>
            ))}
            {!entity.fields?.length && <p className="sub">Aucun champ lu : le pack de cette technologie ne lit pas le schéma.</p>}
          </div>
        </section>
        <section className="card">
          <div className="hd"><h2>Ce que la base garantit</h2><span>{plural(v.base.length, "règle", "règles")}</span></div>
          {v.base.map((g, i) => <div key={i} className="tb5__g"><span><Rich text={g.text} /></span><Ref proof={g.proof} /></div>)}
          {v.base.length === 0 && <p className="foot">Aucune contrainte lue sur cette table, en dehors de sa clé.</p>}
        </section>
        {v.watch.length > 0 && (
          <section className="card tb5__watch">
            <div className="hd"><h2>Ce que rien ne garantit</h2><span>{plural(v.watch.length, "constat", "constats")}</span></div>
            {v.watch.map((f, i) => <div key={i} className="tb5__g"><span><Rich text={f.message.replace(/^./, (c) => c.toUpperCase())} /></span><span className="dx__refs">{f.proof.slice(0, 2).map((p, k) => <Ref key={k} proof={p} />)}</span></div>)}
          </section>
        )}
      </div>}>
      <div className="tiles">
        <div className="tile"><small>Ses états</small><b>{status ? plural(status.values!.length, "état", "états") : "aucun"}</b><span>{v.life?.open.proofs.length ? "une valeur calculée : aucune règle de passage lue" : status ? `champ ${status.name}` : "aucun champ énuméré"}</span></div>
        <div className="tile"><small>Qui l'écrit</small><b>{plural(v.writers.length, "point d'entrée", "points d'entrée")}</b><span>{v.writers.slice(0, 2).map((w) => w.key).join(", ") || "aucun lu"}</span></div>
        <div className="tile"><small>Ce qui en est dit</small><b>{plural(v.said.length, "phrase", "phrases")}</b><span>{plural(author.length, "commentaire de l'auteur", "commentaires de l'auteur")}, {plural(agents.length, "déclaration d'agent", "déclarations d'agents")}</span></div>
        <div className={`tile${v.watch.length ? " tile--cr" : ""}`}><small>À aller voir</small><b>{v.watch.length ? plural(v.watch.length, "constat", "constats") : "rien"}</b><span>{v.watch[0] ? <Rich text={v.watch[0].message.split(" : ")[0]!} /> : "aucun constat sur cette table"}</span></div>
      </div>

      <Rep code="F1" name={`Comment ${entity.name} circule`} question="Qui la fait naître, qui la change, et ce qui part avec elle ?" flush
        sentence={v.writers.length ? `${plural(v.writers.length, "point d'entrée l'écrit", "points d'entrée l'écrivent")} ; ${plural(v.readers, "autre la lit", "autres la lisent")}.` : "Aucun point d'entrée lu ne l'écrit."}
        reads="de haut en bas, le déroulé de chaque point d'entrée qui l'écrit. Épaisse, une écriture ; rouge, une lecture qu'un constat met en cause ; le cadre pointillé entoure ce qu'une transaction protège.">
        {v.writers.map((w) => {
          const found = findEntry(map, w.id);
          if (!found) return null;
          const on = open.has(w.id);
          return (
            <div key={w.id} className="tb5__flow">
              <div className="tb5__fhead">
                <button className="tb5__toggle" onClick={() => setOpen((s) => { const x = new Set(s); x.has(w.id) ? x.delete(w.id) : x.add(w.id); return x; })}>{on ? "▾" : "▸"}</button>
                <Entry e={found.entry} />
                <span className={`mk ${w.danger ? "mk--cr" : "mk--q"}`}>{w.verb}</span>
                <button className="vl-btn vl-btn--ghost vl-btn--sm tb5__open" onClick={() => openFlow(w.id)}>Ouvrir son déroulé</button>
              </div>
              {on && <FlowLanes v={flowView(map, found.entry, found.owner)} />}
            </div>
          );
        })}
      </Rep>

      {races(entity, v.watch).map((r, i) => <Race key={i} race={r} />)}

      {v.life && <Lifecycle name={entity.name} life={v.life} />}

      <Rep code="C4" name="Ce qui en est dit" question="Ce que l'auteur et les agents ont déclaré tient-il ?"
        sentence={v.said.length ? `${plural(author.length, "commentaire de l'auteur", "commentaires de l'auteur")} lu${author.length > 1 ? "s" : ""} dans le code ; ${agents.length ? plural(agents.length, "déclaration d'agent", "déclarations d'agents") : "aucun agent n'a rien déclaré sur elle"}.` : "Rien n'est dit de cette table : ni commentaire de l'auteur, ni déclaration d'agent."}
        reads="de gauche à droite : ce qui est dit, et par qui ; son état. À filet plein, un agent, confronté au code ; en pointillé, un commentaire de l'auteur, lu tel qu'il est écrit.">
        <div className="tb5__said">
          {[...agents, ...author].map((s, i) => <SaidRow key={i} s={s} />)}
        </div>
      </Rep>
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
