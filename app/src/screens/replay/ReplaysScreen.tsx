import { useEffect, useMemo, useState } from "react";
import { api, type ReplayView } from "../../api/client";
import type { AgentSession, Replay, ReplayTest, VigieAnswer } from "../../api/types";
import { AGENT } from "../../model/agents";
import { Bolt } from "../../vigie/Bolt";
import { inline } from "../../vigie/Vigie";
import { Rich } from "../../ui/Rich";
import { useOpenCode } from "../../ui/code";
import "./replay.css";

/** Transposé des planches R0 à R3 (salle, briefing, en jeu, confrontation), au balisage près. */

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
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
        <p>The real problems your agents ran into, kept as they were. Come back whenever you want. The agent's solution stays hidden until the end.</p>
      </div>
      {error && <p className="rp__err">{error}</p>}
      <section className="rp__night" aria-label="Resume">
        <Bolt mood="welcome" night size={150} />
        <div className="rp__nightmain">
          <p className="bub">{current ? <>Good to see you again. You stopped on <Rich text={current.title.replace(/\.$/, "")} />. {left ? `You still have ${left} test${left > 1 ? "s" : ""} to pass.` : "All tests pass: you can submit."}</>
            : list?.length ? "Pick a replay. I know each problem, not the agent's answer."
            : "No replay for now. Keep a moment when an agent fixed something with a test, and we'll replay it together."}</p>
          {current && last && (
            <div className="rp__resume">
              <span className="vl-label vl-label--night">Pick up where you left off</span>
              <p className="rp__resumet"><Rich text={current.title} /></p>
              <div className="rp__barrow"><span className="bar"><i style={{ width: `${(passed(last) / Math.max(1, last.length)) * 100}%` }} /></span><span className="mono">{passed(last)} test{passed(last) > 1 ? "s" : ""} out of {last.length}</span></div>
              <div><button className="vl-btn vl-btn--light" onClick={() => open(current.id)}>Resume</button></div>
            </div>
          )}
        </div>
      </section>
      <div className="rp__sec">
        <div className="rp__sechead"><h2>To replay</h2><span>Pick the one you like</span></div>
        <div className="cards">
          {toPlay.map((r) => (
            <article key={r.id} className="rc">
              <span className="kind"><i className="gi gi--bug" />{r.finding ? "Race" : "Bug"}</span>
              <p className="rt"><Rich text={r.title} /></p>
              <p className="rd">{r.tests.length > 1 ? `The agent's ${r.tests.length} tests fail` : "The agent's test fails"} on the code before. Make it pass without seeing its solution.</p>
              <div className="rf"><span>{r.agent.name}, {DAY.format(new Date(r.agent.at))}</span><button className="vl-btn vl-btn--primary vl-btn--sm" onClick={() => open(r.id)}>Start</button></div>
            </article>
          ))}
          {list && !toPlay.length && <p className="rp__muted">{current ? "Nothing else to replay for now." : "Nothing to replay for now."}</p>}
        </div>
      </div>
      <div className="more">
        <button className="ml" disabled={!done.length} onClick={() => done[0] && open(done[0].id)}><b>{done.length}</b> already replayed{done.length > 1 ? "s" : ""}</button>
        <button className="ml" disabled={!keepable.length} onClick={() => setShowKeep((v) => !v)}><b>{keepable.length}</b> moment{keepable.length > 1 ? "s" : ""} from an agent, not kept yet{keepable.length > 1 ? "s" : ""}</button>
        <span className="rp__muted rp__right">No streak, no ranking: come whenever you want.</span>
      </div>
      {showKeep && keepable.length > 0 && (
        <section className="card">
          {keepable.map((s) => (
            <div key={s.id} className="rp__keep">
              <span className="av">{AGENT[s.agent].mono}</span>
              <span><b>{AGENT[s.agent].name}{s.branch ? `, ${s.branch}` : ""}</b><small>{DAY.format(new Date(s.started))}, {s.writes.join(", ")}</small></span>
              <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={!!busy} onClick={() => keep(s)}>{busy === s.id ? "Preparing…" : "Keep this moment"}</button>
            </div>
          ))}
          <p className="rp__muted">Keep: VisionLayer finds the code before the fix, reads the finding on that code and runs the agent's test before and after. Nothing is sent to a model.</p>
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
  if (!r) return <div className="rp"><p>{error ?? "Reading the Replay…"}</p></div>;
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
        <span className="kind"><i className="gi gi--bug" />{r.finding ? "Race" : "Bug"}, met on {DAY.format(new Date(r.agent.at))} by {r.agent.name}</span>
        <h1><Rich text={r.title} /></h1>
        <p>{r.finding ? "VisionLayer had flagged it on the code before. " : ""}The test that {r.agent.name} wrote describes it; it's up to you to make it pass, without seeing its solution.</p>
      </div>
      {error && <p className="rp__err">{error}</p>}
      <section className="rp__night">
        <Bolt mood="think" night size={130} />
        <div className="rp__nightmain">
          <p className="bub">I know the whole context, except the answer. Ask me for a hint whenever you want: there are three, from vaguest to most precise.</p>
          <div className="rp__row">
            <button className="vl-btn vl-btn--light" onClick={start} disabled={busy}>{busy ? "Opening your copy…" : "Start the replay"}</button>
            <span className="rp__nightnote">Your copy opens here, in VS Code or in a terminal. Your project isn't touched.</span>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>What the agent went through</h2>
        <div className="tl" style={{ gridTemplateColumns: `repeat(${r.timeline.length + 2}, minmax(0, 1fr))` }}>
          {r.timeline.map((t, i) => <div key={i}><i /><small>{TIME.format(new Date(t.at))}</small><b>{t.what === "map" ? "Reads the map" : `Writes ${t.detail.split("/").pop()}`}</b><span>{t.what === "map" ? t.detail : t.detail.split("/").slice(0, -1).join("/")}</span></div>)}
          <div className="you"><i /><small>{r.base.slice(0, 7)}</small><b>Your turn</b><span>the code is handed over at this moment</span></div>
          <div className="off"><i /><small>…</small><b>What's next</b><span>hidden until your solution</span></div>
        </div>
      </section>
      <div className="rp__two">
        <section className="card">
          <h2>The failing test</h2>
          <p>{r.before.map((t, i) => <span key={i}>“{t.name}”{i < r.before.length - 1 ? " ; " : "."}</span>)}</p>
          <div className={`run${failing ? "" : " run--ok"}`}>{failing ? `On the code before, ${failing} test${failing > 1 ? "s" : ""} out of ${r.before.length} fail${failing > 1 ? "" : "s"}.` : "Already passes on the code before."}</div>
        </section>
        <section className="card">
          <h2>In the box</h2>
          <dl className="box">
            <dt>Code</dt><dd>the repository at commit {r.base.slice(0, 7)}, just before the fix</dd>
            <dt>Tests</dt><dd>{r.tests.join(", ")}, written by {r.agent.name}</dd>
            <dt>Finding</dt><dd>{r.finding ? `read by VisionLayer on this code, ${r.finding.proof.length} lines` : "none"}</dd>
            <dt>The agent</dt><dd>{passed(r.agentResult)} test{passed(r.agentResult) > 1 ? "s" : ""} out of {r.agentResult.length} with its fix</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}

type File = { path: string; test: boolean; text: string };
type Turn = { q: string; hint?: number; a?: VigieAnswer; error?: string };
const HINTS = ["Where to look", "What's wrong, without naming a solution", "The shape of an answer, never the code"];

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
    const q = a.hint ? `Hint ${a.hint}: ${HINTS[a.hint - 1]!.toLowerCase()}` : a.q!;
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
        <span className="rbar__score"><span className="bar"><i style={{ width: `${(passed(last) / Math.max(1, last.length)) * 100}%` }} /></span><span className="mono">{passed(last)} test{passed(last) > 1 ? "s" : ""} out of {last.length}</span></span>
        <button className="vl-btn vl-btn--ghost-night" onClick={() => flush().then(test)} disabled={!!busy || saving}>{busy === "test" ? "Tests are running…" : "Run the tests"}</button>
        <button className="vl-btn vl-btn--light" onClick={() => flush().then(submit)} disabled={!!busy}>{busy === "submit" ? "Comparaison…" : "Submit"}</button>
      </div>
      <div className="rp__game">
        <div className="rp__gamemain">
          <div className="rp__sechead"><h2>Your copy</h2><span>Edit here, or in <a href={`vscode://file${r.copy}`}>VS Code</a></span></div>
          {error && <p className="rp__err">{error}</p>}
          <div className="ed">
            <div className="edh">
              {files.map((x, i) => <button key={x.path} className={i === tab ? "on" : ""} onClick={() => setTab(i)} title={x.path}>{x.path.split("/").pop()}{dirty[x.path] !== undefined ? ", modified" : ""}{x.test ? ", test" : ""}</button>)}
              {Object.keys(dirty).length > 0 && <button className="edh__save" onClick={save} disabled={saving}>{saving ? "…" : "Save"}</button>}
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
          <div className={`run${failing.length ? "" : " run--ok"}`}>{!r.last ? `Not run on your copy yet: on the code before, ${failing.length} test${failing.length > 1 ? "s" : ""} out of ${last.length} fail${failing.length > 1 ? "" : "s"}.` : failing.length ? `Your last run: ${failing.length} test${failing.length > 1 ? "s" : ""} out of ${last.length} still fail${failing.length > 1 ? "" : "s"}.` : `Your last run: all ${last.length} tests pass.`}</div>
          {failing.length > 0 && (
            <section className="card">
              <h2>What the failing tests say</h2>
              {failing.map((t, i) => <div key={i} className="rp__fail"><b>“{t.name}”</b>{t.message && <pre>{t.message}</pre>}</div>)}
            </section>
          )}
        </div>
        <aside className="rp__gameside">
          <div className="rp__who"><Bolt mood="think" size={64} /><div><p className="rp__whon">Vigie</p><p className="rp__muted">doesn't see the agent's fix</p></div></div>
          {turns.length > 0 && (
            <div className="chat">
              {turns.map((t, i) => [
                <p key={`q${i}`} className="me">{t.q}</p>,
                t.error ? <p key={`e${i}`} className="vg"><small>Vigie</small>I couldn't answer: {t.error}</p>
                  : !t.a ? <p key={`w${i}`} className="vg"><small>Vigie</small>Reading your copy…</p>
                  : <div key={`a${i}`} className="vg"><small>Vigie</small>{t.a.answer.split("\n").filter(Boolean).map((l, j) => <p key={j}>{inline(l.replace(/^\s*[-•]\s*/, ""), openCode)}</p>)}</div>,
              ])}
            </div>
          )}
          <div className="rp__hintsbox">
            <span className="vl-label">Indices, {hintsTaken} taken out of 3</span>
            <div className="hints">
              {[1, 2, 3].map((n) => {
                const t = taken(n);
                return (
                  <div key={n}>
                    <span className={`hn${t ? "" : " hn--off"}`}>{n}</span>
                    <span className={t ? "" : "rp__muted"}>{t ? <><b>{HINTS[n - 1]}.</b> {inline(t.a!.answer.split("\n")[0]!, openCode)}</> : HINTS[n - 1]}</span>
                    {!t ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={asking || n !== hintsTaken + 1} onClick={() => ask({ hint: n })}>Open</button> : <span />}
                  </div>
                );
              })}
            </div>
          </div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) ask({ q: draft }); }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask Vigie, or paste an error" disabled={asking} />
            <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={asking || !draft.trim()}>Send</button>
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
        <Bolt mood="happy" night size={120} />
        <div className="rp__nightmain">
          <h1>Two solutions to the same problem</h1>
          <p className="bub">{c ? <Rich text={c.sentence} /> : "I couldn't write the comparison; both fixes are here, side by side."}</p>
        </div>
        <div className="rp__stats">
          <div className="stat"><b>{passed(you)} / {you.length}</b><span>your tests</span></div>
          <div className="stat"><b>{passed(r.agentResult)} / {r.agentResult.length}</b><span>with the solution of {r.agent.name}</span></div>
        </div>
      </section>
      {error && <p className="rp__err">{error}</p>}
      <div className="rp__two">
        <Side who={`${r.agent.name}, ${DAY.format(new Date(r.agent.at))}`} av={AGENT[agentKey].mono} text={c?.agent} diff={r.agentPatch ?? ""} />
        <Side who={r.submitted?.example ? "Example of a submitted solution" : "Toi, aujourd'hui"} av="TOI" mine text={c?.you} diff={r.yourDiff ?? ""} />
      </div>
      {c && (
        <section className="card rp__cmp">
          <div className="cmp cmp--h"><span>The situation</span><span>{r.agent.name}</span><span>You</span></div>
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
        <button className="vl-btn vl-btn--primary" onClick={reopen} disabled={!!busy}>Back to my copy</button>
        <button className="vl-btn vl-btn--secondary" onClick={prepare} disabled={!!busy}>Propose to the project</button>
        <button className="vl-btn vl-btn--secondary" onClick={back}>Keep it to myself</button>
        <span className="rp__muted">No score, no winner: two good solutions, or two that miss the same case. <button className="rp__link" onClick={reset} disabled={!!busy}>Replay from the start</button></span>
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
      <div className="who2"><span className={`av${mine ? " av--me" : ""}`}>{av}</span><div><p className="rp__whon">{who}</p><p className="rp__muted">{files} file{files > 1 ? "s" : ""}, {add} line{add > 1 ? "s" : ""} added, {del} removed</p></div></div>
      {text && <p><Rich text={text} /></p>}
      <div className="ed ed--diff">{keep.length ? keep.map((x, i) => <div key={i} className={x.kind}><span>{x.n}</span><span>{x.text}</span></div>) : <div><span /><span>no change</span></div>}</div>
    </section>
  );
}

