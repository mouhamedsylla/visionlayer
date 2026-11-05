import { Fragment } from "react";
import type { ArchNode, MapPayload } from "../../api/types";
import type { Arrow, MapGrid } from "../../model/map";
import { Block } from "./Block";

/** La grille de la planche : cinq colonnes, une rangée par bloc appelant, les flèches mono entre les couloirs. */
export function MapGridView({ grid, tech, selected, chosen, select, enter }: { grid: MapGrid; tech: MapPayload["tech"]; selected?: string; chosen?: ArchNode; select: (id: string) => void; enter: (id: string) => void }) {
  const on = (a: Arrow) => a.link.from === selected || a.link.to === selected;
  const linked = new Set(grid.links.filter((l) => l.from === selected || l.to === selected).flatMap((l) => [l.from, l.to]));
  const cls = (n: ArchNode) => (n.id === selected ? "on" : selected && !linked.has(n.id) ? "far" : "");
  let row = 2;
  const firstRow = 2;
  const cells = grid.middle.map((m) => {
    const start = row;
    const span = m.rows.length;
    row += span;
    const downRow = m.down ? row++ : undefined;
    return { m, start, span, downRow };
  });
  const lastRow = row - 1;
  return (
    <div className="map">
      <span className="lane" style={{ gridColumn: 1 }}>Clients</span>
      <span className="lane" style={{ gridColumn: 3 }}>Programs</span>
      <span className="lane" style={{ gridColumn: 5 }}>Resources</span>
      {cells.map(({ m, start, span, downRow }) => (
        <Fragment key={m.node.id}>
          {m.rows.map((r, i) => r.left && (
            <Fragment key={r.left.id}>
              <Block node={r.left} tech={tech} state={cls(r.left)} select={select} enter={enter} style={{ gridRow: start + i, gridColumn: 1 }} />
              <div className="arrows" style={{ gridRow: start + i, gridColumn: 2 }}>
                {r.leftArrows.map((a) => <ArrowView key={a.link.id} a={a} on={on(a)} />)}
              </div>
            </Fragment>
          ))}
          <Block node={m.node} tech={tech} state={cls(m.node)} select={select} enter={enter} style={{ gridRow: `${start} / span ${span}`, gridColumn: 3 }} />
          {m.rightArrows.length > 0 && (
            <div className="arrows" style={{ gridRow: `${start} / span ${span}`, gridColumn: 4 }}>
              {m.rightArrows.map((a) => <ArrowView key={a.link.id} a={a} on={on(a)} />)}
            </div>
          )}
          {m.down && downRow !== undefined && (
            <div className="vrow" style={{ gridRow: downRow, gridColumn: 3 }}>
              <span />
              <span className={`v${m.down.link.kind === "message" ? " v--q" : ""}${m.down.link.from !== m.node.id ? " v--up" : ""}${m.down.link.from === selected || m.down.link.to === selected ? "" : " v--off"}`} />
              <span className={`vl-lbl${m.down.link.from === selected || m.down.link.to === selected ? "" : " vl-lbl--off"}`}>{m.down.label}</span>
            </div>
          )}
        </Fragment>
      ))}
      {grid.right.length > 0 && (
        <div className="rightcol" style={{ gridRow: `${firstRow} / ${Math.max(lastRow, firstRow) + 1}`, gridColumn: 5 }}>
          {grid.right.map((n) => <Block key={n.id} node={n} tech={tech} state={cls(n)} select={select} enter={enter} links={grid.links} selected={chosen} />)}
        </div>
      )}
    </div>
  );
}

function ArrowView({ a, on }: { a: Arrow; on: boolean }) {
  const k = a.link.kind;
  const style = k === "write" ? " a--w" : k === "read" ? " a--r" : k === "message" ? " a--q" : k === "use" ? " a--u" : "";
  return <div className={`a${style}${a.back ? " a--back" : ""}${on ? "" : " a--off"}`}><span>{a.label}</span><i />{a.target && <em className="a__to">{a.target}</em>}</div>;
}
