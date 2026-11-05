import type { ArchNode, MapPayload } from "../../api/types";
import { dataTable, lifecycle, stores, writers } from "../../model/data";
import { Rep } from "../../lang/Rep";
import { Lifecycle } from "./Lifecycle";
import { Workspace } from "../../ui/Workspace";
import { plural } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";
import { Method } from "./Method";
import "./data.css";

/** Planche 05, Données : qui lit, qui écrit, et sous quel contrôle. */
export function DataScreen({ map, block, item, open, openFlow, openTable }: { map: MapPayload; block?: ArchNode; item?: string; open: (id?: string, replace?: boolean) => void; openFlow: (id: string) => void; openTable: (id: string) => void }) {
  const list = stores(map, block);
  // L'adresse porte le stockage et la table choisie (`postgres/order`) : le retour ramène à la même ligne.
  const [storeKey, chosen] = item?.includes("/") ? [item.slice(0, item.indexOf("/")), item.slice(item.indexOf("/") + 1)] : [item, undefined];
  const store = list.find((s) => s.id === storeKey || s.name === storeKey) ?? list.find((s) => s.facets.data?.entities.length) ?? list[0];
  if (!store) return <div className="page"><h1 className="dx__title">Data</h1><p className="dx__lead">No storage is read on this project.</p></div>;
  const t = dataTable(map, store, block);
  const race = t.rows.find((r) => r.seeTone === "cr");
  const row = t.rows.find((r) => r.entity.name === chosen) ?? race ?? t.rows[0];
  const groups = [...new Set(t.rows.map((r) => r.group))];
  const unique = t.rows.filter((r) => r.constraint).length;
  const decl = store.facets.data?.entities[0]?.proof;
  const grid = { gridTemplateColumns: `128px repeat(${t.columns.length}, 98px) minmax(0, 1fr) minmax(0, 1.25fr)` };
  const life = row && lifecycle(row.entity);
  const writing = t.columns.filter((c) => t.rows.some((r) => r.cells[c.id]?.write)).length;
  return (
    <Workspace
      head={<div className="dx__intro">
        <h1 className="dx__title">Data</h1>
      </div>}
      panel={row && <Side map={map} store={store} row={row} findings={t.findings} openFlow={openFlow} openTable={() => openTable(`${store.id}/${row.entity.name}`)} />}>
      <div className="tiles">
        <div className="tile"><small>Tables</small><b>{plural(t.rows.length, "table", "tables")}</b><span>{groups.length > 1 ? `in ${groups.length} groups: ${groups.join(", ").toLowerCase()}` : "declared in the code"}</span></div>
        <div className="tile"><small>Code access</small><b>{plural(t.columns.length, "part of the code", "parts of the code")}</b><span>{t.columns.map((c) => c.label.toLowerCase()).join(", ")}</span></div>
        <div className="tile"><small>Constraints</small><b>{plural(unique, "unique constraint", "unique constraints")}</b><span>{t.rows.find((r) => r.constraint?.includes(", si "))?.constraint ?? "read from the schema"}</span></div>
        <div className={`tile${race ? " tile--cr" : ""}`}><small>Read then write</small><b>{race ? race.entity.name : "none"}</b><span>{race ? <Rich text={t.findings.find((f) => f.code === "race_read_then_write")?.message.split(",")[0] ?? ""} /> : "no race read"}</span></div>
      </div>
        <Rep code="X1" name="Access matrix" question="Who touches what?" flush
          sentence={`${plural(t.rows.length, "table", "tables")} of ${store.name}, touched by ${plural(t.columns.length, "part of the code", "parts of the code")}; ${writing} write${writing > 1 ? "" : "s"} there.`}
          reads="per row: a table, and what each part of the code does there. Black, it writes; outlined, it reads. In red, what's worth checking. Pick a row to see its lifecycle and who writes it; double-click opens what it means.">
          <div className="tabs">
            {list.map((s) => <button key={s.id} className={`seg${s.id === store.id ? " seg--on" : ""}`} onClick={() => open(s.id)}>{s.name} <span className="vl-count">{s.facets.data?.entities.length ?? s.facets.channel?.topics.length ?? 0}</span></button>)}
            <span className="note"><span className="rw"><i>reads</i><i className="w">writes</i></span></span>
          </div>
          <div className="dt dt--h" style={grid}><span>Table</span>{t.columns.map((c) => <span key={c.id}>{c.label}</span>)}<span>Constraint</span><span>Finding</span></div>
          {groups.map((g) => (
            <div key={g}>
              {groups.length > 1 && <div className="grp">{g} <span>{t.rows.filter((r) => r.group === g).length}</span></div>}
              {t.rows.filter((r) => r.group === g).map((r) => (
                <button key={r.entity.name} className={`dt dt--row${r === row ? " dt--on" : ""}`} style={grid} onClick={() => open(`${store.id}/${r.entity.name}`, true)} onDoubleClick={() => openTable(`${store.id}/${r.entity.name}`)}>
                  <code>{r.entity.name}</code>
                  {t.columns.map((c) => <span key={c.id} className="rw">{r.cells[c.id]?.read && <i>reads</i>}{r.cells[c.id]?.write && <i className="w">writes</i>}</span>)}
                  <span className="ct">{r.constraint ?? ""}</span>
                  <span className={r.seeTone === "cr" ? "see" : "q"}>{r.see ? <Rich text={r.see} /> : ""}</span>
                </button>
              ))}
            </div>
          ))}
          {t.rows.length === 0 && <Unread map={map} store={store.name} />}
        </Rep>
        {life && row && <Lifecycle name={row.entity.name} life={life} />}
    </Workspace>
  );
}

