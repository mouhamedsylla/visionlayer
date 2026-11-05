import { useEffect, useState } from "react";
import type { ArchNode, KnowledgePayload, MapPayload } from "../../api/types";
import { api } from "../../api/client";
import { rules, rulesOf, type Evidence, type RuleRow } from "../../model/rules";
import { plural } from "../../model/words";
import { Ref } from "../../ui/Ref";
import "./rules.css";

/**
 * Planche Regles, Règles et décisions : ce qui est déclaré, par un agent ou dans un document, confronté au code.
 * L'adresse garde la règle choisie (#/regles/<id>).
 */
export function RulesScreen({ map, block, knowledge, item, open }: { map: MapPayload; block?: ArchNode; knowledge?: KnowledgePayload; item?: string; open: (id: string) => void }) {
  const list = block ? rulesOf(rules(knowledge), map, block) : rules(knowledge);
  const sel = list.find((r) => r.id === item) ?? list[0];
  const agents = list.filter((r) => r.who === "agent"), docs = list.filter((r) => r.who === "document");
  const count = (t: RuleRow["tone"]) => agents.filter((r) => r.tone === t).length;
  const bad = list.find((r) => r.tone === "cr");
  const docFiles = [...new Set(docs.map((d) => d.src.path))];
  const lead = [
    agents.length ? `${plural(agents.length, "rule declared", "rules declared")} by agents, checked against the code: ${[count("ok") && `${count("ok")} ${count("ok") > 1 ? "hold" : "holds"}`, count("q") && `${count("q")} in force`, count("sg") && `${count("sg")} to reconfirm`, count("cr") && `${count("cr")} contradicted`].filter(Boolean).join(", ")}.` : "No rule has been declared by an agent yet.",
    docs.length ? `${plural(docs.length, "rule written", "rules written")} in ${docFiles.join(", ")}, not anchored: nothing checks them.` : "",
  ].filter(Boolean).join(" ");
  return (
    <div className="rg">
      <div className="rg__top">
        <div className="rg__title">
          <div className="rg__h"><h1>Rules and decisions</h1><span className="vl-tag vl-tag--neutral">{plural(list.length, "rule", "rules")}</span>{count("cr") > 0 && <span className="vl-tag vl-tag--critical">{count("cr")} contredite{count("cr") > 1 ? "s" : ""}</span>}</div>
          <p>{lead}</p>
        </div>
      </div>

      {bad ? <Contradicted r={bad} />
        : docs.length > 0 ? (
          <section className="rg__night">
            <div className="rg__nmain">
              <span className="vl-tag vl-tag--signal rg__ntag">Stated, never checked</span>
              <h2>{plural(docs.length, "business rule is written", "business rules are written")} in {docFiles.join(", ")}. None is linked to the code that holds it.</h2>
              <p className="rg__nsub">VisionLayer doesn't turn a sentence into code: an agent working on this code declares the rule in <code>.vision/knowledge/</code> and anchors it where it is decided. It is then re-checked at every analysis, and contradicted if its code no longer holds it.</p>
            </div>
            <div className="rg__nside">
              <span className="vl-label vl-label--night">Written in the document</span>
              {docs.slice(0, 4).map((d, i) => <div key={d.id} className="rg__np"><span className="rg__step">{i + 1}</span><div><p>{d.text}</p><small>{d.src.path}:{d.src.line}</small></div></div>)}
            </div>
          </section>
        ) : null}

      {list.length === 0 ? (
        <section className="vl-card rg__empty"><p>Nothing is declared: no agent rule in <code>.vision/knowledge/</code>, no “Rules” section in the README or <code>docs/</code>.</p></section>
      ) : (
        <div className="rg__body">
          <section className="vl-card rg__list" aria-label="Rules">
            <div className="vl-card__head"><span className="vl-label">What is declared</span><span className="rg__hint">Pick a rule to see its proof</span></div>
            <div className="rl rl--h"><span className="vl-label">Declared</span><span className="vl-label">In the code</span><span className="vl-label">State</span></div>
            {list.map((r) => (
              <div key={r.id} className={`rl${r.id === sel?.id ? " rl--on" : ""}`} onClick={() => open(r.id)}>
                <div><p>{r.text}</p><span className="rl__src"><span className="rl__who">{r.who === "agent" ? `${r.kind}, declared by an agent` : "written in a document"}</span><Ref proof={r.src} /></span></div>
                <p className="sub">{r.code}</p>
                <span className={`stt stt--${r.tone}`}>{r.state}</span>
              </div>
            ))}
          </section>
          {sel && <Proofs r={sel} />}
        </div>
      )}
    </div>
  );
}

function Contradicted({ r }: { r: RuleRow }) {
  return (
    <section className="rg__night">
      <div className="rg__nmain">
        <span className="vl-tag vl-tag--critical rg__ntag">Contradicted by the code</span>
        <h2>{r.text}</h2>
        <div className="vs">
          <div className="vbox"><span>Declared by an agent</span><b>{r.kind}</b><small>{r.src.path}:{r.src.line}</small></div>
          <div className="vsep">≠</div>
          <div className="vbox vbox--code"><span>Read from the code</span><b>{r.code.replace(/^No longer holds: /, "")}</b><small>{r.evidence.find((e) => e.note)?.path ?? ""}{r.evidence.find((e) => e.note)?.line ? `:${r.evidence.find((e) => e.note)!.line}` : ""}</small></div>
        </div>
        <p className="rg__nsub">{r.note}</p>
      </div>
      <div className="rg__nside">
        <span className="vl-label vl-label--night">Where it is anchored</span>
        {r.evidence.map((e, i) => <div key={i} className={`rg__np${e.note ? " rg__np--cr" : ""}`}><span className="rg__step">{i + 1}</span><div><p>{e.what}{e.note ? ` : ${e.note}` : ""}</p><small>{e.path}{e.line ? `:${e.line}` : ""}</small></div></div>)}
      </div>
    </section>
  );
}

function Proofs({ r }: { r: RuleRow }) {
  return (
    <aside className="vl-card rg__proofs" aria-label="Rule proof">
      <div className="vl-card__head"><span className="vl-label">Proof</span><span className={`stt stt--${r.tone}`}>{r.state}</span></div>
      <p className="rg__ptext">{r.text}</p>
      <div className="evl"><p>{r.who === "agent" ? "Declared here" : "Written here"}</p><Ref proof={r.src} /></div>
      {r.evidence.map((e, i) => <Excerpt key={`${r.id}/${i}`} e={e} />)}
      {r.tests.length > 0 && <div className="evl"><p>{plural(r.tests.length, "test atteint", "tests atteignent")} its code</p><div className="rg__tests">{r.tests.slice(0, 4).map((t) => <Ref key={t} proof={{ path: t, line: 0 }} />)}</div></div>}
      <p className="rg__note">{r.note}</p>
    </aside>
  );
}

/** Une preuve et les lignes qu'elle ancre, lues dans le dépôt. */
function Excerpt({ e }: { e: Evidence }) {
  const [lines, setLines] = useState<string[]>();
  useEffect(() => {
    if (!e.line) return;
    let live = true;
    api.source(e.path, e.line, Math.min(e.to || e.line, e.line + 3)).then((x) => { if (live) setLines(x.lines); }).catch(() => {});
    return () => { live = false; };
  }, [e.path, e.line, e.to]);
  return (
    <div className="evl">
      <p>{e.what}{e.note ? <span className="evl__note"> : {e.note}</span> : null}</p>
      {e.line > 0 && <Ref proof={{ path: e.path, line: e.line }} />}
      {lines && <code>{lines.join("\n")}</code>}
    </div>
  );
}
