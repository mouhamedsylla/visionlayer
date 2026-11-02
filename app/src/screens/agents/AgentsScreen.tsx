import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AgentSession, MapPayload } from "../../api/types";
import { AGENT, agentTiles, MAP_STATE, mapState, overlaps, tokens, total, touched } from "../../model/agents";
import { plural } from "../../model/words";
import { Component } from "../../lang/objects";
import { Ref } from "../../ui/Ref";
import { Workspace } from "../../ui/Workspace";
import "./agents.css";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Planche 13, Sessions d'agents : qui travaille sur le projet, sur quoi, pour combien. VisionLayer ne lance aucun agent. */
export function AgentsScreen({ map, enter }: { map: MapPayload; enter: (blockId: string) => void }) {
  const [list, setList] = useState<AgentSession[]>();
  const [error, setError] = useState<string>();
  const [chosen, setChosen] = useState<string>();
  useEffect(() => { api.agents().then(setList).catch((e) => setError(String(e))); }, []);
  const s = list?.find((x) => x.id === chosen) ?? list?.[0];
  const ov = list ? overlaps(list) : new Map();
  return (
    <Workspace
      head={<div className="ag__intro">
        <h1 className="ag__title">Qui travaille sur le projet, sur quoi, et pour combien</h1>
        <p className="ag__lead">Reçu des agents eux-mêmes : les fichiers modifiés, les lectures de la carte et les compteurs de tokens. Jamais un prompt, une commande ni le contenu d'un fichier. VisionLayer ne lance aucun agent.</p>
      </div>}
      panel={s && <Side map={map} s={s} others={[...ov].filter(([f]) => s.writes.includes(f)).map(([f, l]) => ({ file: f, with: l.filter((x: AgentSession) => x !== s) }))} enter={enter} />}>
      {error ? <p className="ag__empty">Les sessions n'ont pas pu être lues : {error}</p>
        : !list ? <p className="ag__empty">Lecture des journaux des agents…</p>
        : !list.length ? <Empty />
        : <>
          <div className="tiles">{agentTiles(list).map((t) => <div key={t.label} className={`tile${t.tone ? ` tile--${t.tone}` : ""}`}><small>{t.label}</small><b>{t.value}</b><span>{t.note}</span></div>)}</div>
          <section className="card">
            <div className="ag__row ag__row--h"><span>Agent</span><span>Branche</span><span>État</span><span>Fichiers écrits</span><span>Tokens</span><span>Carte</span></div>
            {list.map((x) => {
              const st = mapState(x);
              return (
                <button key={x.id} className={`ag__row${x === s ? " is-on" : ""}`} onClick={() => setChosen(x.id)}>
                  <span className="ag__who"><span className="lx-mg">{AGENT[x.agent].mono}</span><span><b>{AGENT[x.agent].name}</b><small>{x.model ?? "modèle non dit"}</small></span></span>
                  <span className="mono">{x.branch ?? "non dite"}</span>
                  <span>{x.ended ? "terminée" : "en cours"}<small>{DATE.format(new Date(x.started))}</small></span>
                  <span>{plural(x.writes.length, "fichier", "fichiers")}{x.writes.some((f) => ov.has(f)) && <small className="ag__cr">un fichier aussi écrit ailleurs</small>}</span>
                  <span className="mono ag__num">{tokens(total(x))}</span>
                  <span><span className={`mk mk--${st}`}>{MAP_STATE[st]}</span></span>
                </button>
              );
            })}
            <p className="ag__foot">{[...new Set(list.map((x) => x.source))].join(", ")}.</p>
          </section>
        </>}
    </Workspace>
  );
}

/** Aucun agent n'a consigné de session sur ce dépôt : dire comment en brancher un. */
function Empty() {
  return (
    <div className="ag__none">
      <b>Aucune session d'agent n'est consignée sur ce dépôt.</b>
      <p>Muse Code tient lui-même le journal de ses sessions : il apparaît ici dès qu'il travaille dans ce dossier. Claude Code et Codex passent par les crochets de VisionLayer (<code>vision hook claude</code>, <code>vision hook codex</code>).</p>
    </div>
  );
}

