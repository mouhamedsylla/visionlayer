import type { MapPayload, PacksPayload } from "../../api/types";
import { Icon } from "../../shell/icons";

/** Sans proposition à décider : ce que le code emploie et qu'aucun pack ne lit, chacun avec l'écrivain à lancer ; puis les packs chargés. */
export function PacksHome({ map, data, open, write }: { map: MapPayload; data: PacksPayload; open: (id?: string) => void; write: (pkg: string) => void }) {
  const gaps = map.model.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "pack_missing");
  const pkgOf = (subject: string) => {
    // Le paquet importé que la couverture désigne : le spécificateur de la première ligne qui l'emploie.
    const g = gaps.find((x) => x.subject === subject);
    const m = (g?.proof?.text ?? "").match(/from\s+["']([^"']+)["']/);
    return m?.[1]?.replace(/^(@[^/]+\/[^/]+|[^@/][^/]*).*$/, "$1");
  };
  const job = data.job;
  return (
    <div className="page">
      <div className="page__head"><div><h1 className="page__title">Packs</h1><p className="pk__sub">Un pack apprend à VisionLayer à lire une technologie. Muse Spark l'écrit depuis la documentation de la technologie, jamais depuis ce projet ; rien n'est chargé avant qu'un humain l'accepte.</p></div></div>
      <section className="pk__hero" aria-label="Ce qui n'est pas lu">
        <div className="pk__heromain">
          <span className="vl-tag vl-tag--signal pk__herotag">{gaps.length ? "Non lu" : "Tout est lu"}</span>
          <h2 className="pk__herotitle">{gaps.length ? <>Le code emploie {gaps.length} technologie{gaps.length > 1 ? "s" : ""} qu'aucun pack ne lit.</> : <>Chaque technologie employée a son pack.</>}</h2>
          <p className="pk__herotext">{job ? (job.done ? (job.ok ? "L'écrivain a fini : sa proposition est prête à décider." : "L'écrivain s'est arrêté sans proposition.") : `Muse Spark écrit le pack de ${job.pkg}…`) : "Choisir une technologie lance l'écrivain. Il lit la documentation installée, écrit l'inventaire des formes, un test par forme, les règles ; VisionLayer vérifie et l'essaie à part."}</p>
          {job && <pre className="pk__log">{job.lines.slice(-8).join("\n")}</pre>}
        </div>
        <div className="pk__heroside">
          <span className="vl-label vl-label--night pk__sidetitle">Technologies non lues</span>
          {gaps.map((g) => {
            const pkg = pkgOf(g.subject);
            return (
              <div key={g.subject} className="pk__gap">
                <span className="pk__gapname">{g.subject}<span className="pk__diffn">{g.count} fichier{g.count > 1 ? "s" : ""}{pkg ? `, paquet ${pkg}` : ""}</span></span>
                <button className="vl-btn vl-btn--light vl-btn--sm" disabled={!pkg || (!!job && !job.done)} onClick={() => pkg && write(pkg)}>{Icon.packs}Écrire le pack</button>
              </div>
            );
          })}
          {job?.done && job.ok && <button className="vl-btn vl-btn--ghost-night pk__openbtn" onClick={() => open()}>Ouvrir la proposition</button>}
        </div>
      </section>
      <section className="vl-card" aria-label="Packs chargés">
        <div className="vl-card__head"><span className="vl-label">Packs livrés</span><span className="mono pk__muted">{data.builtins.filter((b) => b.used).length} employés sur ce projet</span></div>
        <div className="vl-card__body pk__chips">
          {data.builtins.map((b) => <span key={b.id} className={`vl-ref${b.used ? "" : " pk__idle"}`} title={b.name}><b>{b.id}</b></span>)}
          {data.local.map((l) => <span key={l} className="vl-ref pk__local"><b>{l}</b><span>écrit par Muse</span></span>)}
        </div>
      </section>
    </div>
  );
}
