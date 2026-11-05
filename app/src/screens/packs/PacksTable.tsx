import type { MapPayload, PacksPayload } from "../../api/types";
import type { TechRow } from "../../model/packs";
import { plural } from "../../model/words";
import { CodeRef } from "../../ui/CodeRef";
import { useOpenCode } from "../../ui/code";

const STATE: Record<TechRow["state"], [string, string]> = {
  unread: ["Not read", "pk-nl"], queued: ["Queued", "pk-nl"], writing: ["Writing", "vl-tag vl-tag--signal"], failed: ["Not loaded", "vl-tag vl-tag--critical"], read: ["Read", "vl-tag vl-tag--live"],
};
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

/** Planche P2 : une ligne par technologie, son état bien visible, ce que la carte en tire, et une seule action. */
export function PacksTable({ map, data, rows, write, dequeue, retire, busy }: { map: MapPayload; data: PacksPayload; rows: TechRow[]; write: (pkgs: string[]) => void; dequeue: (pkg: string) => void; retire: (id: string) => void; busy?: string }) {
  const open = useOpenCode();
  const unread = rows.filter((r) => r.state !== "read" && !r.lib);
  const libs = rows.filter((r) => r.lib);
  const read = rows.filter((r) => r.state === "read" && !r.lib);
  const todo = unread.filter((r) => r.pkg && (r.state === "unread" || r.state === "failed")).map((r) => r.pkg!);
  const name = map.model.system.name;
  return (
    <div className="page pk2">
      <div className="pk2__head">
        <div className="pk2__intro">
          <h1 className="page__title">Packs</h1>
          <p className="pk__sub">The technologies that {name} uses, and what VisionLayer can read of them. <span className="pk__ink">{read.length} out of {read.length + unread.length} are read.{unread.length ? ` Without ${unread.length > 1 ? `the other ${unread.length}` : "the other"}, the map says nothing about ${plural(unread.reduce((n, r) => n + r.files, 0), "file", "files")}.` : ""}{libs.length ? ` The code also imports ${plural(libs.length, "library", "libraries")} with no pack: the map doesn't say what they do.` : ""}{!unread.length && !libs.length ? " The map reads everything the code imports." : ""}</span></p>
        </div>
        {todo.length > 0 && <button className="vl-btn vl-btn--primary" disabled={!!busy} onClick={() => write(todo)}>{todo.length > 1 ? `Write the ${todo.length} missing packs` : "Write the missing pack"}</button>}
      </div>
      <section className="vl-card pk2__card" aria-label="Project technologies">
        <div className="pk2__row pk2__row--h"><span className="vl-label">Technology</span><span className="vl-label">Where in the code</span><span className="vl-label">On the map</span><span className="vl-label">Pack</span><span className="vl-label">State</span><span /></div>
        {unread.length > 0 && <div className="pk2__grp"><b>Not read yet</b><span className="mono">{unread.length}</span></div>}
        {unread.map((r) => <Row key={r.key} r={r} open={open} action={
          r.state === "queued" ? <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => dequeue(r.pkg!)}>Remove from queue</button>
            : r.state === "writing" ? null
            : r.pkg ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={!!busy} onClick={() => write([r.pkg!])}>{r.state === "failed" ? "Retry" : "Write the pack"}</button> : null
        } />)}
        {libs.length > 0 && <div className="pk2__grp"><b>Libraries with no pack</b><span className="mono">{libs.length}</span></div>}
        {libs.map((r) => <Row key={r.key} r={r} open={open} action={
          r.state === "queued" ? <button className="vl-btn vl-btn--secondary vl-btn--sm" onClick={() => dequeue(r.pkg!)}>Remove from queue</button>
            : r.state === "writing" ? null
            : <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={!!busy} onClick={() => write([r.pkg!])}>{r.state === "failed" ? "Retry" : "Write the pack"}</button>
        } />)}
        <div className="pk2__grp"><b>Read</b><span className="mono">{read.length}</span></div>
        {read.map((r) => <Row key={r.key} r={r} open={open} action={r.pack && r.pack.by !== "builtin" ? <button className="vl-btn vl-btn--secondary vl-btn--sm" disabled={busy === r.key} onClick={() => retire(r.pack!.id)}>{busy === r.key ? "…" : "Remove"}</button> : null} />)}
        <div className="vl-card__foot"><span>A pack teaches VisionLayer to read a technology. Muse Spark writes it from the technology's documentation, installed or published, never from your code; it loads by itself when all its checks pass, and is removed in one click.{data.job && !data.job.done ? ` Writing: ${data.job.pkg}.` : ""}</span></div>
      </section>
    </div>
  );
}

function Row({ r, open, action }: { r: TechRow; open: ReturnType<typeof useOpenCode>; action: React.ReactNode }) {
  const [label, cls] = STATE[r.state];
  const sub = r.state === "read" ? (r.files ? plural(r.files, "file", "files") : "") : `${plural(r.files, "file", "files")} import it`;
  return (
    <div className="pk2__row">
      <div><p className="pk2__name">{r.name}{r.version && <span className="mono"> {r.version}</span>}</p><small>{r.family}</small></div>
      <div className="pk2__where">{r.where ? <CodeRef proof={r.where} onOpen={open} /> : <span className="pk2__muted">—</span>}<small>{sub}</small></div>
      <div><p>{r.state === "read" ? r.gives : <><b>Not read:</b> {r.gives}</>}</p>
        {(r.findings.critical > 0 || r.findings.signal > 0) && <small><span className={r.findings.critical ? "pk2__cr" : "pk2__sg"}>{r.findings.critical ? plural(r.findings.critical, "finding", "findings") : `${r.findings.signal} to watch`}</span>{r.findings.first ? ` : ${r.findings.first.replace(/`/g, "")}` : ""}</small>}
      </div>
      <div><p>{r.pack ? (r.pack.by === "muse" ? "written by Muse, loaded by itself" : r.pack.by === "project" ? "project pack" : r.pack.id) : r.state === "writing" ? "being written by Muse" : "none"}</p>
        <small>{r.pack?.by === "muse" ? `${r.pack.at ? DAY.format(new Date(r.pack.at)) : ""}${r.pack.tests ? `, ${r.pack.tests} tests` : ""}${r.pack.cost !== undefined ? `, ${r.pack.cost.toFixed(2)} $` : ""}` : r.pack?.by === "project" ? `.vision/packs/${r.pack.id}.yaml` : r.pack ? "shipped with VisionLayer" : r.pkg ? `package ${r.pkg}` : ""}</small>
      </div>
      <div className="pk2__state"><span className={cls}>{label}</span>{r.note && <small>{r.note}</small>}{r.state === "writing" && <span className="pk2__bar"><i /></span>}</div>
      <div className="pk2__act">{action}</div>
    </div>
  );
}
