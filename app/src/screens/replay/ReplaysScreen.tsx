import { useEffect, useMemo, useState } from "react";
import { api, type ReplayView } from "../../api/client";
import type { AgentSession, Replay, ReplayTest, VigieAnswer } from "../../api/types";
import { AGENT } from "../../model/agents";
import { Face, PERSONAS, useFace, type Mood } from "../../vigie/Face";
import { inline } from "../../vigie/Vigie";
import { Rich } from "../../ui/Rich";
import { useOpenCode } from "../../ui/code";
import "./replay.css";

/** Transposé des planches R0 à R3 (salle, briefing, en jeu, confrontation), au balisage près. */

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const passed = (t: ReplayTest[]) => t.filter((x) => x.ok).length;
const isTest = (f: string) => /(\.|_)(spec|test)\./.test(f);

export function ReplaysScreen({ item, open }: { item?: string; open: (id?: string) => void }) {
  return item ? <ReplayPage id={item} open={open} /> : <Room open={open} />;
}

/** R0, la salle : reprendre où tu en étais, les replays à rejouer, les moments pas encore gardés. */
function Room({ open }: { open: (id: string) => void }) {
  const [list, setList] = useState<Replay[]>();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [showKeep, setShowKeep] = useState(false);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => { api.replays().then(setList).catch((e) => setError(String(e))); api.agents().then(setSessions).catch(() => {}); }, []);
  const kept = new Set(list?.map((r) => r.agent.session));
  const keepable = sessions.filter((s) => !kept.has(s.id) && s.writes.some(isTest) && s.writes.some((f) => !isTest(f)));
  const current = list?.find((r) => r.copy && !r.submitted);
  const toPlay = list?.filter((r) => r !== current && !r.submitted) ?? [];
  const done = list?.filter((r) => r.submitted) ?? [];
  const keep = (s: AgentSession) => { setBusy(s.id); setError(undefined); api.keepReplay(s.id).then((r) => open(r.id)).catch((e) => setError(String(e.message ?? e))).finally(() => setBusy(undefined)); };
  const last = current && (current.last ?? current.before);
  const left = last ? last.length - passed(last) : 0;
  return (
    <div className="rp">
      <div className="rp__intro">
        <h1>Replays</h1>
        <p>Les vrais problèmes que tes agents ont rencontrés, gardés tels qu'ils étaient. Tu y retournes quand tu veux. La solution de l'agent reste cachée jusqu'au bout.</p>
      </div>
      {error && <p className="rp__err">{error}</p>}
      <section className="rp__night" aria-label="Reprendre">
        <Host mood="welcome" />
        <div className="rp__nightmain">
          <p className="bub">{current ? <>Content de te revoir. Tu t'es arrêté sur <Rich text={current.title.replace(/\.$/, "")} />. {left ? `Il te reste ${left} test${left > 1 ? "s" : ""} à faire passer.` : "Tous les tests passent : tu peux soumettre."}</>
            : list?.length ? "Choisis un replay. Je connais chaque problème, pas la réponse de l'agent."
            : "Aucun replay pour l'instant. Garde un moment où un agent a corrigé quelque chose avec un test, et on le rejoue ensemble."}</p>
          {current && last && (
            <div className="rp__resume">
              <span className="vl-label">Reprendre où tu en étais</span>
              <p className="rp__resumet"><Rich text={current.title} /></p>
              <div className="rp__barrow"><span className="bar"><i style={{ width: `${(passed(last) / Math.max(1, last.length)) * 100}%` }} /></span><span className="mono">{passed(last)} test{passed(last) > 1 ? "s" : ""} sur {last.length}</span></div>
              <div><button className="vl-btn vl-btn--light" onClick={() => open(current.id)}>Reprendre</button></div>
            </div>
          )}
        </div>
      </section>
      <div className="rp__sec">
        <div className="rp__sechead"><h2>À rejouer</h2><span>Choisis celui qui te tente</span></div>
        <div className="cards">
          {toPlay.map((r) => (
            <article key={r.id} className="rc">
              <span className="kind"><i className="gi gi--bug" />{r.finding ? "Course" : "Bug"}</span>
              <p className="rt"><Rich text={r.title} /></p>
              <p className="rd">{r.tests.length > 1 ? `Les ${r.tests.length} tests de l'agent échouent` : "Le test de l'agent échoue"} sur le code d'avant. Fais-le passer sans voir sa solution.</p>
              <div className="rf"><span>{r.agent.name}, {DAY.format(new Date(r.agent.at))}</span><button className="vl-btn vl-btn--primary vl-btn--sm" onClick={() => open(r.id)}>Commencer</button></div>
            </article>
          ))}
          {list && !toPlay.length && <p className="rp__muted">{current ? "Rien d'autre à rejouer pour l'instant." : "Rien à rejouer pour l'instant."}</p>}
        </div>
      </div>
      <div className="more">
        <button className="ml" disabled={!done.length} onClick={() => done[0] && open(done[0].id)}><b>{done.length}</b> déjà rejoué{done.length > 1 ? "s" : ""}</button>
        <button className="ml" disabled={!keepable.length} onClick={() => setShowKeep((v) => !v)}><b>{keepable.length}</b> moment{keepable.length > 1 ? "s" : ""} d'agent, pas encore gardé{keepable.length > 1 ? "s" : ""}</button>
        <span className="rp__muted rp__right">Ni série, ni classement : tu viens quand tu veux.</span>
      </div>
      {showKeep && keepable.length > 0 && (
        <section className="card">
          {keepable.map((s) => (
            <div key={s.id} className="rp__keep">
              <span className="av">{AGENT[s.agent].mono}</span>
              <span><b>{AGENT[s.agent].name}{s.branch ? `, ${s.branch}` : ""}</b><small>{DAY.format(new Date(s.started))}, {s.writes.join(", ")}</small></span>
              <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={!!busy} onClick={() => keep(s)}>{busy === s.id ? "Préparation…" : "Garder ce moment"}</button>
            </div>
          ))}
          <p className="rp__muted">Garder : VisionLayer retrouve le code d'avant le correctif, lit le constat sur ce code et lance le test de l'agent avant et après. Rien n'est envoyé à un modèle.</p>
        </section>
      )}
    </div>
  );
}

