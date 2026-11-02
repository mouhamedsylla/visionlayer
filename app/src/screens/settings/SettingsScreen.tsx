import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AgentLink } from "../../api/types";
import { AGENT } from "../../model/agents";
import { Face, PERSONAS, ROBOT, setFace, useFace, type Mood } from "../../vigie/Face";
import "./settings.css";

const TABS = ["Agents du projet", "Visage de Vigie", "Modèles Meta", "Outils reliés", "Ce qu'il lit", "Où il écrit"];

/** Planche 40, Réglages des agents : ce qui relie chaque agent à VisionLayer, posé ou retiré d'un clic. */
export function SettingsScreen() {
  const [links, setLinks] = useState<AgentLink[]>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState(0);
  useEffect(() => { api.links().then(setLinks).catch((e) => setError(String(e))); }, []);
  const act = (a: AgentLink, on: boolean) => { setBusy(a.agent); setError(undefined); (on ? api.link : api.unlink)(a.agent).then(setLinks).catch((e) => setError(String(e))).finally(() => setBusy(undefined)); };
  return (
    <div className="page st">
      <div className="st__intro">
        <h1 className="st__title">Les agents qui codent sur ce projet</h1>
        <p className="st__lead">VisionLayer ne lance aucun agent. Il donne la carte aux agents du projet, apprend d'eux ce qu'ils ont touché, et leur demande de déclarer ce qu'ils savent. Chaque lien se pose ici, en un clic, et se retire de même.</p>
      </div>
      <div className="tabs st__tabs">{TABS.map((t, i) => <button key={t} className={`seg${i === tab ? " seg--on" : ""}`} disabled={i > 1} title={i > 1 ? "À venir" : undefined} onClick={() => setTab(i)}>{t}</button>)}</div>
      {tab === 1 ? <Faces /> : <>
      {error && <p className="st__err">{error}</p>}
      <section className="card">
        <div className="st__row st__row--h"><span>Agent</span><span>Sur cette machine</span><span>Lit la carte</span><span>Dit ce qu'il touche</span><span>Déclare ce qu'il sait</span><span /></div>
        {!links ? <p className="st__foot">Lecture des réglages…</p> : links.map((a) => {
          // Relié : tout ce que VisionLayer peut poser pour cet agent est posé.
          const linked = [a.map, a.report, a.contract].filter((c) => c.editable).every((c) => c.linked);
          return (
            <div key={a.agent} className={`st__row${a.installed ? "" : " st__row--off"}`}>
              <span className="st__who"><span className="lx-mg">{AGENT[a.agent].mono}</span><b>{AGENT[a.agent].name}</b></span>
              <span><span className={`mk ${a.installed ? "mk--on" : "mk--sg"}`}>{a.installed ? "installé" : "pas trouvé"}</span></span>
              <Cell c={a.map} on="serveur MCP relié" off="pas relié" />
              <Cell c={a.report} on={a.agent === "muse" ? "par son journal" : "crochets posés"} off="pas relié" />
              <Cell c={a.contract} on="contrat posé" off="pas de contrat" />
              <span className="st__act">
                {!a.installed ? null : linked
                  ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={!!busy} onClick={() => act(a, false)}>{busy === a.agent ? "…" : "Délier"}</button>
                  : <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={!!busy} onClick={() => act(a, true)}>{busy === a.agent ? "…" : "Relier"}</button>}
              </span>
            </div>
          );
        })}
        <p className="st__foot">Relier écrit dans les fichiers de réglage de l'agent, jamais dans le code du projet. Délier les remet exactement comme avant. Muse Code et Claude Code partagent <code>.mcp.json</code> ; Muse Code et Codex partagent <code>AGENTS.md</code>.</p>
      </section>
      <div className="st__body">
        <section className="night st__contract">
          <span className="lbl">Le contrat donné aux agents</span>
          <h2>Lire la carte avant, déclarer après</h2>
          <p className="sub">Une section ajoutée à AGENTS.md et CLAUDE.md, une seule fois, quand tu cliques. Tu la relis avant qu'elle soit écrite.</p>
          <pre className="st__code">{`## VisionLayer
1. Appelle vision_summary d'abord.
2. vision_slice sur les éléments de ta tâche :
   le fichier:ligne de chaque morceau de code utile.
3. Lis ces adresses ; vision_source pour un symbole.
   Pas de recherche large pour t'orienter.
4. Après la modification, vision_reach : dis pour
   chaque constat si ton changement le touche.
5. Dans ta PR, écris dans .vision/knowledge/ ce que
   le code ne dit pas : la règle suivie, la décision.`}</pre>
          <p className="sub">Version française de la section ; les agents la reçoivent en anglais. VisionLayer vérifie ensuite chaque note contre le code. Une note n'est jamais écrite par un modèle à la place de l'agent.</p>
        </section>
        <section className="card">
          <div className="hd"><h2>Ce que VisionLayer reçoit d'une session</h2></div>
          <div className="st__keep">
            <div><span className="vl-label">Gardé</span><p>les chemins des fichiers modifiés dans le projet</p><p>les outils de VisionLayer appelés, et quand</p><p>les compteurs de tokens</p><p>le modèle et la branche</p></div>
            <div><span className="vl-label">Jamais</span><p>le texte d'un prompt</p><p>une commande lancée</p><p>le contenu d'un fichier</p><p>un chemin hors du projet</p></div>
          </div>
          <p className="st__foot">Muse Code garde lui-même son journal sur la machine ; VisionLayer le lit sans le copier. Les crochets de Claude Code et Codex écrivent dans <code>.vision/activity/</code>, qui n'est pas commité.</p>
        </section>
      </div>
      </>}
    </div>
  );
}

const MOODS: [Mood, string][] = [["welcome", "Accueille"], ["think", "Lit ta copie"], ["question", "Questionne"], ["focus", "Concentré"], ["wow", "Épaté"], ["happy", "Content"]];

/** Le visage que prend l'assistant choisi : un portrait dessiné, animé, gardé pour cette personne. */
function Faces() {
  const chosen = useFace();
  const all = [...PERSONAS, ROBOT];
  return (
    <>
      <section className="card st__faces">
        {all.map((p) => (
          <button key={p.id} className={`st__face${chosen === p.id ? " st__face--on" : ""}`} onClick={() => setFace(p.id)} aria-pressed={chosen === p.id}>
            <Face id={p.id} size={96} mood="welcome" />
            <b>{p.name}</b>
            <small>{p.line}</small>
            <span className={`mk ${chosen === p.id ? "mk--on" : "mk--q"}`}>{chosen === p.id ? "choisi" : "choisir"}</span>
          </button>
        ))}
      </section>
      <section className="card">
        <div className="hd"><h2>Ses humeurs</h2></div>
        <div className="st__moods">{MOODS.map(([m, l]) => <div key={m}><Face mood={m} size={72} ring={m === "think"} /><span>{l}</span></div>)}</div>
        <p className="st__foot">Des personnages dessinés, pas des personnes. Derrière chaque visage, c'est le même assistant, Muse Spark : il ne lit que la carte et le code qu'elle cite. Le choix reste sur ce navigateur.</p>
      </section>
    </>
  );
}

function Cell({ c, on, off }: { c: AgentLink["map"]; on: string; off: string }) {
  return <span className="st__cell"><span className={`mk ${c.linked ? "mk--on" : "mk--q"}`}>{c.linked ? on : off}</span><small>{c.where}</small></span>;
}
