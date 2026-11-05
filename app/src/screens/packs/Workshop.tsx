import { useState } from "react";
import type { MapPayload, PackProposal } from "../../api/types";
import { checks, forms, intro, steps } from "../../model/packs";
import { plural } from "../../model/words";
import { Icon } from "../../shell/icons";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { Rep } from "../../lang/Rep";

const TABS = [["forms", "Forms"], ["rules", "Rules"], ["yaml", "YAML"], ["brief", "Agent brief"]] as const;

/** Une proposition à décider, comme sur la planche : étapes, carte noire de décision, onglets, faits ajoutés, vérifications. */
export function Workshop({ map, proposal: p, others, open, accept, reject }: { map: MapPayload; proposal: PackProposal; others: PackProposal[]; open: (id?: string) => void; accept: () => void; reject: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("forms");
  const f = forms(p);
  const changes = p.preview?.changes ?? [];
  const added = changes.filter((c) => c.sign === "added"), removed = changes.filter((c) => c.sign === "removed");
  const findings = added.filter((c) => c.kind === "finding");
  const failed = p.preview?.state.status === "failed";
  // Les sources de la fiche : les titres de sa section “La documentation”, rien d'autre.
  const docPart = p.fiche.slice(Math.max(0, p.fiche.indexOf("## The documentation")));
  const docs = (docPart.match(/^### (.+)$/gm) ?? []).map((l) => l.slice(4).split("/").pop()!.replace(/^.*scratchpad\//, ""));
  const brief = (p.fiche.match(/^## (.+)$/gm) ?? []).map((l) => l.slice(3));
  const count = { forms: f.length, rules: p.rules.length, yaml: 1, brief: brief.length };
  const ch = checks(p);
  return (
    <div className="page">
      <div className="page__head">
        <div className="pk__intro">
          <div className="pk__titlerow">
            <h1 className="pk__title">{p.name}</h1>
            <span className={`vl-tag ${failed ? "vl-tag--critical" : "vl-tag--signal"}`}>{failed ? "Refused by the checks" : "Proposed, isolated domain"}</span>
            {others.map((o) => <button key={o.id} className="vl-tag vl-tag--neutral pk__other" onClick={() => open(o.id)}>{o.name}</button>)}
          </div>
          <p className="pk__sub">Written by Muse Spark 1.3{p.usage ? ` in ${plural(p.usage.turns, "turn", "turns")}, $${p.usage.cost.toFixed(2)}` : ""}, from {docs.length ? docs.slice(0, 3).join(", ") : "its documentation"}. <span className="pk__ink">Files of {map.model.system.name} read to write it: 0.</span></p>
        </div>
        <div className="pk__actions">
          <button className="vl-btn vl-btn--secondary" onClick={reject}>Refuse</button>
          <button className="vl-btn vl-btn--secondary" disabled title="Guided correction is coming; for now, refuse and rerun the writer">Ask for a correction</button>
        </div>
      </div>

      <ol className="pk__steps" aria-label="Recipe steps">
        {steps(p).map((s) => (
          <li key={s.n} className="pk__step">
            <span className={`pk__dot${s.done ? "" : " pk__dot--todo"}`}>{s.done ? "✓" : s.n}</span>
            <span className="pk__steptext"><span className="vl-label">{s.label}</span><span className={s.done ? "pk__count" : "pk__count pk__count--todo"}>{s.count}</span></span>
          </li>
        ))}
      </ol>

      <section className="pk__hero" aria-label="Decision">
        <div className="pk__heromain">
          <span className="vl-tag vl-tag--night pk__herotag">To decide, nothing is loaded</span>
          <h2 className="pk__herotitle">
            {failed ? <>This pack doesn't load on {map.model.system.name}.</>
              : changes.length ? <>With this pack, the map of {map.model.system.name} gagne {plural(added.length, "item", "items")}.<br />It loses {removed.length}{findings.length ? `, and flags ${plural(findings.length, "point", "points")}` : ""}.</>
              : <>This pack changes nothing on the map of {map.model.system.name}.</>}
          </h2>
          <p className="pk__herotext"><Rich text={failed ? p.preview!.state.reason ?? "" : intro(p).text} /></p>
          <div className="pk__heroactions">
            <button className="vl-btn vl-btn--light" onClick={accept} disabled={failed}>{Icon.packs}Load the pack</button>
          </div>
        </div>
        <div className="pk__heroside">
          <span className="vl-label vl-label--night pk__sidetitle">Diff on {map.model.system.name}</span>
          {[
            { v: `+${added.length}`, l: "items added", n: added.slice(0, 2).map((c) => c.text).join("; ") },
            { v: String(removed.length), l: removed.length > 1 ? "items removed" : "item removed", n: removed.length ? removed.slice(0, 2).map((c) => c.text).join("; ") : "facts from other packs don't move" },
            { v: `+${findings.length}`, l: "points to watch", n: findings.map((c) => c.text).join("; ") || "none", s: findings.length > 0 },
            { v: `${f.filter((x) => x.read).length}`, l: `forms read out of ${f.length}`, n: "the others are marked not read, with their reason" },
          ].map((d, i) => (
            <div key={i} className="pk__diff"><span className={`pk__diffv${d.s ? " pk__diffv--s" : ""}`}>{d.v}</span><span className="pk__difft"><span>{d.l}</span><span className="pk__diffn">{d.n}</span></span></div>
          ))}
        </div>
      </section>

      <div className="pk__body">
        <section className="vl-card pk__tabs" aria-label="The pack">
          <div className="vl-card__head pk__tabhead">
            <div role="tablist" className="pk__tablist">
              {TABS.map(([id, label]) => <button key={id} role="tab" className={`pk__tab${tab === id ? " pk__tab--on" : ""}`} onClick={() => setTab(id)}>{label}<span className="vl-count">{count[id]}</span></button>)}
            </div>
            <span className="mono pk__path">.vision/packs/proposes/{p.id}.yaml</span>
          </div>
          {tab === "forms" && (
            <div className="pk__scroll"><div className="pk__table">
              <div className="pk__row pk__row--head"><span className="vl-label">#</span><span className="vl-label">API form</span><span className="vl-label">Example</span><span className="vl-label">Lue</span></div>
              {f.map((x) => (
                <div key={x.n} className="pk__row">
                  <span className="mono pk__n">F{x.n}</span>
                  <span className="pk__form"><Rich text={x.form} /></span>
                  <span className="pk__ex"><Rich text={x.example} /></span>
                  <span className={x.read ? "pk__ok" : "pk__no"}>{x.read ? <><span className="pk__check">✓</span>lue</> : <Rich text={x.state} />}</span>
                </div>
              ))}
              {f.length === 0 && <p className="pk__empty">The pack's page lists no form.</p>}
            </div></div>
          )}
          {tab === "rules" && p.rules.map((r, i) => (
            <div key={i} className="pk__rule"><span className="mono pk__n">R{i + 1}</span><code className="vl-code">{r}</code></div>
          ))}
          {tab === "yaml" && <pre className="pk__yaml">{p.yaml}</pre>}
          {tab === "brief" && brief.map((b, i) => (
            <div key={i} className="pk__rule"><span className="mono pk__n">{i + 1}</span><p className="pk__brief">{b}</p></div>
          ))}
        </section>

        <div className="pk__side">
          <Signed name={p.name} changes={changes} />
          <section className="vl-card" aria-label="Checks">
            <div className="vl-card__head"><span className="vl-label">Checked by VisionLayer</span><span className={`mono ${ch.every((c) => c.ok) ? "pk__live" : "pk__bad"}`}>{ch.filter((c) => c.ok).length} / {ch.length}</span></div>
            {ch.map((c) => (
              <div key={c.title} className="pk__chk">
                <span className={c.ok ? "pk__check" : "pk__cross"}>{c.ok ? "✓" : "×"}</span>
                <div><p className="pk__chktitle">{c.title}</p><p className="pk__chknote">{c.note}</p></div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

const KIND: Record<string, [string, string]> = { node: ["block", "blocks"], entry: ["entry point", "entry points"], trust: ["proof", "proofs"], entity: ["table", "tables"], field: ["field", "fields"], value: ["value", "values"], edge: ["lien", "liens"], finding: ["finding", "findings"] };

/** C2, la différence signée : “+” ajouté, “−” retiré, avec sa preuve ; au-delà de douze, repliée par sorte. */
function Signed({ name, changes }: { name: string; changes: NonNullable<PackProposal["preview"]>["changes"] }) {
  const [open, setOpen] = useState<string>();
  const added = changes.filter((c) => c.sign === "added").length, removed = changes.length - added;
  const groups = new Map<string, typeof changes>();
  for (const c of changes) { const k = `${c.sign}:${c.kind}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(c); }
  const fold = changes.length > 12;
  const row = (c: (typeof changes)[number], i: number) => (
    <div key={i} className="pk__fact">
      <span className={`mono pk__sign${c.sign === "removed" ? " pk__sign--minus" : ""}`}>{c.sign === "added" ? "+" : "−"}</span>
      <div className="pk__factbody"><p className="pk__facttext"><Rich text={c.text} /></p>{c.proof && <Ref proof={c.proof} />}</div>
    </div>
  );
  return (
    <Rep code="C2" name="Signed diff" question="What changed?" flush
      sentence={changes.length ? `The ${name} pack adds ${plural(added, "fact", "facts")} to the map and removes ${removed}.` : `The ${name} pack changes nothing on the map.`}
      reads={fold ? "per row: “+” added, “−” removed; collapsed by kind, each group opens on its rows and their proof." : "per row: “+” added, “−” removed, with its proof."}>
      {!fold ? changes.map(row) : [...groups].map(([k, list]) => (
        <div key={k}>
          <button className="pk__fold" onClick={() => setOpen(open === k ? undefined : k)}>
            <span className={`mono pk__sign${k.startsWith("removed") ? " pk__sign--minus" : ""}`}>{k.startsWith("added") ? "+" : "−"}{list.length}</span>
            <span>{KIND[list[0]!.kind]?.[list.length > 1 ? 1 : 0] ?? list[0]!.kind}</span><span className="pk__muted">{open === k ? "replier" : "ouvrir"}</span>
          </button>
          {open === k && list.slice(0, 40).map(row)}
        </div>
      ))}
    </Rep>
  );
}
