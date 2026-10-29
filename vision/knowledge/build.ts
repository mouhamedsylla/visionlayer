import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { listProjectFiles } from "../scanner/files.js";
import { languageFor } from "../scanner/scanner.js";
import { fingerprintsOf, hasMarker, locate, structuralCheck } from "./anchor.js";
import { loadKnowledge } from "./load.js";
import type { ClaimState, DeclaredClaim, KnowledgeClaim, KnowledgeConcept, KnowledgeReport, Reference, ResolvedAnchor } from "./types.js";

/** git, arguments en tableau (jamais une chaîne passée à un shell) ; undefined en cas d'échec. */
export function git(root: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return undefined;
  }
}

/**
 * Point de référence d'une affirmation : le commit le plus récent parmi ceux
 * qui ont écrit ses lignes (git blame). L'affirmation est vraie à ce commit ;
 * la reconfirmer, c'est toucher une de ses lignes.
 */
export function referenceOf(root: string, file: string, lines: [number, number]): Reference {
  const out = git(root, ["blame", "--porcelain", "-L", `${lines[0]},${lines[1]}`, "--", file]);
  if (!out) return { uncommitted: true };
  const times = new Map<string, number>();
  let uncommitted = false;
  let current = "";
  for (const line of out.split("\n")) {
    const head = line.match(/^([0-9a-f]{40}) \d+ \d+/);
    if (head) {
      current = head[1]!;
      if (/^0+$/.test(current)) uncommitted = true;
      continue;
    }
    const t = line.match(/^committer-time (\d+)/);
    if (t && !/^0+$/.test(current)) times.set(current, Number(t[1]));
  }
  if (uncommitted || !times.size) return { uncommitted: true };
  // Le plus récent ; à la même seconde (commits rapprochés, rebase), celui qui descend des autres.
  const max = Math.max(...times.values());
  const tied = [...times].filter(([, t]) => t === max).map(([c]) => c);
  const commit = tied.find((c) => tied.every((o) => o === c || git(root, ["merge-base", "--is-ancestor", o, c]) !== undefined)) ?? tied[0]!;
  return { commit, date: new Date(max * 1000).toISOString().slice(0, 10), uncommitted: false };
}

export const showAt = (root: string, commit: string, path: string) => git(root, ["show", `${commit}:${path}`]);

