import type { ArchNode } from "../../api/types";
import { COLUMNS, columnOf, ROLE_ORDER, type ColumnId } from "./columns";
import type { MapLink } from "./links";

/** Taille d'un bloc avant mesure ; la hauteur réelle vient du rendu (`heights`). */
export const NODE_SIZE = { width: 212, height: 76 };
const GAP_X = 96;
const GAP_Y = 22;
const PAD_X = 32;
const TOP = 72;

export interface Placed {
  id: string;
  column: ColumnId;
  x: number;
  y: number;
  height: number;
}

export interface MapLayout {
  placed: Map<string, Placed>;
  columnX: Record<ColumnId, number>;
  width: number;
  height: number;
}

const byRole = (a: ArchNode, b: ArchNode) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name);

/**
 * Place les blocs en trois couloirs. Le couloir du milieu suit l'ordre des
 * rôles ; les deux autres se rangent face aux blocs auxquels ils sont reliés,
 * pour croiser le moins de traits possible. Même carte, même dessin.
 */
export function layoutMap(nodes: ArchNode[], links: MapLink[], heights: Record<string, number> = {}): MapLayout {
  const columnX = Object.fromEntries(COLUMNS.map((c, i) => [c.id, PAD_X + i * (NODE_SIZE.width + GAP_X)])) as Record<ColumnId, number>;
  const placed = new Map<string, Placed>();
  const heightOf = (id: string) => heights[id] ?? NODE_SIZE.height;
  const place = (list: ArchNode[], column: ColumnId) => {
    let y = TOP;
    for (const n of list) {
      placed.set(n.id, { id: n.id, column, x: columnX[column], y, height: heightOf(n.id) });
      y += heightOf(n.id) + GAP_Y;
    }
  };

  const inColumn = (c: ColumnId) => nodes.filter((n) => columnOf(n.role) === c).sort(byRole);
  place(inColumn("server"), "server");
  for (const side of ["opened", "used"] as const) {
    const anchor = (n: ArchNode) => {
      const ys = links
        .flatMap((l) => (l.from === n.id ? [l.to] : l.to === n.id ? [l.from] : []))
        .map((id) => placed.get(id)?.y)
        .filter((y): y is number => y !== undefined);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Number.MAX_SAFE_INTEGER;
    };
    const list = inColumn(side);
    const rank = new Map(list.map((n) => [n.id, anchor(n)]));
    place([...list].sort((a, b) => rank.get(a.id)! - rank.get(b.id)! || byRole(a, b)), side);
  }

  const bottoms = [...placed.values()].map((p) => p.y + p.height);
  return {
    placed,
    columnX,
    width: columnX.used + NODE_SIZE.width + PAD_X,
    height: Math.max(TOP + NODE_SIZE.height, ...bottoms) + 40,
  };
}
