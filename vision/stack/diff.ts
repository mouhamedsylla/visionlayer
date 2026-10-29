import type { StackModel, Technology } from "./types.js";

export interface StackChange {
  id: string;
  name: string;
  icon?: string;
  before: string[];
  after: string[];
}

export interface StackDiff {
  added: Technology[];
  removed: Technology[];
  /** Versions déclarées ou installées qui ont changé. */
  changed: StackChange[];
}

/** Ce qui a changé dans l'inventaire entre deux scans (`vision update` archive le précédent). */
export function diffStacks(before: StackModel, after: StackModel): StackDiff {
  const prev = new Map(before.technologies.map((t) => [t.id, t]));
  const next = new Map(after.technologies.map((t) => [t.id, t]));
  const added = after.technologies.filter((t) => !prev.has(t.id));
  const removed = before.technologies.filter((t) => !next.has(t.id));
  const changed: StackChange[] = [];
  for (const t of after.technologies) {
    const p = prev.get(t.id);
    if (!p || p.versions.join("|") === t.versions.join("|")) continue;
    const c: StackChange = { id: t.id, name: t.name, before: p.versions, after: t.versions };
    if (t.icon) c.icon = t.icon;
    changed.push(c);
  }
  return { added, removed, changed };
}
