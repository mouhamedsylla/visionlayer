import { Obj } from "../../ui/open";
import type { CSSProperties } from "react";
import type { ArchNode, MapPayload } from "../../api/types";
import { blockLines, tableGroups, type MapLink } from "../../model/map";
import { isUnread } from "../../model/overview";
import { Client, Deployable, Entity, External, Resource } from "../../lang/objects";

/** Un bloc de la Carte, dans la forme que le vocabulaire commun donne à son rôle : déployable, client, service extérieur, ressource. */
export function Block({ node, tech, state, select, enter, style, links, selected }: { node: ArchNode; tech: MapPayload["tech"]; state: string; select: (id: string) => void; enter?: (id: string) => void; style?: CSSProperties; links?: MapLink[]; selected?: ArchNode }) {
  const t = node.tech?.map((x) => tech[x]).find((x) => x?.icon) ?? (node.tech?.[0] ? tech[node.tech[0]] : undefined);
  const lines = blockLines(node, tech);
  const unread = isUnread(node) ? <span className="mk mk--nl">not read</span> : null;
  const common = { name: node.name, tech: t, on: state === "on", far: state === "far", onClick: () => select(node.id) };
  const canEnter = (node.facets.entrypoints?.length ?? 0) > 1;
  let el;
  if (node.role === "store" || node.role === "channel" || node.role === "managed") {
    const tables = node.facets.data?.entities.length ?? 0;
    const groups = links ? tableGroups(node, selected, links) : [];
    el = (
      <Resource name={node.name} kind={node.role === "channel" ? "queue" : "store"} meta={tables ? `${tables} tables` : node.facets.channel?.topics.map((x) => `queue ${x.name}`).join(", ")} on={common.on} far={common.far} onClick={common.onClick}>
        {unread}
        {groups.map((g) => (
          <span key={g.label} className="tgroup"><span className="tg">{g.label}</span><span className="tl">{g.tables.map((x) => <Obj key={x} to={{ entity: x, node: node.id }}><Entity name={x} write={g.cls === "w"} /></Obj>)}</span></span>
        ))}
      </Resource>
    );
  } else if (node.role === "external") el = <External {...common} meta={lines.join(", ")}>{unread}</External>;
  else if (node.role === "app") el = <Client {...common} meta={lines.join(", ")}>{unread}</Client>;
  else el = (
    <Deployable {...common} meta={lines.join(", ")} extra={node.instances && node.instances.min > 1 ? <span className="vl-tag vl-tag--neutral">× {node.instances.min}</span> : undefined}
      onDoubleClick={() => canEnter && enter?.(node.id)} title={canEnter ? "Double-click: enter the block" : undefined}>{unread}</Deployable>
  );
  return <div className="blk-cell" style={style}>{el}</div>;
}
