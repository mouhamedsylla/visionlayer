import { execFileSync } from "node:child_process";
import { at, type MapIndex } from "./index.js";
import { buildSlice, formatSections, type Slice } from "./build.js";
import type { KnowledgeReport } from "../knowledge/types.js";

/** Les lignes changées d'un fichier, côté nouveau code. `null` : tout le fichier (fichier nouveau). */
export type Changes = Map<string, [number, number][] | null>;

const git = (root: string, args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });

/** Ce que le dépôt a de modifié par rapport à son dernier commit : le diff, plus les fichiers nouveaux. */
export function changedLines(root: string): Changes {
  const out: Changes = new Map();
  let file = "";
  for (const line of git(root, ["diff", "-U0", "--no-color", "--no-ext-diff", "HEAD"]).split("\n")) {
    const f = line.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)$/);
    if (f) { file = f[1] ?? ""; continue; }
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h && file) {
      const start = Number(h[1]), count = h[2] === undefined ? 1 : Number(h[2]);
      // Des lignes seulement retirées : on garde l'endroit où elles étaient.
      const range: [number, number] = count === 0 ? [Math.max(1, start), Math.max(1, start)] : [start, start + count - 1];
      const ranges = out.get(file) ?? [];
      if (ranges) out.set(file, [...ranges, range]);
    }
  }
  for (const f of git(root, ["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean)) out.set(f, null);
  return out;
}

export interface Reach {
  /** Ce que chaque morceau changé est sur la carte. */
  touched: { at: string; what: string }[];
  /** Les noms donnés à la tranche. */
  handles: string[];
  slice: Slice;
}

/**
 * La portée d'une modification : chaque ligne changée est retrouvée sur la
 * carte (la fonction qui la contient, le champ ou la table qu'elle déclare),
 * puis la tranche de tout ce qu'elle touche est calculée par les mêmes règles
 * que vision_slice. L'agent voit ainsi, après avoir modifié, les points
 * d'entrée, les lecteurs et les constats que sa modification atteint.
 */
export function buildReach(index: MapIndex, changes: Changes, opts: { knowledge?: KnowledgeReport } = {}): Reach {
  const touched: Reach["touched"] = [];
  const handles = new Set<string>();
  const inRanges = (ranges: [number, number][] | null, line: number) => !ranges || ranges.some(([a, b]) => a <= line && line <= b);

  const untouchedFields = new Set<string>();

  for (const [path, ranges] of changes) {
    const inFile = index.functions.filter((f) => f.proof.path === path);
    const topLevel = inFile.filter((f) => !inFile.some((g) => g !== f && g.proof.line <= f.proof.line && f.end <= g.end));
    const lines = ranges ? ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)) : [];
    const touchFn = (fn: (typeof inFile)[number], why = "") => {
      const entry = index.entries.find((e) => e.handler && at(e.handler) === at(fn.proof));
      const name = entry ? index.entryName(entry) : at(fn.proof);
      if (handles.has(name)) return;
      handles.add(name);
      touched.push({ at: at(fn.proof), what: `${why}fonction ${fn.name}${entry ? `, code de ${index.entryName(entry)}` : ""}` });
    };

    // Les champs et les tables déclarés aux lignes changées.
    const fieldLines = new Set<number>();
    for (const t of index.entities) {
      const declared = (t.fields ?? []).filter((f) => f.proof?.path === path);
      const fields = declared.filter((f) => inRanges(ranges, f.proof!.line));
      const def = t.proof?.path === path && inRanges(ranges, t.proof.line);
      declared.forEach((f) => fieldLines.add(f.proof!.line));
      if (!fields.length && !def) continue;
      handles.add(`${t.node}/${t.name}`);
      declared.filter((f) => !fields.includes(f)).forEach((f) => untouchedFields.add(at(f.proof!)));
      for (const f of fields) touched.push({ at: at(f.proof!), what: `champ ${t.name}.${f.name}` });
      if (def && !fields.length) touched.push({ at: at(t.proof!), what: `table ${t.name}` });
    }

    // La fonction la plus intérieure de chaque ligne changée ; pour un fichier nouveau, ses fonctions de premier niveau.
    if (!ranges) topLevel.forEach((f) => touchFn(f));
    for (const fn of new Set(lines.map((line) => index.functionAt({ path, line })).filter((f) => !!f))) touchFn(fn);

    // Une ligne hors de toute fonction (une constante, un schéma de validation, un import) sert le fichier entier : ses fonctions sont touchées.
    const outside = lines.filter((line) => !index.functionAt({ path, line }) && !fieldLines.has(line));
    if (outside.length && topLevel.length) {
      const why = `hors fonction (ligne ${outside[0]}${outside.length > 1 ? ` et ${outside.length - 1} autre${outside.length > 2 ? "s" : ""}` : ""}), dans le même fichier : `;
      topLevel.forEach((f) => touchFn(f, why));
    }

    if (!touched.some((t) => t.at.startsWith(`${path}:`))) {
      const where = ranges ? ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ") : "fichier nouveau";
      touched.push({ at: path, what: `rien sur la carte à ces lignes (${where})` });
    }
  }

  const names = [...handles];
  const slice = names.length ? buildSlice(index, names, opts) : { items: [], unknown: [] };
  // Un constat posé sur un champ que la modification ne change pas ne la concerne pas.
  slice.items = slice.items.filter((i) => i.section !== "Constats" || !untouchedFields.has(i.at));
  return { touched, handles: names, slice };
}

export function formatReach(reach: Reach): string {
  const out = ["PORTÉE DE TA MODIFICATION", "Ce que les lignes changées (git diff) touchent sur la carte, puis ce qui en dépend.", ""];
  if (!reach.touched.length) return [...out, "Aucune ligne changée par rapport au dernier commit."].join("\n");
  out.push("Lignes changées");
  for (const t of reach.touched) out.push(`  ${t.at.padEnd(34)} ${t.what}`);
  out.push("", ...formatSections(reach.slice));
  if (reach.slice.items.some((i) => i.section === "Constats"))
    out.push("", "Pour chaque constat ci-dessus, dis dans ta réponse si ta modification le touche ou l'aggrave, et ce que tu en fais.");
  return out.join("\n").trimEnd();
}
