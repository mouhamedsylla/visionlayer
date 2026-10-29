import type { ArchModelV2, ArchNode, TechLabel } from "../../api/types";
import { COLUMNS, columnOf, ROLE_ORDER, type ColumnId } from "../architecture/columns";
import { contentBadges, kindLabel, primaryTechId, roleLabel } from "../architecture/describe";
import { mapLinks, mapNodes } from "../architecture/links";

/** Les dimensions de la carte réduite du bandeau, en pixels. */
export const MINI = { width: 620, height: 392, nodeWidth: 170, nodeHeight: 44, top: 34, bottom: 16 } as const;

const COLUMN_X: Record<ColumnId, number> = { opened: 10, server: 225, used: 440 };
const MAX_GAP = 96;

export interface MiniNode {
  id: string;
  name: string;
  kind: string;
  tech?: string;
  x: number;
  y: number;
}

export interface MiniLink {
  id: string;
  from: string;
  to: string;
  path: string;
}

/** `service · 18 entrées`, `14 tables`, `file · emails`, `app · React`. */
function miniKind(node: ArchNode, tech: Record<string, TechLabel>): string {
  const entries = (node.facets.entrypoints ?? []).filter((e) => e.kind !== "main").length;
  if (entries > 1) return `${roleLabel(node.role)} · ${entries} entrées`;
  const topics = node.facets.channel?.topics.map((t) => t.name) ?? [];
  if (topics.length === 1) return `${roleLabel(node.role)} · ${topics[0]}`;
  if (node.facets.data?.entities.length) return contentBadges(node)[0]!;
  const label = kindLabel(node, tech);
  // `externe · Resend` sur un bloc nommé Resend : la technologie répète le nom.
  return label.toLowerCase().endsWith(` · ${node.name.toLowerCase()}`) ? roleLabel(node.role) : label;
}

function place(nodes: ArchNode[], x: number, tech: Record<string, TechLabel>): MiniNode[] {
  const room = MINI.height - MINI.top - MINI.bottom - MINI.nodeHeight;
  const gap = nodes.length > 1 ? Math.min(MAX_GAP, room / (nodes.length - 1)) : 0;
  const start = MINI.top + (room - gap * (nodes.length - 1)) / 2;
  return nodes.map((n, i) => ({
    id: n.id, name: n.name, kind: miniKind(n, tech), tech: primaryTechId(n, tech) ?? n.tech?.[0], x, y: Math.round(start + i * gap),
  }));
}

/** Un trait d'un bord de bloc à l'autre ; un retour (d'un service externe vers le serveur) part du bord gauche. */
function curve(a: MiniNode, b: MiniNode): string {
  const [ay, by] = [a.y + MINI.nodeHeight / 2, b.y + MINI.nodeHeight / 2];
  if (a.x === b.x) {
    const x = a.x + MINI.nodeWidth;
    return `M${x} ${ay} C${x + 36} ${ay} ${x + 36} ${by} ${x} ${by}`;
  }
  const forward = a.x < b.x;
  const [x1, x2] = forward ? [a.x + MINI.nodeWidth, b.x] : [a.x, b.x + MINI.nodeWidth];
  const mid = (x1 + x2) / 2;
  return `M${x1} ${ay} C${mid} ${ay} ${mid} ${by} ${x2} ${by}`;
}

/** La carte du système en trois couloirs, réduite au cadre du bandeau. */
export function miniMap(model: ArchModelV2, tech: Record<string, TechLabel>): { columns: { title: string; x: number }[]; nodes: MiniNode[]; links: MiniLink[] } {
  const shown = mapNodes(model).filter((n) => n.role !== "actor");
  const placed = COLUMNS.flatMap((c) => {
    const inColumn = shown.filter((n) => columnOf(n.role) === c.id)
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
    return place(inColumn, COLUMN_X[c.id], tech);
  });
  const byId = new Map(placed.map((n) => [n.id, n]));
  const links = mapLinks(model).flatMap((l) => {
    const [a, b] = [byId.get(l.from), byId.get(l.to)];
    return a && b ? [{ id: l.id, from: l.from, to: l.to, path: curve(a, b) }] : [];
  });
  return { columns: COLUMNS.map((c) => ({ title: c.title.toLowerCase(), x: COLUMN_X[c.id] })), nodes: placed, links };
}
