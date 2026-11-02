import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { agentSessions } from "../web/agents-source.js";
import { MapSource } from "../web/map-source.js";

/**
 * Un Replay : un vrai problème qu'un agent a résolu sur ce dépôt, gardé tel qu'il était. Le code d'avant son
 * correctif, le test qu'il a écrit, ce qu'il a vécu ; son correctif reste caché jusqu'à ce que l'ingénieur
 * rende le sien. On joue dans une copie (un worktree git hors du projet) : le projet n'est jamais touché.
 */

export interface ReplayTest { name: string; ok: boolean; message?: string }
export interface Replay {
  id: string;
  title: string;
  /** Ce que le test demande, en une phrase, sans dire comment. */
  brief: string;
  finding?: { code: string; message: string; proof: { path: string; line: number }[] };
  agent: { name: string; model?: string; branch?: string; at: string; session: string };
  timeline: { at: string; what: "map" | "write"; detail: string }[];
  /** Le commit juste avant le correctif de l'agent. */
  base: string;
  tests: string[];
  /** Les fichiers que l'agent a modifiés pour corriger (hors tests). */
  fixFiles: string[];
  /** Ce que les tests donnent sur le code d'avant, puis avec le correctif de l'agent. */
  before: ReplayTest[];
  agentResult: ReplayTest[];
  created: string;
  /** Rempli quand l'ingénieur joue. */
  copy?: string;
  /** Le dernier passage des tests dans la copie. */
  last?: ReplayTest[];
  submitted?: { at: string; result: ReplayTest[]; diff: string };
  /** La confrontation, écrite par Muse une fois la solution rendue. */
  comparison?: { sentence: string; agent: string; you: string; rows: { situation: string; agent: string; you: string }[] };
}

const AGENT_NAME = { muse: "Muse Code", claude: "Claude Code", codex: "Codex" } as const;
const isTest = (f: string) => /(\.|_)(spec|test)\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__)\//.test(f);
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 << 20 });

export class ReplayStore {
  constructor(private readonly root: string) {}
  private get dir() { return join(this.root, ".vision", "replays"); }
  private file(id: string, ext: string) { if (!/^r-\d+$/.test(id)) throw new Error(`replay inconnu : ${id}`); return join(this.dir, `${id}${ext}`); }

