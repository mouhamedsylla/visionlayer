import type { SymbolFact, SystemModel } from "./types.js";

/**
 * Où une fonction est appelée : les lignes qui écrivent son nom suivi d'un
 * appel (`nom(` ou `nom<…>(`), dans son propre fichier et dans les fichiers qui
 * l'importent — directement ou par une ré-exportation, sous son nom ou son
 * alias (`export { send as sendEmail }`).
 *
 * Lecture textuelle, bornée aux fichiers qui peuvent la voir : une ligne qui
 * appelle une autre fonction du même nom, sans l'importer, n'est jamais lue.
 */

export interface CallSite {
  path: string;
  line: number;
  text: string;
}

const MAX_SITES = 60;

export function findCallSites(model: SystemModel, symbol: SymbolFact, read: (path: string) => string | undefined): CallSite[] {
  const home = symbol.location.path;
  // Noms sous lesquels la fonction est visible, par fichier qui l'expose.
  const exposed = new Map<string, Set<string>>([[home, new Set([symbol.name])]]);
  const queue = [home];
  while (queue.length) {
    const file = queue.shift()!;
    const names = exposed.get(file)!;
    for (const r of model.reExports) {
      if (r.external || r.sourceFile !== file) continue;
      const name = r.exportedName === "*" ? [...names] : names.has(r.originalName) ? [r.exportedName] : [];
      if (!name.length) continue;
      const set = exposed.get(r.file) ?? new Set<string>();
      const before = set.size;
      for (const n of name) set.add(n);
      if (set.size > before) {
        exposed.set(r.file, set);
        queue.push(r.file);
      }
    }
  }

  // Fichiers qui voient la fonction : le sien, et ceux qui importent un fichier qui l'expose.
  const readers = new Map<string, Set<string>>([[home, new Set([symbol.name])]]);
  for (const d of model.dependencies) {
    if (d.external) continue;
    const names = exposed.get(d.to);
    if (!names) continue;
    const set = readers.get(d.from) ?? new Set<string>();
    for (const n of names) set.add(n);
    readers.set(d.from, set);
  }

  const sites: CallSite[] = [];
  for (const [path, names] of [...readers].sort(([a], [b]) => a.localeCompare(b))) {
    const content = read(path);
    if (content === undefined) continue;
    const pattern = new RegExp(`(^|[^\\w$.])(${[...names].map(escape).join("|")})\\s*(<[^>()]*>)?\\s*\\(`);
    content.split("\n").forEach((text, i) => {
      const line = i + 1;
      if (path === home && line >= symbol.location.startLine && line <= symbol.location.endLine) return; // sa propre déclaration
      if (/^\s*(import|export\s+\{|\/\/|\*)/.test(text)) return;
      if (pattern.test(text) && sites.length < MAX_SITES) sites.push({ path, line, text: text.trim().slice(0, 200) });
    });
  }
  return sites;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
