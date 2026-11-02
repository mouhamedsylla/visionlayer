import { useEffect, useState } from "react";
import { api, type ReplayView } from "../../api/client";
import type { AgentSession, Replay, ReplayTest, VigieAnswer } from "../../api/types";
import { AGENT } from "../../model/agents";
import { Answer } from "../../vigie/Vigie";
import { Rich } from "../../ui/Rich";
import { CodeRef } from "../../ui/CodeRef";
import { useOpenCode } from "../../ui/code";
import "./replay.css";

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const score = (t: ReplayTest[]) => `${t.filter((x) => x.ok).length} sur ${t.length}`;

/** Les Replays : la salle, puis un Replay de son briefing à la confrontation. */
export function ReplaysScreen({ item, open }: { item?: string; open: (id?: string) => void }) {
  return item ? <ReplayPage id={item} back={() => open()} /> : <Room open={open} />;
}

/** La salle : les Replays gardés, et les sessions d'agents qu'on peut garder. */
function Room({ open }: { open: (id: string) => void }) {
  const [list, setList] = useState<Replay[]>();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => { api.replays().then(setList).catch((e) => setError(String(e))); api.agents().then(setSessions).catch(() => {}); }, []);
  const kept = new Set(list?.map((r) => r.agent.session));
  const keepable = sessions.filter((s) => !kept.has(s.id) && s.writes.some((f) => /(\.|_)(spec|test)\./.test(f)) && s.writes.some((f) => !/(\.|_)(spec|test)\./.test(f)));
  const keep = (s: AgentSession) => { setBusy(s.id); setError(undefined); api.keepReplay(s.id).then((r) => open(r.id)).catch((e) => setError(String(e.message ?? e))).finally(() => setBusy(undefined)); };
  return (
    <div className="page rp">
      <div className="rp__intro">
        <h1 className="rp__title">Replays</h1>
        <p className="rp__lead">Les vrais problèmes que tes agents ont rencontrés, gardés tels qu'ils étaient. Tu y retournes quand tu veux. La solution de l'agent reste cachée jusqu'au bout. Ni série, ni classement.</p>
      </div>
      {error && <p className="rp__err">{error}</p>}
      <div className="rp__grid">
        {list?.map((r) => (
          <button key={r.id} className="rp__card" onClick={() => open(r.id)}>
            <span className="vl-tag vl-tag--neutral">{r.finding ? "Course" : "Bug"}{r.submitted ? ", rejoué" : r.copy ? ", en cours" : ""}</span>
            <b><Rich text={r.title} /></b>
            <small>{r.agent.name}, le {DAY.format(new Date(r.agent.at))} ; {r.tests.length} test{r.tests.length > 1 ? "s" : ""}, {score(r.before)} passent avant</small>
            <span className="rp__go">{r.submitted ? "Revoir la confrontation ›" : r.copy ? "Reprendre ›" : "Commencer ›"}</span>
          </button>
        ))}
        {list && !list.length && <p className="rp__none">Aucun Replay gardé. Un Replay naît d'une session d'agent qui a écrit un test et un correctif.</p>}
      </div>
      {keepable.length > 0 && (
        <section className="card">
          <div className="hd"><h2>Sessions à garder en Replay</h2><span>elles ont écrit un test et du code</span></div>
          {keepable.map((s) => (
            <div key={s.id} className="rp__keep">
              <span className="lx-mg">{AGENT[s.agent].mono}</span>
              <span><b>{AGENT[s.agent].name}{s.branch ? `, ${s.branch}` : ""}</b><small>{DAY.format(new Date(s.started))}, {s.writes.join(", ")}</small></span>
              <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={!!busy} onClick={() => keep(s)}>{busy === s.id ? "Préparation…" : "Garder ce moment"}</button>
            </div>
          ))}
          <p className="rp__foot">Garder : VisionLayer retrouve le code d'avant le correctif, lit le constat sur ce code, puis lance le test de l'agent avant et après. Rien n'est envoyé à un modèle.</p>
        </section>
      )}
    </div>
  );
}

function ReplayPage({ id, back }: { id: string; back: () => void }) {
  const [r, setR] = useState<ReplayView>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  useEffect(() => { api.replay(id).then(setR).catch((e) => setError(String(e))); }, [id]);
  const run = <T,>(what: string, p: Promise<T>, then: (x: T) => void) => { setBusy(what); setError(undefined); p.then(then).catch((e) => setError(String(e.message ?? e))).finally(() => setBusy(undefined)); };
  if (!r) return <div className="page"><p className="rp__lead">{error ?? "Lecture du Replay…"}</p></div>;
  const stage = r.submitted ? "Confrontation" : r.copy ? "En jeu" : "Briefing";
  return (
    <div className="page rp">
      <div className="rp__crumbs"><button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={back}>‹ Replays</button><span className="mono">#{r.id.slice(2)}</span><ol className="rp__steps">{["Briefing", "En jeu", "Confrontation"].map((s) => <li key={s} className={s === stage ? "is-on" : ""}>{s}</li>)}</ol></div>
      {error && <p className="rp__err">{error}</p>}
      {stage === "Briefing" && <Briefing r={r} start={() => run("start", api.startReplay(id), setR)} busy={busy === "start"} />}
      {stage === "En jeu" && <Play r={r} busy={busy} test={() => run("test", api.testReplay(id), (last) => setR({ ...r, last }))} submit={() => run("submit", api.submitReplay(id), setR)} />}
      {stage === "Confrontation" && <Confront r={r} />}
      {stage === "Confrontation" && <div className="rp__actions"><button className="vl-btn vl-btn--secondary" disabled={!!busy} onClick={() => run("reset", api.resetReplay(id), setR)}>Rejouer depuis le début</button></div>}
    </div>
  );
}