function ReplayPage({ id, open }: { id: string; open: (id?: string) => void }) {
  const [r, setR] = useState<ReplayView>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  useEffect(() => { api.replay(id).then(setR).catch((e) => setError(String(e))); }, [id]);
  const run = <T,>(what: string, p: Promise<T>, then: (x: T) => void) => { setBusy(what); setError(undefined); p.then(then).catch((e) => setError(String(e.message ?? e))).finally(() => setBusy(undefined)); };
  if (!r) return <div className="rp"><p>{error ?? "Lecture du Replay…"}</p></div>;
  if (r.submitted && (r.proposal || busy === "prepare")) return <Propose r={r} error={error} busy={busy} propose={() => run("propose", api.propose(id), setR)} back={() => open()} />;
  if (r.submitted) return <Confront r={r} error={error} busy={busy} reopen={() => run("reopen", api.reopenReplay(id), setR)} reset={() => run("reset", api.resetReplay(id), setR)} back={() => open()} prepare={() => run("prepare", api.prepareProposal(id), setR)} />;
  if (r.copy) return <Play r={r} error={error} busy={busy} test={() => run("test", api.testReplay(id), (last) => setR({ ...r, last }))} submit={() => run("submit", api.submitReplay(id), setR)} />;
  return <Briefing r={r} error={error} busy={busy === "start"} start={() => run("start", api.startReplay(id), setR)} />;
}