function Side({ map, store, row, findings, openFlow, openTable }: { openFlow: (id: string) => void; openTable: () => void; map: MapPayload; store: Parameters<typeof writers>[1]; row: ReturnType<typeof dataTable>["rows"][number]; findings: ReturnType<typeof dataTable>["findings"] }) {
  const e = row.entity;
  const w = writers(map, store, e);
  const lines = (k: "read" | "write") => map.model.edges.filter((x) => x.to === store.id && x.kind === k && x.target?.entity === e.name).reduce((n, x) => n + x.count, 0);
  const status = e.fields?.find((f) => f.values?.length);
  const never = new Set(findings.filter((f) => f.code === "unused_value" && f.message.startsWith(`${e.name}.${status?.name}`)).map((f) => f.message.match(/“(.+?)”/)?.[1]));
  const race = findings.find((f) => f.code === "race_read_then_write" && f.message.includes(` ${e.name} `));
  return (
    <aside className="dx__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Selected table</span>
          <h2>{e.name}</h2>
          <p className="sub">{plural(e.fields?.length ?? 0, "field", "fields")}{e.proof ? `, declared at ${e.proof.path.split("/").pop()}:${e.proof.line}` : ""}</p>
        </div>
        <button className="vl-btn vl-btn--light vl-btn--sm" style={{ alignSelf: "flex-start" }} onClick={openTable}>Open the table ›</button>
        <div className="nst">
          <div><b>{lines("write")}</b><span>lines that write it</span></div>
          <div><b>{lines("read")}</b><span>lines that read it</span></div>
          <div><b>{status?.values?.length ?? "—"}</b><span>{status ? "possible states" : "no enumerated state"}</span></div>
        </div>
        {status && <>
          <span className="lbl">Its states, field {status.name}</span>
          <div className="states">{status.values!.map((v) => <span key={v} className={never.has(v) ? "off" : ""}>{v}</span>)}</div>
          {never.size > 0 && <p className="sub">{[...never].join(", ")} : declared, but no code writes it.</p>}
        </>}
        {race && (
          <div className="race">
            <b>Read then rewritten without re-checking</b>
            <p><Rich text={race.message.replace(/^./, (c) => c.toUpperCase())} />.</p>
            <span className="dx__refs">{race.proof.slice(0, 3).map((x, i) => <Ref key={i} proof={x} />)}</span>
            <button className="vl-btn vl-btn--light vl-btn--sm" style={{ alignSelf: "flex-start" }} onClick={openTable}>See the race</button>
          </div>
        )}
      </section>
      <section className="card">
        <div className="hd"><h2>Writes</h2><span>{plural(lines("write"), "line", "lines")}</span></div>
        {w.length === 0 && <p className="foot">No entry point read writes it.</p>}
        {w.map((x) => (
          <div key={x.key} className={`wr wr--link${x.danger ? " wr--cr" : ""}`} onClick={() => openFlow(x.id)} title="Open its flow">
            <span>{x.kind === "http" ? <><Method verb={x.key.split(" ")[0]!} /> <code className="vl-code">{x.key.split(" ").slice(1).join(" ")}</code></> : x.key}</span>
            <span className={`mk ${x.danger ? "mk--cr" : "mk--q"}`}>{x.verb}</span>
            <small>{x.proofs.slice(0, 2).map((p) => `${p.path.split("/").slice(-2).join("/")}:${p.line}`).join(", ")}</small>
          </div>
        ))}
        {e.triggers?.length ? <div className="foot">Ensuite, {e.triggers.map((t) => `trigger ${t.name}`).join(", ")} {e.triggers.length > 1 ? "react" : "reacts"} in the database ({e.triggers[0]!.proof.path.split("/").pop()}:{e.triggers[0]!.proof.line}).</div> : null}
      </section>
    </aside>
  );
}

/** Un stockage sans table lue : dire pourquoi, et mener à ce qui le lirait. */
function Unread({ map, store }: { map: MapPayload; store: string }) {
  const gaps = map.model.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "pack_missing");
  return (
    <div className="dx__unread">
      <p><b>No table of {store} is read.</b> The code probably accesses it through a library no pack reads yet{gaps.length ? ` : ${gaps.map((g) => g.subject).join(", ")}` : ""}.</p>
      <a className="vl-btn vl-btn--primary vl-btn--sm" href="#/packs">See the packs to write or accept</a>
    </div>
  );
}
