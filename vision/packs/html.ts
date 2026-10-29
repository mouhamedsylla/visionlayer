import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf } from "./runs.js";

/**
 * Une page web, d'après l'inventaire (docs/fonctionnement/packs/vite-react.md).
 *
 * unit(Fichier, Nom, "page")      une page qui charge un module : une app
 * unit_runs(Fichier, Nom, Cible)  le module qu'elle charge : `<script type="module" src="/src/main.tsx">`,
 *                                 ou ce qu'importe un module écrit dans la page
 * page_dir(Fichier, Dossier)      le dossier de la page
 *
 * Un chemin qui commence par `/` part du dossier de la page (la racine de Vite).
 */
const script: PackScript = ({ file, fact }) => {
  const dir = dirOf(file.path);
  const name = dir ? dir.split("/").pop()! : posix.basename(file.path, ".html");
  const out: FileFact[] = [];
  const lineAt = (i: number) => file.source.slice(0, i).split("\n").length;
  const add = (src: string, line: number) => {
    if (/^[a-z]+:\/\//i.test(src) || src.startsWith("//")) return;
    const target = posix.normalize(posix.join(dir, src.replace(/^\//, "")));
    if (target.startsWith("..")) return;
    if (!out.length) out.push(fact("unit", [file.path, name, "page"], line), fact("page_dir", [file.path, dir], line));
    out.push(fact("unit_runs", [file.path, name, target], line));
  };
  for (const m of file.source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = m[1]!;
    if (!/\btype\s*=\s*["']?module["']?/i.test(attrs)) continue;
    const start = lineAt(m.index!);
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) { add(src, start); continue; }
    // Un module écrit dans la page : ce qu'il importe.
    const body = m[2]!;
    const offset = m.index! + m[0].indexOf(body);
    for (const im of body.matchAll(/\bimport\s*(?:[^'"()]*?\bfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
      add((im[1] ?? im[2])!, lineAt(offset + im.index!));
    }
  }
  return out;
};
export default script;