/** R1, le briefing : le problème, Vigie, ce que l'agent a vécu jusqu'à l'instant où le code t'est remis. */
function Briefing({ r, start, busy, error }: { r: ReplayView; start: () => void; busy: boolean; error?: string }) {
  const failing = r.before.length - passed(r.before);
  return (
    <div className="rp">
      <div className="rp__intro">
        <span className="kind"><i className="gi gi--bug" />{r.finding ? "Course" : "Bug"}, rencontrée le {DAY.format(new Date(r.agent.at))} par {r.agent.name}</span>
        <h1><Rich text={r.title} /></h1>
        <p>{r.finding ? "VisionLayer l'avait signalé sur le code d'avant. " : ""}Le test que {r.agent.name} a écrit le décrit ; à toi de le faire passer, sans voir sa solution.</p>
      </div>
      {error && <p className="rp__err">{error}</p>}
      <section className="rp__night">
        <Host mood="question" />
        <div className="rp__nightmain">
          <p className="bub">Je connais tout le contexte, sauf la réponse. Demande-moi un indice quand tu veux : il y en a trois, du plus vague au plus précis.</p>
          <div className="rp__row">
            <button className="vl-btn vl-btn--light" onClick={start} disabled={busy}>{busy ? "Ouverture de ta copie…" : "Commencer le replay"}</button>
            <span className="rp__nightnote">Ta copie s'ouvre ici, dans VS Code ou dans un terminal. Ton projet n'est pas touché.</span>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Ce que l'agent a vécu</h2>
        <div className="tl" style={{ gridTemplateColumns: `repeat(${r.timeline.length + 2}, minmax(0, 1fr))` }}>
          {r.timeline.map((t, i) => <div key={i}><i /><small>{TIME.format(new Date(t.at))}</small><b>{t.what === "map" ? "Lit la carte" : `Écrit ${t.detail.split("/").pop()}`}</b><span>{t.what === "map" ? t.detail : t.detail.split("/").slice(0, -1).join("/")}</span></div>)}
          <div className="you"><i /><small>{r.base.slice(0, 7)}</small><b>À toi</b><span>le code est remis à cet instant</span></div>
          <div className="off"><i /><small>…</small><b>La suite</b><span>cachée jusqu'à ta solution</span></div>
        </div>
      </section>
      <div className="rp__two">
        <section className="card">
          <h2>Le test qui échoue</h2>
          <p>{r.before.map((t, i) => <span key={i}>« {t.name} »{i < r.before.length - 1 ? " ; " : "."}</span>)}</p>
          <div className={`run${failing ? "" : " run--ok"}`}>{failing ? `Sur le code d'avant, ${failing} test${failing > 1 ? "s" : ""} sur ${r.before.length} échoue${failing > 1 ? "nt" : ""}.` : "Passe déjà sur le code d'avant."}</div>
        </section>
        <section className="card">
          <h2>Dans la boîte</h2>
          <dl className="box">
            <dt>Code</dt><dd>le dépôt au commit {r.base.slice(0, 7)}, juste avant la correction</dd>
            <dt>Tests</dt><dd>{r.tests.join(", ")}, écrit{r.tests.length > 1 ? "s" : ""} par {r.agent.name}</dd>
            <dt>Constat</dt><dd>{r.finding ? `lu par VisionLayer sur ce code, ${r.finding.proof.length} lignes` : "aucun"}</dd>
            <dt>L'agent</dt><dd>{passed(r.agentResult)} test{passed(r.agentResult) > 1 ? "s" : ""} sur {r.agentResult.length} avec sa correction</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}

type File = { path: string; test: boolean; text: string };
type Turn = { q: string; hint?: number; a?: VigieAnswer; error?: string };
const HINTS = ["Où regarder", "Ce qui cloche, sans nommer de solution", "La forme d'une réponse, jamais le code"];

/** R2, en jeu : la barre de la partie, ta copie éditable ici, le dernier lancement ; Vigie et ses trois indices à droite. */
function Play({ r, test, submit, busy, error }: { r: ReplayView; test: () => void; submit: () => void; busy?: string; error?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [tab, setTab] = useState(0);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const openCode = useOpenCode();
  useEffect(() => { api.replayFiles(r.id).then((f) => { setFiles(f); setTab(Math.max(0, f.findIndex((x) => r.fixFiles.includes(x.path)))); }).catch(() => {}); }, [r.id]);
  const last = r.last ?? r.before;
  const f = files[tab];
  const text = f ? dirty[f.path] ?? f.text : "";
  const lines = useMemo(() => text.split("\n").length, [text]);
  const save = async () => {
    setSaving(true);
    for (const [path, t] of Object.entries(dirty)) { await api.saveReplayFile(r.id, path, t); setFiles((fs) => fs.map((x) => x.path === path ? { ...x, text: t } : x)); }
    setDirty({}); setSaving(false);
  };
  const flush = () => Object.keys(dirty).length ? save() : Promise.resolve();
  const ask = (a: { q?: string; hint?: number }) => {
    const q = a.hint ? `Indice ${a.hint} : ${HINTS[a.hint - 1]!.toLowerCase()}` : a.q!;
    setAsking(true); setDraft(""); setTurns((t) => [...t, { q, ...(a.hint ? { hint: a.hint } : {}) }]);
    flush().then(() => api.askReplay(r.id, a)).then((ans) => setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, a: ans } : x)))
      .catch((e) => setTurns((t) => t.map((x, i) => i === t.length - 1 ? { ...x, error: String(e.message ?? e) } : x))).finally(() => setAsking(false));
  };
  const taken = (n: number) => turns.find((t) => t.hint === n && t.a);
  const hintsTaken = [1, 2, 3].filter((n) => taken(n)).length;
  const failing = last.filter((t) => !t.ok);
  return (
    <div className="rp--play">
      <div className="rbar">
        <span className="kind kind--night"><i className="gi gi--bug" />#{r.id.slice(2)}</span>
        <span className="t"><Rich text={r.title.split(",")[0]!.replace(/\.$/, "")} /></span>
        <span className="rbar__score"><span className="bar"><i style={{ width: `${(passed(last) / Math.max(1, last.length)) * 100}%` }} /></span><span className="mono">{passed(last)} test{passed(last) > 1 ? "s" : ""} sur {last.length}</span></span>
        <button className="vl-btn vl-btn--ghost-night" onClick={() => flush().then(test)} disabled={!!busy || saving}>{busy === "test" ? "Les tests tournent…" : "Relancer les tests"}</button>
        <button className="vl-btn vl-btn--light" onClick={() => flush().then(submit)} disabled={!!busy}>{busy === "submit" ? "Comparaison…" : "Soumettre"}</button>
      </div>
      <div className="rp__game">
        <div className="rp__gamemain">
          <div className="rp__sechead"><h2>Ta copie</h2><span>Tu édites ici, ou dans <a href={`vscode://file${r.copy}`}>VS Code</a></span></div>
          {error && <p className="rp__err">{error}</p>}
          <div className="ed">
            <div className="edh">
              {files.map((x, i) => <button key={x.path} className={i === tab ? "on" : ""} onClick={() => setTab(i)} title={x.path}>{x.path.split("/").pop()}{dirty[x.path] !== undefined ? ", modifié" : ""}{x.test ? ", test" : ""}</button>)}
              {Object.keys(dirty).length > 0 && <button className="edh__save" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>}
            </div>
            {f && (
              <div className="ed__area">
                <pre className="ed__nums" aria-hidden="true">{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</pre>
                <textarea value={text} readOnly={f.test} spellCheck={false} rows={lines}
                  onChange={(e) => setDirty((d) => ({ ...d, [f.path]: e.target.value }))}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } }} />
              </div>
            )}
          </div>
          <div className={`run${failing.length ? "" : " run--ok"}`}>{!r.last ? `Pas encore lancé sur ta copie : sur le code d'avant, ${failing.length} test${failing.length > 1 ? "s" : ""} sur ${last.length} échoue${failing.length > 1 ? "nt" : ""}.` : failing.length ? `Ton dernier lancement : ${failing.length} test${failing.length > 1 ? "s" : ""} sur ${last.length} échoue${failing.length > 1 ? "nt" : ""} encore.` : `Ton dernier lancement : les ${last.length} tests passent.`}</div>
          {failing.length > 0 && (
            <section className="card">
              <h2>Ce que disent les tests qui échouent</h2>
              {failing.map((t, i) => <div key={i} className="rp__fail"><b>« {t.name} »</b>{t.message && <pre>{t.message}</pre>}</div>)}
            </section>
          )}
        </div>
        <aside className="rp__gameside">
          <div className="rp__who"><Face mood="think" size={56} /><div><p className="rp__whon">Vigie</p><p className="rp__muted">ne voit pas la correction de l'agent</p></div></div>
          {turns.length > 0 && (
            <div className="chat">
              {turns.map((t, i) => [
                <p key={`q${i}`} className="me">{t.q}</p>,
                t.error ? <p key={`e${i}`} className="vg"><small>Vigie</small>Je n'ai pas pu répondre : {t.error}</p>
                  : !t.a ? <p key={`w${i}`} className="vg"><small>Vigie</small>Je lis ta copie…</p>
                  : <div key={`a${i}`} className="vg"><small>Vigie</small>{t.a.answer.split("\n").filter(Boolean).map((l, j) => <p key={j}>{inline(l.replace(/^\s*[-•]\s*/, ""), openCode)}</p>)}</div>,
              ])}
            </div>
          )}
          <div className="rp__hintsbox">
            <span className="vl-label">Indices, {hintsTaken} pris sur 3</span>
            <div className="hints">
              {[1, 2, 3].map((n) => {
                const t = taken(n);
                return (
                  <div key={n}>
                    <span className={`hn${t ? "" : " hn--off"}`}>{n}</span>
                    <span className={t ? "" : "rp__muted"}>{t ? <><b>{HINTS[n - 1]}.</b> {inline(t.a!.answer.split("\n")[0]!, openCode)}</> : HINTS[n - 1]}</span>
                    {!t ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={asking || n !== hintsTaken + 1} onClick={() => ask({ hint: n })}>Ouvrir</button> : <span />}
                  </div>
                );
              })}
            </div>
          </div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) ask({ q: draft }); }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Demande à Vigie, ou colle une erreur" disabled={asking} />
            <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={asking || !draft.trim()}>Envoyer</button>
          </form>
        </aside>
      </div>
    </div>
  );
}