function Briefing({ r, start, busy }: { r: ReplayView; start: () => void; busy: boolean }) {
  const open = useOpenCode();
  return (
    <>
      <section className="rp__hero">
        <div className="rp__heromain">
          <span className="vl-tag vl-tag--night">{r.finding ? "Course" : "Bug"}, rencontrée le {DAY.format(new Date(r.agent.at))} par {r.agent.name}</span>
          <h1><Rich text={r.title} /></h1>
          <p>{r.brief}</p>
          <div className="rp__vigie"><span className="vg__face"><i /><i /></span><p>Je connais tout le contexte, sauf la réponse. Demande-moi un indice quand tu veux : il y en a trois, du plus vague au plus précis.</p></div>
          <button className="vl-btn vl-btn--light" onClick={start} disabled={busy}>{busy ? "Ouverture de ta copie…" : "Commencer le replay"}</button>
          <small>Ta copie s'ouvre à part, dans ton éditeur ou un terminal. Ton projet n'est pas touché.</small>
        </div>
        <div className="rp__heroside">
          <span className="lbl">Ce que l'agent a vécu</span>
          <ol className="rp__time">
            {r.timeline.map((t, i) => <li key={i}><span className="mono">{TIME.format(new Date(t.at))}</span><b>{t.what === "map" ? "Lit la carte" : "Écrit"}</b><small>{t.what === "map" ? t.detail : t.detail.split("/").slice(-2).join("/")}</small></li>)}
            <li className="is-you"><span className="mono">{r.base.slice(0, 7)}</span><b>À toi</b><small>le code est remis à cet instant</small></li>
            <li className="is-hidden"><span className="mono">…</span><b>La suite</b><small>cachée jusqu'à ta solution</small></li>
          </ol>
        </div>
      </section>
      <div className="rp__two">
        <section className="card">
          <div className="hd"><h2>Le test qui échoue</h2><span>{score(r.before)} passent sur le code d'avant</span></div>
          <Tests list={r.before} />
          {r.finding && <p className="rp__foot">Le constat de VisionLayer sur ce code : <Rich text={r.finding.message} />. {r.finding.proof.slice(0, 3).map((p, i) => <CodeRef key={i} proof={p} onOpen={open} />)}</p>}
        </section>
        <section className="card">
          <div className="hd"><h2>Dans la boîte</h2></div>
          <div className="rp__box">
            <span className="vl-label">Code</span><span>le dépôt au commit <code>{r.base.slice(0, 7)}</code>, juste avant le correctif</span>
            <span className="vl-label">Tests</span><span>{r.tests.map((t) => <code key={t}>{t}</code>)}, écrit par l'agent</span>
            <span className="vl-label">Avec son correctif</span><span>{score(r.agentResult)} passent</span>
          </div>
        </section>
      </div>
    </>
  );
}