/** R4, proposer : ramener ce que tu as trouvé dans le projet, vérifié sur le projet à jour, puis la PR au clic. */
function Propose({ r, propose, back, busy, error }: { r: ReplayView; propose: () => void; back: () => void; busy?: string; error?: string }) {
  const p = r.proposal;
  if (!p) return (
    <div className="rp">
      <section className="rp__night"><Bolt mood="think" night size={120} /><div className="rp__nightmain"><h1>Bring what you found back to the project</h1><p className="rp__nightp">I apply your fix to an up-to-date copy of the project, then run its test suite, tsc, and compare the map before and after. Your project isn't touched.</p></div></section>
    </div>
  );
  const [withYours, without] = p.protects;
  const okAll = (t: ReplayTest[]) => t.length > 0 && t.every((x) => x.ok);
  const mark = (t: ReplayTest[]) => okAll(t) ? <span className="mk mk--ok">passes {t.length} out of {t.length}</span> : <span className="mk mk--cr">fails {t.length - passed(t)} out of {t.length}</span>;
  const catches = withYours && without && okAll(withYours.result) && !okAll(without.result);
  const lead = `${p.onto.branch} ${without && okAll(without.result) ? "already protects this case" : "doesn't protect this case yet"}: the replay test passes there ${without ? passed(without.result) : 0} out of ${without?.result.length ?? 0}. With your fix, it passes ${withYours ? passed(withYours.result) : 0} out of ${withYours?.result.length ?? 0}${p.addsTests.length ? ", and the PR brings the test the agent had written" : ""}.`;
  return (
    <div className="rp">
      <section className="rp__night">
        <Bolt mood={p.done ? "happy" : "welcome"} night size={120} />
        <div className="rp__nightmain">
          <h1>Bring what you found back to the project</h1>
          <p className="rp__nightp">{lead}</p>
        </div>
      </section>
      {error && <p className="rp__err">{error}</p>}
      <section className="card">
        <div className="steps">
          {p.steps.map((s) => <div key={s.name} className={s.ok ? "" : "ko"}><i>{s.ok ? "✓" : "×"}</i><b>{s.name}</b><span>{s.note}</span></div>)}
          <div className={p.done ? "" : "now"}><i>{p.done ? "✓" : p.steps.length + 1}</i><b>Your review</b><span>{p.done ? "faite" : "maintenant"}</span></div>
          <div className={p.done?.url ? "" : "off"}><i>{p.done?.url ? "✓" : p.steps.length + 2}</i><b>{p.remote === "github" ? "PR on GitHub" : "Branch"}</b><span>{p.done ? (p.done.url ? "opened as a draft" : "created, to push") : "reviewed and merged by the team"}</span></div>
        </div>
      </section>
      <div className="rp__pgrid">
        <section className="card rp__cmp">
          <div className="rp__chkhead"><h2>Does this test really protect this case?</h2></div>
          {p.protects.map((x) => <div key={x.label} className="chk"><span>{x.label}<small>{x.note}</small></span>{mark(x.result)}</div>)}
          <p className="rp__chkfoot">{catches ? "It catches the case we wanted: it fails without your fix and passes with it. If it passed everywhere, it would prove nothing." : withYours && !okAll(withYours.result) ? `With your fix, ${withYours.result.length - passed(withYours.result)} replay test${withYours.result.length - passed(withYours.result) > 1 ? "s" : ""} still fail${withYours.result.length - passed(withYours.result) > 1 ? "" : "s"}: ${withYours.result.filter((t) => !t.ok).map((t) => `“${t.name}”`).join(", ")}. Say so in your review.` : "The test already passes without your fix: it doesn't prove your change matters."}</p>
        </section>
        <section className="card">
          <span className="vl-label">{p.remote === "github" ? "The proposed PR" : "The proposed branch"}</span>
          <h2 className="rp__prt">{p.title}</h2>
          <span className="vl-ref rp__branch">{p.branch}</span>
          <p className="rp__prbody">{p.body}</p>
          {p.done ? (
            <div className="run run--ok">{p.done.url ? <a href={p.done.url} target="_blank" rel="noreferrer">{p.done.url}</a> : p.done.note}</div>
          ) : (
            <div className="rp__row">
              <button className="vl-btn vl-btn--primary" onClick={propose} disabled={!!busy || !p.steps.find((s) => s.name === "Patch")?.ok}>{busy === "propose" ? "…" : p.remote === "github" ? "Open the PR on GitHub" : "Create the branch"}</button>
              <button className="vl-btn vl-btn--secondary" onClick={back}>Keep it to myself</button>
            </div>
          )}
          <p className="rp__note">{p.remote === "github" ? "On click, the branch is pushed from a copy of the project and the PR opened as a draft." : p.remote === "none" ? "This repository has no remote: on click, the branch is created in the repository, for you to push." : "The remote is not on GitHub: on click, the branch is created, for you to push."} VisionLayer writes nothing in your project's files and never merges.</p>
        </section>
      </div>
    </div>
  );
}