/** R3, la confrontation : deux solutions au même problème, situation par situation ; ni score ni gagnant. */
function Confront({ r, reopen, reset, back, prepare, busy, error }: { r: ReplayView; reopen: () => void; reset: () => void; back: () => void; prepare: () => void; busy?: string; error?: string }) {
  const c = r.comparison, you = r.submitted!.result;
  const missed = (s: string) => /^pas trait/i.test(s.trim());
  const seen = (s: string) => /^vu\b/i.test(s.trim());
  const agentKey = r.agent.name === "Muse Code" ? "muse" : r.agent.name === "Codex" ? "codex" : "claude";
  return (
    <div className="rp">
      <section className="rp__night">
        <Host mood="happy" />
        <div className="rp__nightmain">
          <h1>Deux solutions au même problème</h1>
          <p className="bub">{c ? <Rich text={c.sentence} /> : "Je n'ai pas pu écrire la comparaison ; les deux correctifs sont là, côte à côte."}</p>
        </div>
        <div className="rp__stats">
          <div className="stat"><b>{passed(you)} / {you.length}</b><span>tes tests</span></div>
          <div className="stat"><b>{passed(r.agentResult)} / {r.agentResult.length}</b><span>avec la solution de {r.agent.name}</span></div>
        </div>
      </section>
      {error && <p className="rp__err">{error}</p>}
      <div className="rp__two">
        <Side who={`${r.agent.name}, le ${DAY.format(new Date(r.agent.at))}`} av={AGENT[agentKey].mono} text={c?.agent} diff={r.agentPatch ?? ""} />
        <Side who="Toi, aujourd'hui" av="TOI" mine text={c?.you} diff={r.yourDiff ?? ""} />
      </div>
      {c && (
        <section className="card rp__cmp">
          <div className="cmp cmp--h"><span>La situation</span><span>{r.agent.name}</span><span>Toi</span></div>
          {c.rows.map((x, i) => (
            <div key={i} className={`cmp${missed(x.agent) !== missed(x.you) ? " cmp--diff" : ""}`}>
              <span className="cmp__s"><Rich text={x.situation} /></span>
              <span className={missed(x.agent) ? "miss" : seen(x.agent) ? "seen" : ""}><Rich text={x.agent} /></span>
              <span className={missed(x.you) ? "miss" : seen(x.you) ? "seen" : ""}><Rich text={x.you} /></span>
            </div>
          ))}
        </section>
      )}
      <div className="rp__row">
        <button className="vl-btn vl-btn--primary" onClick={reopen} disabled={!!busy}>Reprendre ma copie</button>
        <button className="vl-btn vl-btn--secondary" onClick={prepare} disabled={!!busy}>Proposer au projet</button>
        <button className="vl-btn vl-btn--secondary" onClick={back}>Garder pour moi</button>
        <span className="rp__muted">Pas de score ni de gagnant : deux bonnes solutions, ou deux qui ratent le même cas. <button className="rp__link" onClick={reset} disabled={!!busy}>Rejouer depuis le début</button></span>
      </div>
    </div>
  );
}