  list(): Replay[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(this.dir, f), "utf8")) as Replay).sort((a, b) => b.created.localeCompare(a.created));
  }
  get(id: string): Replay { return JSON.parse(readFileSync(this.file(id, ".json"), "utf8")); }
  save(r: Replay) { mkdirSync(this.dir, { recursive: true }); writeFileSync(this.file(r.id, ".json"), JSON.stringify(r, null, 2) + "\n"); }
  /** Le correctif de l'agent : jamais rendu avant que l'ingénieur ait soumis le sien. */
  agentPatch(id: string): string { return readFileSync(this.file(id, ".patch"), "utf8"); }

  /**
   * Garder une session en Replay. Elle doit avoir écrit au moins un test et un fichier de code, et son
   * travail doit être visible dans le dépôt (non commité, ou dans le dernier commit de sa branche).
   */
  async create(sessionId: string): Promise<Replay> {
    const s = agentSessions(this.root).find((x) => x.id === sessionId);
    if (!s) throw new Error("session inconnue");
    const tests = s.writes.filter(isTest), fixFiles = s.writes.filter((f) => !isTest(f));
    if (!tests.length || !fixFiles.length) throw new Error("il faut une session qui a écrit un test et du code");
    // Travail non commité : la base est HEAD. Sinon, le commit qui l'a apporté, et la base est son parent.
    const dirty = git(this.root, "status", "--porcelain", "--", ...fixFiles).trim().length > 0;
    const base = git(this.root, "rev-parse", dirty ? "HEAD" : "HEAD~1").trim();
    const patch = git(this.root, "diff", base, "--", ...fixFiles);
    if (!patch.trim()) throw new Error("le correctif de l'agent n'est plus visible dans le dépôt");
    const id = `r-${String(this.list().length + 1).padStart(3, "0")}`;
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file(id, ".patch"), patch);
    const testsDir = join(this.dir, `${id}.tests`);
    for (const t of tests) { mkdirSync(dirname(join(testsDir, t)), { recursive: true }); writeFileSync(join(testsDir, t), readFileSync(join(this.root, t))); }
    // Le constat se lit sur le code d'avant : sur le code corrigé, il a disparu.
    const probe = this.worktree(`${id}-sonde`, base, testsDir);
    let r: Replay;
    try {
      const before = (await new MapSource(probe).refresh()).model;
      const finding = before.findings.find((f) => f.proof.some((p) => fixFiles.includes(p.path)));
      r = {
      id, title: finding ? sentence(finding.message) : `Ce que ${AGENT_NAME[s.agent]} a corrigé dans ${fixFiles.map((f) => basename(f)).join(", ")}`,
      brief: finding ? `Le test de l'agent décrit le problème ; à toi de le faire passer sans voir sa solution.` : "Fais passer le test que l'agent a écrit.",
      ...(finding ? { finding: { code: finding.code, message: finding.message, proof: finding.proof.map((p) => ({ path: p.path, line: p.line })) } } : {}),
      agent: { name: AGENT_NAME[s.agent], ...(s.model ? { model: s.model } : {}), ...(s.branch ? { branch: s.branch } : {}), at: s.started, session: s.id },
      timeline: s.timeline, base, tests, fixFiles, before: [], agentResult: [], created: new Date().toISOString(),
      };
      // Les tests sur le code d'avant, puis avec le correctif de l'agent.
      rmSync(join(probe, ".vision"), { recursive: true, force: true });
      r.before = this.runTests(probe, r.tests);
      git(probe, "apply", this.file(id, ".patch"));
      r.agentResult = this.runTests(probe, r.tests);
    } finally { this.drop(probe); }
    this.save(r);
    return r;
  }

  /** Ouvrir la copie de l'ingénieur : le code d'avant, plus les tests de l'agent. */
  start(id: string): Replay {
    const r = this.get(id);
    if (!r.copy || !existsSync(r.copy)) { r.copy = this.worktree(id, r.base, join(this.dir, `${id}.tests`)); this.save(r); }
    return r;
  }

  test(id: string): ReplayTest[] {
    const r = this.get(id);
    if (!r.copy) throw new Error("copie non ouverte");
    r.last = this.runTests(r.copy, r.tests);
    this.save(r);
    return r.last;
  }

  /** Les fichiers qu'on peut ouvrir dans la copie : ceux que l'agent a corrigés, ceux du constat, ses tests. */
  files(id: string): string[] {
    const r = this.get(id);
    return [...new Set([...r.fixFiles, ...(r.finding?.proof.map((p) => p.path) ?? []), ...r.tests])];
  }
  read(id: string, path: string): string {
    const r = this.get(id);
    if (!r.copy || !this.files(id).includes(path)) throw new Error("fichier hors du replay");
    return readFileSync(join(r.copy, path), "utf8");
  }
  /** Écrire dans la copie : seulement un fichier du problème, jamais un test de l'agent. */
  write(id: string, path: string, text: string): void {
    const r = this.get(id);
    if (!r.copy || !this.files(id).includes(path) || r.tests.includes(path)) throw new Error("ce fichier ne s'édite pas ici");
    writeFileSync(join(r.copy, path), text);
  }

  /** Ce que l'ingénieur a changé dans sa copie, hors tests. */
  diff(id: string): string { const r = this.get(id); return r.copy ? git(r.copy, "diff", "--", ".", ...r.tests.map((t) => `:(exclude)${t}`)) : ""; }

  submit(id: string): Replay {
    const r = this.get(id);
    if (!r.copy) throw new Error("copie non ouverte");
    r.submitted = { at: new Date().toISOString(), result: this.runTests(r.copy, r.tests), diff: this.diff(id) };
    this.save(r);
    return r;
  }

  /** Reprendre sa copie après la confrontation : la solution rendue et la comparaison s'effacent, la copie reste. */
  reopen(id: string): Replay {
    const r = this.get(id);
    delete r.submitted; delete r.comparison;
    this.save(r);
    return r;
  }

  /** Rejouer depuis le début : la copie est retirée, ta solution et la confrontation oubliées. */
  reset(id: string): Replay {
    const r = this.get(id);
    if (r.copy) this.drop(r.copy);
    delete r.copy; delete r.last; delete r.submitted; delete r.comparison;
    this.save(r);
    return r;
  }

  private worktree(name: string, base: string, testsDir: string): string {
    const path = join(homedir(), ".visionlayer", "replays", `${basename(this.root)}-${name}`);
    if (existsSync(path)) this.drop(path);
    mkdirSync(dirname(path), { recursive: true });
    git(this.root, "worktree", "add", "--detach", path, base);
    for (const t of listFiles(testsDir)) {
      mkdirSync(dirname(join(path, t)), { recursive: true });
      writeFileSync(join(path, t), readFileSync(join(testsDir, t)));
    }
    if (existsSync(join(this.root, "node_modules")) && !existsSync(join(path, "node_modules"))) symlinkSync(join(this.root, "node_modules"), join(path, "node_modules"));
    return path;
  }
  private drop(path: string) { spawnSync("git", ["worktree", "remove", "--force", path], { cwd: this.root }); }

  /** Lancer les tests du Replay avec le lanceur du projet ; le résultat par test. */
  private runTests(cwd: string, tests: string[]): ReplayTest[] {
    const file = join(cwd, ".replay-result.json");
    rmSync(file, { force: true });
    spawnSync("npx", ["vitest", "run", ...tests, "--reporter=json", `--outputFile=${file}`], { cwd, encoding: "utf8", maxBuffer: 64 << 20, timeout: 120_000 });
    try {
      const data = JSON.parse(readFileSync(file, "utf8")) as { testResults: { assertionResults: { title: string; status: string; failureMessages?: string[] }[] }[] };
      // Le message d'échec, sans la pile d'appels ni les codes de couleur du terminal.
      const why = (m?: string[]) => m?.[0]?.replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter((l) => !/^\s+at /.test(l)).slice(0, 6).join("\n").trim();
      return data.testResults.flatMap((f) => f.assertionResults.map((a) => ({ name: a.title, ok: a.status === "passed", ...(a.status !== "passed" && why(a.failureMessages) ? { message: why(a.failureMessages)! } : {}) })));
    } catch { return [{ name: "les tests n'ont pas pu tourner", ok: false }]; }
    finally { rmSync(file, { force: true }); }
  }
}

function listFiles(dir: string, rel = ""): string[] {
  if (!existsSync(join(dir, rel))) return [];
  return readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((d) => d.isDirectory() ? listFiles(dir, join(rel, d.name)) : [join(rel, d.name)]);
}
const sentence = (m: string) => m.replace(/^./, (c) => c.toUpperCase()).replace(/\.?$/, ".");
