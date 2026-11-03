import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Les règles écrites dans un document du dépôt : les puces d'une section dont le titre dit « Règles », « Rules » ou
 * « Invariants » (`## Règles métier`), dans le README et les fichiers de `docs/`. Lues telles quelles, sans
 * interprétation : elles n'ont pas d'ancrage, rien n'est vérifié. Un agent peut les ancrer en les déclarant
 * (`.vision/knowledge/`).
 */
export interface DocumentRule { text: string; path: string; line: number; section: string }

const TITLE = /\b(r[èe]gles?|rules?|invariants?)\b/i;

export function documentRules(root: string): DocumentRule[] {
  // Les noms tels qu'ils sont sur le disque : README.md et readme.md sont le même fichier sur un disque insensible à la casse.
  const files = readdirSync(root).filter((f) => /^readme\.md$/i.test(f));
  const docs = join(root, "docs");
  if (existsSync(docs)) for (const f of readdirSync(docs)) if (f.endsWith(".md")) files.push(`docs/${f}`);
  return files.flatMap((path) => rulesOf(path, readFileSync(join(root, path), "utf8")));
}

export function rulesOf(path: string, text: string): DocumentRule[] {
  const out: DocumentRule[] = [];
  let section: { title: string; level: number } | undefined;
  let fence = false;
  text.split("\n").forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { fence = !fence; return; }
    if (fence) return;
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1]!.length;
      if (section && level > section.level) return;
      section = TITLE.test(h[2]!) ? { title: h[2]!.trim(), level } : undefined;
      return;
    }
    const b = section && raw.match(/^[-*+]\s+(.*)$/);
    if (b) out.push({ text: plain(b[1]!), path, line: i + 1, section: section!.title });
  });
  return out;
}

/** Sans gras ni code : « Une réservation non payée est libérée après 15 minutes. » */
const plain = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