/** Fichiers de test du dépôt (conventions usuelles). */
const TEST_FILE = /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** Fichiers de test dont un import relatif désigne le fichier donné (sans extension). */
function testsReaching(root: string, testFiles: string[], target: string): string[] {
  const stem = target.replace(/\.[cm]?[jt]sx?$/, "").replace(/\/index$/, "");
  const out: string[] = [];
  for (const t of testFiles) {
    let src: string;
    try {
      src = readFileSync(join(root, t), "utf-8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
      const resolved = normalize(join(dirname(t), m[1]!)).replace(/\.[cm]?[jt]sx?$/, "").replace(/\/index$/, "");
      if (resolved === stem) {
        out.push(t);
        break;
      }
    }
  }
  return out;
}

interface Context {
  root: string;
  files: string[];
  testFiles: string[];
  /** Empreintes de tous les symboles du dépôt, calculées à la demande (recherche d'un déplacement). */
  index?: { path: string; name: string; line: number; endLine: number; fingerprint: string }[];
}

function symbolIndex(ctx: Context) {
  if (!ctx.index) {
    ctx.index = [];
    for (const f of ctx.files) {
      if (!languageFor(f)) continue;
      let src: string;
      try {
        src = readFileSync(join(ctx.root, f), "utf-8");
      } catch {
        continue;
      }
      for (const s of fingerprintsOf(f, src)) ctx.index.push({ path: f, ...s });
    }
  }
  return ctx.index;
}

export const read = (root: string, path: string) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf-8") : undefined);

/**
 * Résout un ancrage aujourd'hui, et le compare à ce qu'il désignait au point
 * de référence. Ordre (doc 02 §6) : à sa place ; sinon marqueur retrouvé
 * ailleurs ; sinon même code ailleurs (renommé ou déplacé) ; sinon même nom
 * ailleurs (candidat) ; sinon orphelin.
 */
function resolveAnchor(ctx: Context, claim: DeclaredClaim, ref: DeclaredClaim["anchors"][number], reference: Reference): ResolvedAnchor {
  const before = reference.commit ? showAt(ctx.root, reference.commit, ref.path) : read(ctx.root, ref.path);
  const then = before !== undefined ? locate(ref, ref.path, before) : undefined;

  const finish = (status: ResolvedAnchor["status"], path: string, span: NonNullable<ReturnType<typeof locate>>): ResolvedAnchor => {
    const changed = then ? then.fingerprint !== span.fingerprint : undefined;
    const { check, note } = structuralCheck(claim.type, span.node);
    return { ref, status, at: { path, line: span.line, endLine: span.endLine, symbol: span.symbol }, changed, unknownAtReference: !then || undefined, check, checkNote: note };
  };

  const now = read(ctx.root, ref.path);
  const here = now !== undefined ? locate(ref, ref.path, now) : undefined;
  if (here) return finish("ok", ref.path, here);

  if (ref.marker) {
    // Seulement les fichiers de code : jamais un fichier d'environnement ni une donnée quelconque.
    for (const f of ctx.files) {
      if (!languageFor(f)) continue;
      const src = read(ctx.root, f);
      if (!src || !hasMarker(src, ref.marker)) continue;
      const span = locate({ ...ref, path: f, symbol: undefined }, f, src);
      if (span) return finish("moved", f, span);
    }
  }
  if (then && ref.symbol) {
    const same = symbolIndex(ctx).find((s) => s.fingerprint === then.fingerprint);
    if (same) {
      const src = read(ctx.root, same.path)!;
      const span = locate({ ...ref, path: same.path, symbol: same.name }, same.path, src);
      if (span) return finish("moved", same.path, span);
    }
  }
  if (ref.symbol) {
    const short = ref.symbol.split(".").pop()!;
    const named = symbolIndex(ctx).find((s) => s.name === ref.symbol || s.name.split(".").pop() === short);
    if (named) {
      const src = read(ctx.root, named.path)!;
      const span = locate({ ...ref, path: named.path, symbol: named.name }, named.path, src);
      if (span) return { ...finish("candidate", named.path, span), changed: true };
    }
  }
  return { ref, status: "orphan" };
}

function stateOf(claim: DeclaredClaim, anchors: ResolvedAnchor[]): ClaimState {
  if (!anchors.length) return "unanchored";
  if (anchors.some((a) => a.status === "orphan")) return "orphan";
  if (anchors.some((a) => a.check === "failed")) return "contradicted";
  if (anchors.some((a) => a.changed || a.status === "candidate" || a.unknownAtReference)) return "stale";
  return anchors.some((a) => a.check === "ok") ? "verified" : "current";
}

/**
 * Le rapport de connaissance : chaque affirmation déclarée, son état calculé
 * contre le code et Git, et ce qui manque (points d'entrée sans feature).
 * `entries` : les noms des points d'entrée de la carte (architecture).
 */
export function buildKnowledge(root: string, entries: string[] = []): KnowledgeReport {
  const { concepts: declared, errors } = loadKnowledge(root);
  const files = listProjectFiles(root).map((f) => f.path);
  const ctx: Context = { root, files, testFiles: files.filter((f) => TEST_FILE.test(f)) };
  const concepts: KnowledgeConcept[] = declared.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    file: c.file,
    entries: c.entries.map((name) => ({ name, found: entries.includes(name) })),
    claims: c.claims.map((claim): KnowledgeClaim => {
      const reference = referenceOf(root, c.file, claim.lines);
      const anchors = claim.anchors.map((a) => resolveAnchor(ctx, claim, a, reference));
      const tests = [...new Set(anchors.flatMap((a) => (a.at ? testsReaching(root, ctx.testFiles, a.at.path) : [])))];
      return { id: claim.id, concept: c.id, type: claim.type, text: claim.text, state: stateOf(claim, anchors), reference, anchors, tests, file: c.file, line: claim.lines[0] };
    }),
  }));
  const covered = new Set(declared.filter((c) => c.kind === "feature").flatMap((c) => c.entries));
  return { concepts, entriesWithoutFeature: entries.filter((e) => !covered.has(e)), errors };
}
