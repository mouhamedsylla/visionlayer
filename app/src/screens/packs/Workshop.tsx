import { useState } from "react";
import type { MapPayload, PackProposal } from "../../api/types";
import { checks, forms, intro, steps } from "../../model/packs";
import { plural } from "../../model/words";
import { Icon } from "../../shell/icons";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

const TABS = [["forms", "Formes"], ["rules", "Règles"], ["yaml", "YAML"], ["brief", "Fiche de l'agent"]] as const;

/** Une proposition à décider, comme sur la planche : étapes, carte noire de décision, onglets, faits ajoutés, vérifications. */
export function Workshop({ map, proposal: p, others, open, accept, reject }: { map: MapPayload; proposal: PackProposal; others: PackProposal[]; open: (id?: string) => void; accept: () => void; reject: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("forms");
  const f = forms(p);
  const changes = p.preview?.changes ?? [];
  const added = changes.filter((c) => c.sign === "added"), removed = changes.filter((c) => c.sign === "removed");
  const findings = added.filter((c) => c.kind === "finding");
  const failed = p.preview?.state.status === "failed";
  // Les sources de la fiche : les titres de sa section « La documentation », rien d'autre.
  const docPart = p.fiche.slice(Math.max(0, p.fiche.indexOf("## La documentation")));
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
            <span className={`vl-tag ${failed ? "vl-tag--critical" : "vl-tag--signal"}`}>{failed ? "Refusé par les vérifications" : "Proposé, domaine isolé"}</span>
            {others.map((o) => <button key={o.id} className="vl-tag vl-tag--neutral pk__other" onClick={() => open(o.id)}>{o.name}</button>)}
          </div>
          <p className="pk__sub">Écrit par Muse Spark 1.3{p.usage ? ` en ${plural(p.usage.turns, "échange", "échanges")}, ${p.usage.cost.toFixed(2)} $` : ""}, depuis {docs.length ? docs.slice(0, 3).join(", ") : "sa documentation"}. <span className="pk__ink">Fichiers de {map.model.system.name} lus pour l'écrire : 0.</span></p>
        </div>
        <div className="pk__actions">
          <button className="vl-btn vl-btn--secondary" onClick={reject}>Refuser</button>
          <button className="vl-btn vl-btn--secondary" disabled title="La correction guidée arrive ; en attendant, refuser puis relancer l'écrivain">Demander une correction</button>
        </div>
      </div>

      <ol className="pk__steps" aria-label="Étapes de la recette">
        {steps(p).map((s) => (
          <li key={s.n} className="pk__step">
            <span className={`pk__dot${s.done ? "" : " pk__dot--todo"}`}>{s.done ? "✓" : s.n}</span>
            <span className="pk__steptext"><span className="vl-label">{s.label}</span><span className={s.done ? "pk__count" : "pk__count pk__count--todo"}>{s.count}</span></span>
          </li>
        ))}
      </ol>

      <section className="pk__hero" aria-label="Décision">
        <div className="pk__heromain">
          <span className="vl-tag vl-tag--night pk__herotag">À décider, rien n'est chargé</span>
          <h2 className="pk__herotitle">
            {failed ? <>Ce pack ne se charge pas sur {map.model.system.name}.</>
              : changes.length ? <>Avec ce pack, la carte de {map.model.system.name} gagne {plural(added.length, "élément", "éléments")}.<br />Elle en perd {removed.length}{findings.length ? `, et signale ${plural(findings.length, "point", "points")}` : ""}.</>
              : <>Ce pack ne change rien sur la carte de {map.model.system.name}.</>}
          </h2>
          <p className="pk__herotext"><Rich text={failed ? p.preview!.state.reason ?? "" : intro(p).text} /></p>
          <div className="pk__heroactions">
            <button className="vl-btn vl-btn--light" onClick={accept} disabled={failed}>{Icon.packs}Charger le pack</button>
          </div>
        </div>
        <div className="pk__heroside">
          <span className="vl-label vl-label--night pk__sidetitle">Différence sur {map.model.system.name}</span>
          {[
            { v: `+${added.length}`, l: "éléments ajoutés", n: added.slice(0, 2).map((c) => c.text).join(" ; ") },
            { v: String(removed.length), l: removed.length > 1 ? "éléments retirés" : "élément retiré", n: removed.length ? removed.slice(0, 2).map((c) => c.text).join(" ; ") : "les faits des autres packs ne bougent pas" },
            { v: `+${findings.length}`, l: "points à surveiller", n: findings.map((c) => c.text).join(" ; ") || "aucun", s: findings.length > 0 },
            { v: `${f.filter((x) => x.read).length}`, l: `formes lues sur ${f.length}`, n: "les autres sont dites non lues, avec leur raison" },
          ].map((d, i) => (
            <div key={i} className="pk__diff"><span className={`pk__diffv${d.s ? " pk__diffv--s" : ""}`}>{d.v}</span><span className="pk__difft"><span>{d.l}</span><span className="pk__diffn">{d.n}</span></span></div>
          ))}
        </div>
      </section>

      <div className="pk__body">
        <section className="vl-card pk__tabs" aria-label="Le pack">
          <div className="vl-card__head pk__tabhead">
            <div role="tablist" className="pk__tablist">
              {TABS.map(([id, label]) => <button key={id} role="tab" className={`pk__tab${tab === id ? " pk__tab--on" : ""}`} onClick={() => setTab(id)}>{label}<span className="vl-count">{count[id]}</span></button>)}
            </div>
            <span className="mono pk__path">.vision/packs/proposes/{p.id}.yaml</span>
          </div>
          {tab === "forms" && (
            <div className="pk__scroll"><div className="pk__table">
              <div className="pk__row pk__row--head"><span className="vl-label">#</span><span className="vl-label">Forme de l'API</span><span className="vl-label">Exemple</span><span className="vl-label">Lue</span></div>
              {f.map((x) => (
                <div key={x.n} className="pk__row">
                  <span className="mono pk__n">F{x.n}</span>
                  <span className="pk__form"><Rich text={x.form} /></span>
                  <span className="pk__ex"><Rich text={x.example} /></span>
                  <span className={x.read ? "pk__ok" : "pk__no"}>{x.read ? <><span className="pk__check">✓</span>lue</> : <Rich text={x.state} />}</span>
                </div>
              ))}
              {f.length === 0 && <p className="pk__empty">La page du pack ne liste aucune forme.</p>}
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
          <section className="vl-card" aria-label="Faits ajoutés">
            <div className="vl-card__head"><span className="vl-label">Ce qu'il ajoute <span className="vl-count">{added.length}</span></span><span className="mono pk__muted">− {removed.length} retiré{removed.length > 1 ? "s" : ""}</span></div>
            {changes.length === 0 && <p className="pk__empty">Rien ne change sur la carte.</p>}
            {changes.slice(0, 12).map((c, i) => (
              <div key={i} className="pk__fact">
                <span className={`mono pk__sign${c.sign === "removed" ? " pk__sign--minus" : ""}`}>{c.sign === "added" ? "+" : "−"}</span>
                <div className="pk__factbody"><p className="pk__facttext"><Rich text={c.text} /></p>{c.proof && <Ref proof={c.proof} />}</div>
              </div>
            ))}
          </section>
          <section className="vl-card" aria-label="Vérifications">
            <div className="vl-card__head"><span className="vl-label">Vérifié par VisionLayer</span><span className={`mono ${ch.every((c) => c.ok) ? "pk__live" : "pk__bad"}`}>{ch.filter((c) => c.ok).length} / {ch.length}</span></div>
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