function Side({ map, s, others, enter }: { map: MapPayload; s: AgentSession; others: { file: string; with: AgentSession[] }[]; enter: (id: string) => void }) {
  const st = mapState(s);
  const t = s.tokens, fresh = Math.max(0, t.input - t.cached), sum = Math.max(1, t.input + t.output);
  const reads = new Map<string, { n: number; before: number }>();
  for (const r of s.mapReads) { const x = reads.get(r.tool) ?? { n: 0, before: 0 }; x.n++; if (r.beforeFirstWrite) x.before++; reads.set(r.tool, x); }
  const where = touched(map, s);
  return (
    <div className="ag__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Session choisie</span>
          <h2>{AGENT[s.agent].name}{s.branch ? `, ${s.branch}` : ""}</h2>
          <p className="sub">{s.model ?? "modèle non dit"}, {DATE.format(new Date(s.started))}{s.ended ? `, ${Math.max(1, Math.round((Date.parse(s.ended) - Date.parse(s.started)) / 60000))} min` : ", en cours"}, {plural(s.calls, "appel au modèle", "appels au modèle")}</p>
        </div>
        <span className="lbl">A-t-il lu la carte avant d'écrire ?</span>
        {reads.size ? <div className="ag__reads">{[...reads].map(([tool, x]) => <div key={tool}><code>{tool}</code><span>{x.n}{x.before ? `, ${x.before === x.n ? "toutes" : x.before} avant la 1re écriture` : ", après la 1re écriture"}</span></div>)}</div>
          : <p className="sub">{st === "none" ? "Il n'a ni lu la carte ni écrit." : "Non : aucun outil de la carte appelé. Il a exploré le code lui-même."}</p>}
        <span className="lbl">Tokens de la session, {tokens(t.input + t.output)}</span>
        <div className="ag__bar">
          <i style={{ flex: t.cached / sum }} title="relus depuis le cache" />
          <i className="f" style={{ flex: fresh / sum }} title="entrée hors cache" />
          <i className="o" style={{ flex: t.output / sum }} title="sortie" />
        </div>
        <div className="ag__legend">
          <div><b>{tokens(t.cached)}</b><span>cache relu</span></div>
          <div><b>{tokens(fresh)}</b><span>entrée neuve</span></div>
          <div><b>{tokens(t.output)}</b><span>sortie</span></div>
          <div><b>{tokens(t.reasoning)}</b><span>dont raisonnement</span></div>
        </div>
        {others.length > 0 && (
          <div className="race">
            <b>Chevauchement</b>
            <p>{others.map((o) => `${o.file.split("/").slice(-2).join("/")} est aussi écrit par ${o.with.map((w) => `${AGENT[w.agent].name}${w.branch ? ` (${w.branch})` : ""}`).join(", ")}`).join(" ; ")}.</p>
          </div>
        )}
      </section>
      <section className="card">
        <div className="hd"><h2>Ce qu'il a touché</h2><span>{where.length ? `${plural(s.writes.length, "fichier", "fichiers")}, ${plural(where.length, "module", "modules")}` : "rien d'écrit"}</span></div>
        <div className="ag__where">
          {where.map((w, i) => (
            <div key={i} className="ag__mod">
              {w.module ? <Component name={w.module.name} onClick={() => w.block && enter(w.block.id)}><small className="ag__blk">{w.block ? `dans ${w.block.name}` : ""}</small></Component> : <span className="ag__out">{w.block ? w.block.name : "pas encore sur la carte : nouveau, ou hors du code lu"}</span>}
              {w.files.map((f) => <Ref key={f} proof={{ path: f, line: 1 }} />)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
