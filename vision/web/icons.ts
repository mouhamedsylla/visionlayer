import { catalogEntry } from "../stack/catalog.js";
import type { TechLabel } from "./types.js";
import * as simpleIcons from "simple-icons";

let index: Map<string, { title: string; path: string }> | undefined;

/** Le tracé d'un logo Simple Icons (CC0) par son slug ; une marque absente n'a pas de logo, jamais un dessin inventé. */
export function iconOf(slug: string | undefined): { title: string; path: string } | undefined {
  if (!slug) return undefined;
  if (!index) {
    index = new Map();
    for (const i of Object.values(simpleIcons) as unknown[]) {
      const icon = i as { slug?: string; title?: string; path?: string };
      if (icon?.slug && icon.path) index.set(icon.slug, { title: icon.title ?? icon.slug, path: icon.path });
    }
  }
  return index.get(slug);
}

/** L'étiquette d'une technologie du catalogue : son nom, sa catégorie, son logo quand la marque en a un. */
export function techLabel(id: string): TechLabel {
  const entry = catalogEntry(id);
  const icon = iconOf(entry?.icon)?.path;
  return { name: entry?.name ?? id, category: entry?.category, ...(icon ? { icon } : {}) };
}
