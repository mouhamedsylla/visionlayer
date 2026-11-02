import type { CSSProperties } from "react";
import type { ArchNode, MapPayload } from "../../api/types";
import { blockLines, tableGroups, type MapLink } from "../../model/map";
import { isUnread } from "../../model/overview";

/** Un bloc de la planche : logo ou monogramme, nom, compteur mono, lignes mono, marques ; un stockage montre ses tables. */
export function Block({ node, tech, state, select, enter, style, links, selected }: { node: ArchNode; tech: MapPayload["tech"]; state: string; select: (id: string) => void; enter?: (id: string) => void; style?: CSSProperties; links?: MapLink[]; selected?: ArchNode }) {
  const t = node.tech?.map((x) => tech[x]).find((x) => x?.icon) ?? (node.tech?.[0] ? tech[node.tech[0]] : undefined);
  const store = node.role === "store" || node.role === "channel" || node.role === "managed";
  const external = node.role === "external";
  const tables = node.facets.data?.entities.length ?? 0;
  const extra = node.instances && node.instances.min > 1 ? `×${node.instances.min}` : tables ? `${tables} tables` : undefined;
  const chosen = links && node.role === "store" ? tableGroups(node, selected, links) : [];
  return (
    <button className={`blk${state === "on" ? " blk--on" : state === "far" ? " blk--far" : ""}${node.role === "app" ? " blk--client" : ""}${store ? " blk--store" : ""}${external ? " blk--ext" : ""}`}
      style={style} onClick={() => select(node.id)} onDoubleClick={() => (node.facets.entrypoints?.length ?? 0) > 1 && enter?.(node.id)} title={(node.facets.entrypoints?.length ?? 0) > 1 ? "Double-clic : entrer dans le bloc" : undefined}>
      <span className="bh">
        {t?.icon
          ? <span className="mg mg--logo"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d={t.icon} fill="currentColor" /></svg></span>
          : <span className="mg" style={external ? { background: "var(--ink-2)" } : undefined}>{(t?.name ?? node.name).slice(0, 2).toUpperCase()}</span>}
        <b>{node.name}</b>
        {extra && <span className="mono bx">{extra}</span>}
      </span>
      {external && <span className="vl-tag vl-tag--neutral bt">Extérieur</span>}
      {blockLines(node, tech).map((l, i) => <span key={i} className="bm">{l}</span>)}
      {isUnread(node) && <span className="mk mk--nl">non lu</span>}
      {chosen.map((g) => (
        <span key={g.label} className="tgroup">
          <span className="tg">{g.label}</span>
          <span className="tl">{g.tables.map((x) => <span key={x} className={`tb${g.cls === "w" ? " tb--w" : g.cls === "q" ? " tb--q" : ""}`}>{x}</span>)}</span>
        </span>
      ))}
    </button>
  );
}
