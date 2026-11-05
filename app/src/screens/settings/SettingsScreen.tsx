import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AgentLink } from "../../api/types";
import { AGENT } from "../../model/agents";
import "./settings.css";

const TABS = ["Project agents", "Meta models", "Linked tools", "What it reads", "Where it writes"];

/** Planche 40, Réglages des agents : ce qui relie chaque agent à VisionLayer, posé ou retiré d'un clic. */
export function SettingsScreen() {
  const [links, setLinks] = useState<AgentLink[]>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => { api.links().then(setLinks).catch((e) => setError(String(e))); }, []);
  const act = (a: AgentLink, on: boolean) => { setBusy(a.agent); setError(undefined); (on ? api.link : api.unlink)(a.agent).then(setLinks).catch((e) => setError(String(e))).finally(() => setBusy(undefined)); };
  return (
    <div className="page st">
      <div className="st__intro">
        <h1 className="st__title">The agents coding on this project</h1>
        <p className="st__lead">VisionLayer runs no agent. It gives the map to the project's agents, learns from them what they touched, and asks them to declare what they know. Each link is set here in one click, and removed the same way.</p>
      </div>
      <div className="tabs st__tabs">{TABS.map((t, i) => <button key={t} className={`seg${i === 0 ? " seg--on" : ""}`} disabled={i > 0} title={i > 0 ? "Coming soon" : undefined}>{t}</button>)}</div>
      {error && <p className="st__err">{error}</p>}
      <section className="card">
        <div className="st__row st__row--h"><span>Agent</span><span>On this machine</span><span>Reads the map</span><span>Says what it touches</span><span>Declares what it knows</span><span /></div>
        {!links ? <p className="st__foot">Reading settings…</p> : links.map((a) => {
          // Relié : tout ce que VisionLayer peut poser pour cet agent est posé.
          const linked = [a.map, a.report, a.contract].filter((c) => c.editable).every((c) => c.linked);
          return (
            <div key={a.agent} className={`st__row${a.installed ? "" : " st__row--off"}`}>
              <span className="st__who"><span className="lx-mg">{AGENT[a.agent].mono}</span><b>{AGENT[a.agent].name}</b></span>
              <span><span className={`mk ${a.installed ? "mk--on" : "mk--sg"}`}>{a.installed ? "installed" : "not found"}</span></span>
              <Cell c={a.map} on="MCP server linked" off="not linked" />
              <Cell c={a.report} on={a.agent === "muse" ? "through its log" : "hooks set"} off="not linked" />
              <Cell c={a.contract} on="contract set" off="no contract" />
              <span className="st__act">
                {!a.installed ? null : linked
                  ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={!!busy} onClick={() => act(a, false)}>{busy === a.agent ? "…" : "Unlink"}</button>
                  : <button className="vl-btn vl-btn--primary vl-btn--sm" disabled={!!busy} onClick={() => act(a, true)}>{busy === a.agent ? "…" : "Link"}</button>}
              </span>
            </div>
          );
        })}
        <p className="st__foot">Link writes in the agent's settings files, never in the project's code. Unlink puts them back exactly as they were. Muse Code and Claude Code share <code>.mcp.json</code> ; Muse Code and Codex share <code>AGENTS.md</code>.</p>
      </section>
      <div className="st__body">
        <section className="night st__contract">
          <span className="lbl">The contract given to agents</span>
          <h2>Read the map first, declare afterwards</h2>
          <p className="sub">A section added to AGENTS.md and CLAUDE.md, once, when you click. You review it before it is written.</p>
          <pre className="st__code">{`## VisionLayer
1. Call vision_summary first.
2. vision_slice on the elements of your task:
   the file:line of each relevant piece of code.
3. Read those addresses; vision_source for a symbol.
   No broad search to orient yourself.
4. After the change, vision_reach: say for
   each finding whether your change touches it.
5. In your PR, write in .vision/knowledge/ what
   the code doesn't say: the rule followed, the decision.`}</pre>
          <p className="sub">VisionLayer then checks each note against the code. A note is never written by a model in place of the agent.</p>
        </section>
        <section className="card">
          <div className="hd"><h2>What VisionLayer receives from a session</h2></div>
          <div className="st__keep">
            <div><span className="vl-label">Kept</span><p>the paths of files changed in the project</p><p>the VisionLayer tools called, and when</p><p>the token counts</p><p>the model and the branch</p></div>
            <div><span className="vl-label">Never</span><p>the text of a prompt</p><p>a command run</p><p>the content of a file</p><p>a path outside the project</p></div>
          </div>
          <p className="st__foot">Muse Code keeps its own log on the machine; VisionLayer reads it without copying it. The Claude Code and Codex hooks write in <code>.vision/activity/</code>, which is not committed.</p>
        </section>
      </div>
    </div>
  );
}

function Cell({ c, on, off }: { c: AgentLink["map"]; on: string; off: string }) {
  return <span className="st__cell"><span className={`mk ${c.linked ? "mk--on" : "mk--q"}`}>{c.linked ? on : off}</span><small>{c.where}</small></span>;
}
