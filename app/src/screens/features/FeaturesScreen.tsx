import { Fragment } from "react";
import type { MapPayload } from "../../api/types";
import { chainRuns, featureGroups, type Link } from "../../model/features";
import { Entry } from "../../lang/objects";
import { plural } from "../../model/words";
import "./features.css";

const VERB: Partial<Record<Link["kind"], string>> = { read: "reads", write: "writes", message: "queue", request: "calls" };

export function Chip({ l }: { l: Link }) {
  if (l.kind === "refuse") return <span className="ft-c ft-c--refuse">refuses {l.values.join(" ")}</span>;
  if (l.kind === "reply") return <span className="ft-c ft-c--reply">{l.values.join(", ")}</span>;
  return <span className={`ft-c ft-c--${l.kind}`}><em>{VERB[l.kind]}</em> {l.values.join(", ")}</span>;
}

export function Links({ links }: { links: Link[] }) {
  return <>{links.map((l, i) => <Fragment key={i}>{i > 0 && <i className="ft-ar" />}<Chip l={l} /></Fragment>)}</>;
}

/** Les fonctionnalités : par ressource, chaque point d'entrée et la chaîne de ce qu'il fait ; un clic ouvre son déroulé. */
export function FeaturesScreen({ map, openFlow }: { map: MapPayload; openFlow: (id: string) => void }) {
  const groups = featureGroups(map);
  const total = groups.reduce((n, g) => n + g.features.length, 0);
  return (
    <div className="page ft">
      <div className="ft__head">
        <h1 className="page__title">Features</h1>
        <span className="vl-count">{plural(total, "entry point", "entry points")}</span>
        <span className="ft__legend"><span className="ft-c ft-c--read"><em>reads</em> table</span><span className="ft-c ft-c--write"><em>writes</em> table</span><span className="ft-c ft-c--message"><em>queue</em> ou <em>calls</em></span><span className="ft-c ft-c--refuse">refus</span><span className="ft-c ft-c--reply">reply</span></span>
      </div>
      {total === 0 && <p className="ft__none">No entry point read in this project.</p>}
      {groups.map((g) => (
        <section key={g.id} className="ft-g">
          <header className="ft-g__h">
            <b className={g.http ? "mono" : ""}>{g.name}</b>
            <span>{plural(g.features.length, g.http ? "route" : "entry", g.http ? "routes" : "entries")}</span>
            <span>{g.writes.length ? `writes ${g.writes.join(", ")}` : "no write"}</span>
          </header>
          {g.features.map(({ entry, chain }) => (
            <button key={entry.id} className="ft-r" onClick={() => openFlow(entry.id)}>
              <span className="ft-r__entry"><Entry e={entry} /></span>
              <span className="ft-r__chain">
                {chain.length === 0 && <span className="ft-r__empty">no effect read</span>}
                {chainRuns(chain).map((run, i) => (
                  <Fragment key={i}>
                    {i > 0 && <i className="ft-ar" />}
                    {run.tx ? <span className="ft-tx"><small>transaction</small><Links links={run.links} /></span> : <Links links={run.links} />}
                  </Fragment>
                ))}
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