function Play({ r, busy, test, submit }: { r: ReplayView; busy?: string; test: () => void; submit: () => void }) {
  const [turns, setTurns] = useState<{ q: string; a?: VigieAnswer; error?: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const hints = turns.filter((t) => /^Indice \d/.test(t.q) && t.a).length;
  const ask = (a: { q?: string; hint?: number }) => {
    const q = a.hint ? `Indice ${a.hint} sur 3` : a.q!;
    setAsking(true); setDraft(""); setTurns((t) => [...t, { q }]);
    api.askReplay(r.id, a).then((ans) => setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, a: ans } : x)))
      .catch((e) => setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, error: String(e.message ?? e) } : x))).finally(() => setAsking(false));
  };
  const last = r.last ?? r.before;
  return (
    <div className="rp__play">
      <div className="rp__left">
        <section className="card">
          <div className="hd"><h2>Ta copie</h2><span>le code d'avant, et le test de l'agent</span></div>
          <div className="rp__copy">
            <code>{r.copy}</code>
            <div className="rp__copyact">
              <a className="vl-btn vl-btn--secondary vl-btn--sm" href={`vscode://file${r.copy}`}>Ouvrir dans VS Code</a>
              <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => navigator.clipboard?.writeText(`cd ${r.copy}`)}>Copier « cd » pour un terminal</button>
            </div>
            <p className="rp__foot">Le problème est dans <code>{r.fixFiles.join(", ")}</code> d'après le constat. Corrige dans ton éditeur, puis lance les tests ici.</p>
          </div>
        </section>
        <section className="card">
          <div className="hd"><h2>Les tests</h2><span>{score(last)}{r.last ? "" : ", sur le code d'avant"}</span></div>
          <Tests list={last} />
          <div className="rp__actions">
            <button className="vl-btn vl-btn--secondary" onClick={test} disabled={!!busy}>{busy === "test" ? "Les tests tournent…" : "Lancer les tests"}</button>
            <button className="vl-btn vl-btn--primary" onClick={submit} disabled={!!busy}>{busy === "submit" ? "Comparaison en cours…" : "Rendre ma solution"}</button>
          </div>
          <p className="rp__foot">Rendre révèle la solution de l'agent et compare les deux. Tu peux rendre même si un test échoue.</p>
        </section>
      </div>
      <aside className="rp__coach">
        <header><span className="vg__face"><i /><i /></span><span><b>Vigie</b><small>connaît le problème et ta copie, pas la solution</small></span></header>
        <div className="rp__coachbody">
          {turns.length === 0 && <p className="rp__coachhi">Dis-moi où tu en es, ou demande un indice. Je ne t'écrirai pas la solution, même si tu insistes.</p>}
          {turns.map((t, i) => <div key={i} className="vg__turn"><p className="vg__q">{t.q}</p>{t.error ? <p className="vg__err">{t.error}</p> : !t.a ? <p className="vg__wait">Vigie lit ta copie…</p> : <Answer a={t.a} />}</div>)}
        </div>
        <div className="rp__hints">{[1, 2, 3].map((n) => <button key={n} className="vg__ex" disabled={asking || n !== hints + 1} onClick={() => ask({ hint: n })}>Indice {n}{n === 1 ? ", le plus vague" : n === 3 ? ", le plus précis" : ""}</button>)}</div>
        <form className="vg__ask" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) ask({ q: draft }); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Et si deux instances lancent la tâche ensemble ?" disabled={asking} />
          <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={asking || !draft.trim()}>Demander</button>
        </form>
      </aside>
    </div>
  );
}

function Confront({ r }: { r: ReplayView }) {
  const c = r.comparison, you = r.submitted!.result;
  return (
    <>
      <section className="rp__hero rp__hero--c">
        <div className="rp__heromain">
          <span className="vl-tag vl-tag--night">Deux solutions au même problème</span>
          <h1>{c ? <Rich text={c.sentence} /> : "La comparaison n'a pas pu être écrite."}</h1>
        </div>
        <div className="rp__scores">
          <div><b>{score(you)}</b><span>tes tests</span></div>
          <div><b>{score(r.agentResult)}</b><span>avec la solution de {r.agent.name}</span></div>
        </div>
      </section>
      <div className="rp__two">
        <Side who={`${r.agent.name}, le ${DAY.format(new Date(r.agent.at))}`} mono={r.agent.name.split(" ").map((w) => w[0]).join("")} text={c?.agent} diff={r.agentPatch ?? ""} />
        <Side who="Toi, aujourd'hui" mono="TOI" text={c?.you} diff={r.yourDiff ?? ""} />
      </div>
      {c && (
        <section className="card">
          <div className="rp__row rp__row--h"><span>La situation</span><span>{r.agent.name}</span><span>Toi</span></div>
          {c.rows.map((x, i) => <div key={i} className="rp__row"><span><Rich text={x.situation} /></span><span className={/pas trait/i.test(x.agent) ? "rp__no" : ""}><Rich text={x.agent} /></span><span className={/pas trait/i.test(x.you) ? "rp__no" : ""}><Rich text={x.you} /></span></div>)}
          <p className="rp__foot">Écrit par Muse Spark à partir des deux correctifs et des tests. Il compare, il ne note pas.</p>
        </section>
      )}
    </>
  );
}

function Side({ who, mono, text, diff }: { who: string; mono: string; text?: string; diff: string }) {
  const lines = diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const add = lines.filter((l) => l.startsWith("+")).length, del = lines.length - add;
  return (
    <section className="card">
      <div className="rp__who"><span className="lx-mg">{mono.slice(0, 3)}</span><span><b>{who}</b><small>{add} lignes ajoutées, {del} retirées</small></span></div>
      {text && <p className="rp__principle"><Rich text={text} /></p>}
      <pre className="rp__diff">{lines.length ? lines.map((l, i) => <span key={i} className={l.startsWith("+") ? "a" : "d"}>{l}{"\n"}</span>) : "aucun changement"}</pre>
    </section>
  );
}

function Tests({ list }: { list: ReplayTest[] }) {
  return <div className="rp__tests">{list.map((t, i) => <div key={i} className={t.ok ? "ok" : "ko"}><i>{t.ok ? "✓" : "×"}</i><span>{t.name}</span></div>)}</div>;
}
