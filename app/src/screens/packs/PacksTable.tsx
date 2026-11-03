import type { MapPayload, PacksPayload } from "../../api/types";
import type { TechRow } from "../../model/packs";
import { plural } from "../../model/words";
import { CodeRef } from "../../ui/CodeRef";
import { useOpenCode } from "../../ui/code";

const STATE: Record<TechRow["state"], [string, string]> = {
  unread: ["Non lu", "pk-nl"], queued: ["En file", "pk-nl"], writing: ["En écriture", "vl-tag vl-tag--signal"], failed: ["Pas chargé", "vl-tag vl-tag--critical"], read: ["Lu", "vl-tag vl-tag--live"],
};
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** Planche P2 : une ligne par technologie, son état bien visible, ce que la carte en tire, et une seule action. */
export function PacksTable({ map, data, rows, write, dequeue, retire, busy }: { map: MapPayload; data: PacksPayload; rows: TechRow[]; write: (pkgs: string[]) => void; dequeue: (pkg: string) => void; retire: (id: string) => void; busy?: string }) {
  const open = useOpenCode();
  const unread = rows.filter((r) => r.state !== "read");
  const read = rows.filter((r) => r.state === "read");
  const todo = unread.filter((r) => r.pkg && (r.state === "unread" || r.state === "failed")).map((r) => r.pkg!);
  const name = map.model.system.name;
  return (
    <div className="page pk2">
      <div className="pk2__head">
        <div className="pk2__intro">
          <h1 className="page__title">Packs</h1>
          <p className="pk__sub">Les technologies que {name} emploie, et ce que VisionLayer sait en lire. <span className="pk__ink">{read.length} sur {rows.length} sont lues.{unread.length ? ` Sans ${unread.length > 1 ? `les ${unread.length} autres` : "l'autre"}, la carte ne dit rien de ${plural(unread.reduce((n, r) => n + r.files, 0), "fichier", "fichiers")}.` : " La carte lit tout ce que le code emploie."}</span></p>
        </div>
        {todo.length > 0 && <button className="vl-btn vl-btn--primary" disabled={!!busy} onClick={() => write(todo)}>{todo.length > 1 ? `Écrire les ${todo.length} packs manquants` : "Écrire le pack manquant"}</button>}
      </div>
      <section className="vl-card pk2__card" aria-label="Technologies du projet">
        <div className="pk2__row pk2__row--h"><span className="vl-label">Technologie</span><span className="vl-label">Où dans le code</span><span className="vl-label">Sur la carte</span><span className="vl-label">Pack</span><span className="vl-label">État</span><span /></div>
        {unread.length > 0 && <div className="pk2__grp"><b>Pas encore lues</b><span className="mono">{unread.length}</span></div>}
        {unread.map((r) => <Row key={r.key} r={r} open={open} action={
          r.state === "queued" ? <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => dequeue(r.pkg!)}>Retirer de la file</button>
            : r.state === "writing" ? null
            : r.pkg ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={!!busy} onClick={() => write([r.pkg!])}>{r.state === "failed" ? "Réessayer" : "Écrire le pack"}</button> : null
        } />)}
        <div className="pk2__grp"><b>Lues</b><span className="mono">{read.length}</span></div>
        {read.map((r) => <Row key={r.key} r={r} open={open} action={r.pack && r.pack.by !== "builtin" ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={busy === r.key} onClick={() => retire(r.pack!.id)}>{busy === r.key ? "…" : "Retirer"}</button> : null} />)}
        <div className="vl-card__foot"><span>Un pack apprend à VisionLayer à lire une technologie. Muse Spark l'écrit depuis la documentation installée, jamais depuis ton code ; il se charge seul quand toutes ses vérifications passent, et se retire d'un clic.{data.job && !data.job.done ? ` En écriture : ${data.job.pkg}.` : ""}</span></div>
      </section>
    </div>
  );
}

function Row({ r, open, action }: { r: TechRow; open: ReturnType<typeof useOpenCode>; action: React.ReactNode }) {
  const [label, cls] = STATE[r.state];
  const sub = r.state === "read" ? (r.files ? plural(r.files, "fichier", "fichiers") : "") : `${plural(r.files, "fichier", "fichiers")} l'importent`;
  return (
    <div className="pk2__row">
      <div><p className="pk2__name">{r.name}{r.version && <span className="mono"> {r.version}</span>}</p><small>{r.family}</small></div>
      <div className="pk2__where">{r.where ? <CodeRef proof={r.where} onOpen={open} /> : <span className="pk2__muted">—</span>}<small>{sub}</small></div>
      <div><p>{r.state === "read" ? r.gives : <><b>Non lu :</b> {r.gives}</>}</p>
        {(r.findings.critical > 0 || r.findings.signal > 0) && <small><span className={r.findings.critical ? "pk2__cr" : "pk2__sg"}>{r.findings.critical ? plural(r.findings.critical, "constat", "constats") : `${r.findings.signal} à surveiller`}</span>{r.findings.first ? ` : ${r.findings.first.replace(/`/g, "")}` : ""}</small>}
      </div>
      <div><p>{r.pack ? (r.pack.by === "muse" ? "écrit par Muse, chargé seul" : r.pack.by === "project" ? "pack du projet" : r.pack.id) : r.state === "writing" ? "en écriture par Muse" : "aucun"}</p>
        <small>{r.pack?.by === "muse" ? `${r.pack.at ? DAY.format(new Date(r.pack.at)) : ""}${r.pack.tests ? `, ${r.pack.tests} tests` : ""}${r.pack.cost !== undefined ? `, ${r.pack.cost.toFixed(2)} $` : ""}` : r.pack?.by === "project" ? `.vision/packs/${r.pack.id}.yaml` : r.pack ? "livré avec VisionLayer" : r.pkg ? `paquet ${r.pkg}` : ""}</small>
      </div>
      <div className="pk2__state"><span className={cls}>{label}</span>{r.note && <small>{r.note}</small>}{r.state === "writing" && <span className="pk2__bar"><i /></span>}</div>
      <div className="pk2__act">{action}</div>
    </div>
  );
}
