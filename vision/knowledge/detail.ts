import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "./anchor.js";
import { git, read, showAt } from "./build.js";
import { loadKnowledge } from "./load.js";
import type { KnowledgeClaim } from "./types.js";

export interface DiffLine {
  /** Numéro de ligne : dans le code actuel (gardée, ajoutée) ou au point de référence (retirée). */
  line?: number;
  text: string;
  kind: "same" | "add" | "del" | "gap";
}

export interface AnchorDetail {
  raw: string;
  /** Le code ancré au point de référence (absent si l'affirmation n'est pas commitée, ou s'il était introuvable). */
  before?: { commit: string; path: string; line: number; endLine: number };
  after?: { path: string; line: number; endLine: number };
  /** Différence ligne à ligne, seulement si le code ancré a changé. */
  diff?: DiffLine[];
  /** Commits qui ont touché le fichier ancré depuis le point de référence (les plus récents d'abord). */
  commits: { hash: string; date: string; subject: string }[];
}

const CONTEXT = 2;

/** Différence ligne à ligne (plus longue sous-séquence commune) ; les longues suites inchangées sont repliées. */
export function lineDiff(a: string[], b: string[], aStart: number, bStart: number): DiffLine[] {
  const n = a.length, m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const all: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) all.push({ line: bStart + j, text: b[j++]!, kind: "same" }), i++;
    else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) all.push({ line: aStart + i, text: a[i++]!, kind: "del" });
    else all.push({ line: bStart + j, text: b[j++]!, kind: "add" });
  }
  const near = all.map((_, k) => all.slice(Math.max(0, k - CONTEXT), k + CONTEXT + 1).some((x) => x.kind !== "same"));
  const out: DiffLine[] = [];
  for (let k = 0; k < all.length; k++) {
    if (near[k]) out.push(all[k]!);
    else {
      let e = k;
      while (e + 1 < all.length && !near[e + 1]) e++;
      out.push({ text: `${e - k + 1} ligne${e > k ? "s" : ""} inchangée${e > k ? "s" : ""}`, kind: "gap" });
      k = e;
    }
  }
  return out;
}

const span = (src: string, line: number, endLine: number) => src.split("\n").slice(line - 1, endLine);

/**
 * Le détail d'une affirmation pour le tiroir : pour chaque ancrage, le code
 * au point de référence comparé au code actuel, et les commits qui ont touché
 * le fichier depuis. Lecture seule ; chemins déjà bornés au dépôt par parseAnchor.
 */
export function claimDetail(root: string, claim: KnowledgeClaim): AnchorDetail[] {
  const commit = claim.reference.commit;
  return claim.anchors.map((a) => {
    const beforeSrc = commit ? showAt(root, commit, a.ref.path) : undefined;
    const then = beforeSrc !== undefined ? locate(a.ref, a.ref.path, beforeSrc) : undefined;
    const nowSrc = a.at ? read(root, a.at.path) : undefined;
    const detail: AnchorDetail = { raw: a.ref.raw, commits: [] };
    if (commit && then) detail.before = { commit, path: a.ref.path, line: then.line, endLine: then.endLine };
    if (a.at) detail.after = { path: a.at.path, line: a.at.line, endLine: a.at.endLine };
    if (a.changed && beforeSrc !== undefined && then && nowSrc !== undefined && a.at) {
      detail.diff = lineDiff(span(beforeSrc, then.line, then.endLine), span(nowSrc, a.at.line, a.at.endLine), then.line, a.at.line);
    }
    if (commit) {
      const paths = [...new Set([a.ref.path, a.at?.path].filter((p): p is string => !!p))];
      const log = git(root, ["log", "-n", "5", "--date=short", "--format=%h%x09%ad%x09%s", `${commit}..HEAD`, "--", ...paths]);
      detail.commits = (log ?? "").split("\n").filter(Boolean).map((l) => {
        const [hash, date, ...rest] = l.split("\t");
        return { hash: hash!, date: date!, subject: rest.join("\t") };
      });
    }
    return detail;
  });
}

/**
 * Reconfirmation par un humain (clic, POST) : écrit ou remplace la ligne
 * `confirmed:` de l'affirmation dans son fichier de connaissance. Rien d'autre
 * n'est touché ; le changement se commite avec le code et se relit en PR. Le
 * point de référence avance au commit qui contiendra cette ligne.
 */
export function confirmClaim(root: string, id: string, date = new Date().toISOString().slice(0, 10)): { file: string; line: number } {
  const concept = loadKnowledge(root).concepts.find((c) => c.claims.some((k) => k.id === id));
  const claim = concept?.claims.find((k) => k.id === id);
  if (!concept || !claim) throw new Error(`affirmation inconnue : ${id}`);
  const abs = join(root, concept.file);
  const original = readFileSync(abs, "utf-8");
  const lines = original.split("\n");
  const [start, end] = claim.lines;
  const value = `confirmed: "${date} · relue par un humain dans VisionLayer"`;
  let at = -1;
  for (let i = start - 1; i < end; i++) if (/^\s*confirmed\s*:/.test(lines[i]!)) at = i;
  if (at >= 0) {
    lines[at] = lines[at]!.replace(/confirmed\s*:.*$/, value);
  } else {
    const head = lines[start - 1]!.match(/^(\s*-\s*)/);
    const indent = head ? head[1]!.length : 0;
    at = end;
    lines.splice(end, 0, " ".repeat(indent) + value);
  }
  writeFileSync(abs, lines.join("\n"));
  const after = loadKnowledge(root);
  if (!after.concepts.some((c) => c.claims.some((k) => k.id === id))) {
    writeFileSync(abs, original);
    throw new Error(`reconfirmation annulée : ${concept.file} ne se relisait plus correctement`);
  }
  return { file: concept.file, line: at + 1 };
}