/** Un correctif : qui, combien de lignes, son principe, ses lignes retirées et ajoutées avec leur numéro. */
function Side({ who, av, text, diff, mine }: { who: string; av: string; text?: string; diff: string; mine?: boolean }) {
  const rows: { n: number; kind: "add" | "del" | ""; text: string }[] = [];
  let o = 0, n = 0;
  for (const l of diff.split("\n")) {
    const h = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    if (h) { o = Number(h[1]); n = Number(h[2]); continue; }
    if (/^(diff |index |\+\+\+|---|new file|deleted file)/.test(l)) continue;
    if (l.startsWith("-")) rows.push({ n: o++, kind: "del", text: l.slice(1) });
    else if (l.startsWith("+")) rows.push({ n: n++, kind: "add", text: l.slice(1) });
    else if (l.startsWith(" ")) { rows.push({ n, kind: "", text: l.slice(1) }); o++; n++; }
  }
  // Seulement ce qui change, avec une ligne de contexte autour.
  const keep = rows.filter((x, i) => x.kind || rows[i - 1]?.kind || rows[i + 1]?.kind);
  const add = rows.filter((x) => x.kind === "add").length, del = rows.filter((x) => x.kind === "del").length;
  const files = (diff.match(/^\+\+\+ /gm) ?? []).length;
  return (
    <section className={`card${mine ? " card--on" : ""}`}>
      <div className="who2"><span className={`av${mine ? " av--me" : ""}`}>{av}</span><div><p className="rp__whon">{who}</p><p className="rp__muted">{files} fichier{files > 1 ? "s" : ""}, {add} ligne{add > 1 ? "s" : ""} ajoutée{add > 1 ? "s" : ""}, {del} retirée{del > 1 ? "s" : ""}</p></div></div>
      {text && <p><Rich text={text} /></p>}
      <div className="ed ed--diff">{keep.length ? keep.map((x, i) => <div key={i} className={x.kind}><span>{x.n}</span><span>{x.text}</span></div>) : <div><span /><span>aucun changement</span></div>}</div>
    </section>
  );
}

/** R4, proposer : ramener ce que tu as trouvé dans le projet, vérifié sur le projet à jour, puis la PR au clic. */
function Propose({ r, propose, back, busy, error }: { r: ReplayView; propose: () => void; back: () => void; busy?: string; error?: string }) {
  const p = r.proposal;
  if (!p) return (
    <div className="rp">
      <section className="rp__night"><Host mood="focus" /><div className="rp__nightmain"><h1>Ramener ce que tu as trouvé dans le projet</h1><p className="rp__nightp">Je reporte ton correctif sur une copie du projet à jour, puis je lance sa suite de tests, tsc, et je compare la carte avant et après. Ton projet n'est pas touché.</p></div></section>
    </div>
  );
  const [withYours, without] = p.protects;
  const okAll = (t: ReplayTest[]) => t.length > 0 && t.every((x) => x.ok);
  const mark = (t: ReplayTest[]) => okAll(t) ? <span className="mk mk--ok">passe {t.length} sur {t.length}</span> : <span className="mk mk--cr">échoue {t.length - passed(t)} sur {t.length}</span>;
  const catches = withYours && without && okAll(withYours.result) && !okAll(without.result);
  const lead = `${p.onto.branch} ${without && okAll(without.result) ? "protège déjà ce cas" : "ne protège pas encore ce cas"} : le test du replay y passe ${without ? passed(without.result) : 0} sur ${without?.result.length ?? 0}. Avec ton correctif, il passe ${withYours ? passed(withYours.result) : 0} sur ${withYours?.result.length ?? 0}${p.addsTests.length ? ", et la PR apporte le test que l'agent avait écrit" : ""}.`;
  return (
    <div className="rp">
      <section className="rp__night">
        <Host mood={p.done ? "wow" : "welcome"} />
        <div className="rp__nightmain">
          <h1>Ramener ce que tu as trouvé dans le projet</h1>
          <p className="rp__nightp">{lead}</p>
        </div>
      </section>
      {error && <p className="rp__err">{error}</p>}
      <section className="card">
        <div className="steps">
          {p.steps.map((s) => <div key={s.name} className={s.ok ? "" : "ko"}><i>{s.ok ? "✓" : "×"}</i><b>{s.name}</b><span>{s.note}</span></div>)}
          <div className={p.done ? "" : "now"}><i>{p.done ? "✓" : p.steps.length + 1}</i><b>Ta relecture</b><span>{p.done ? "faite" : "maintenant"}</span></div>
          <div className={p.done?.url ? "" : "off"}><i>{p.done?.url ? "✓" : p.steps.length + 2}</i><b>{p.remote === "github" ? "PR sur GitHub" : "Branche"}</b><span>{p.done ? (p.done.url ? "ouverte en brouillon" : "créée, à pousser") : "relue et fusionnée par l'équipe"}</span></div>
        </div>
      </section>
      <div className="rp__pgrid">
        <section className="card rp__cmp">
          <div className="rp__chkhead"><h2>Ce test protège-t-il vraiment ce cas ?</h2></div>
          {p.protects.map((x) => <div key={x.label} className="chk"><span>{x.label}<small>{x.note}</small></span>{mark(x.result)}</div>)}
          <p className="rp__chkfoot">{catches ? "Il attrape le cas qu'on cherchait : il échoue sans ton correctif et passe avec. S'il passait partout, il ne prouverait rien." : withYours && !okAll(withYours.result) ? `Avec ton correctif, ${withYours.result.length - passed(withYours.result)} test${withYours.result.length - passed(withYours.result) > 1 ? "s" : ""} du replay échoue${withYours.result.length - passed(withYours.result) > 1 ? "nt" : ""} encore : ${withYours.result.filter((t) => !t.ok).map((t) => `« ${t.name} »`).join(", ")}. Dis-le dans ta relecture.` : "Le test passe déjà sans ton correctif : il ne prouve pas que ton changement sert."}</p>
        </section>
        <section className="card">
          <span className="vl-label">{p.remote === "github" ? "La PR proposée" : "La branche proposée"}</span>
          <h2 className="rp__prt">{p.title}</h2>
          <span className="vl-ref rp__branch">{p.branch}</span>
          <p className="rp__prbody">{p.body}</p>
          {p.done ? (
            <div className="run run--ok">{p.done.url ? <a href={p.done.url} target="_blank" rel="noreferrer">{p.done.url}</a> : p.done.note}</div>
          ) : (
            <div className="rp__row">
              <button className="vl-btn vl-btn--primary" onClick={propose} disabled={!!busy || !p.steps.find((s) => s.name === "Patch")?.ok}>{busy === "propose" ? "…" : p.remote === "github" ? "Ouvrir la PR sur GitHub" : "Créer la branche"}</button>
              <button className="vl-btn vl-btn--secondary" onClick={back}>Garder pour moi</button>
            </div>
          )}
          <p className="rp__note">{p.remote === "github" ? "Au clic, la branche est poussée depuis une copie du projet et la PR ouverte en brouillon." : p.remote === "none" ? "Ce dépôt n'a pas de remote : au clic, la branche est créée dans le dépôt, à pousser toi-même." : "Le remote n'est pas sur GitHub : au clic, la branche est créée, à pousser toi-même."} VisionLayer n'écrit rien dans les fichiers de ton projet et ne fusionne jamais.</p>
        </section>
      </div>
    </div>
  );
}

/** Vigie en tête de chaque moment du Replay : le visage choisi, son nom, et ce qu'il dit dans la bulle d'à côté. */
function Host({ mood }: { mood: Mood }) {
  const name = PERSONAS.find((p) => p.id === useFace())?.name;
  return <span className="rp__host"><Face mood={mood} size={112} /><span className="rp__hostname"><i />{name ? `${name}, ta Vigie` : "Vigie"}</span></span>;
}
