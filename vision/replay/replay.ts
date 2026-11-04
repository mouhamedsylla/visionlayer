import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { agentSessions } from "../web/agents-source.js";
import { MapSource } from "../web/map-source.js";
import { mapChanges } from "../web/changes.js";
import type { MapChange } from "../web/types.js";

/**
 * Un Replay : un vrai problème qu'un agent a résolu sur ce dépôt, gardé tel qu'il était. Le code d'avant son
 * correctif, le test qu'il a écrit, ce qu'il a vécu ; son correctif reste caché jusqu'à ce que l'ingénieur
 * rende le sien. On joue dans une copie (un worktree git hors du projet) : le projet n'est jamais touché.
 */

export interface ReplayTest { name: string; ok: boolean; message?: string }
export interface ProposalStep { name: string; ok: boolean; note: string }
export interface Proposal {
  at: string;
  /** La branche du projet sur laquelle le correctif est reporté, et son commit. */
  onto: { branch: string; commit: string };
  steps: ProposalStep[];
  /** Le test du replay sur trois états : le projet avec ton correctif, le projet tel qu'il est, l'état capturé. */
  protects: { label: string; note: string; result: ReplayTest[] }[];
  /** Ce que ton correctif change sur la carte du projet. */
  impact: MapChange[];
  /** Les tests du replay absents du projet, apportés avec ton correctif. */
  addsTests: string[];
  title: string;
  body: string;
  branch: string;
  /** Où la branche irait : un remote GitHub avec gh, un autre remote, ou aucun. */
  remote: "github" | "other" | "none";
  /** Rempli au clic : la branche créée, poussée ou non, et la PR. */
  done?: { at: string; commit: string; pushed: boolean; url?: string; note: string };
}

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
  submitted?: { at: string; result: ReplayTest[]; diff: string; example?: boolean };
  /** Ramener ce que tu as trouvé dans le projet : les vérifications faites sur le projet à jour, puis la branche. */
  proposal?: Proposal;
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
    // Le correctif, c'est le code : les notes de l'agent (`.vision/`) n'en font pas partie.
    const tests = s.writes.filter(isTest), fixFiles = s.writes.filter((f) => !isTest(f) && !f.startsWith(".vision/"));
    if (!tests.length || !fixFiles.length) throw new Error("il faut une session qui a écrit un test et du code");
    // Travail non commité : la base est HEAD. Sinon, le commit qui l'a apporté, et la base est son parent.
    const dirty = git(this.root, "status", "--porcelain", "--", ...fixFiles).trim().length > 0;
    const base = git(this.root, "rev-parse", dirty ? "HEAD" : "HEAD~1").trim();
    // Un fichier nouveau, pas encore suivi par git, fait partie du correctif.
    const fresh = git(this.root, "ls-files", "--others", "--exclude-standard", "--", ...fixFiles).split("\n").filter(Boolean);
    const patch = git(this.root, "diff", base, "--", ...fixFiles) + fresh.map((f) => spawnSync("git", ["diff", "--no-index", "--", "/dev/null", f], { cwd: this.root, encoding: "utf8" }).stdout).join("");
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
      // Le problème du Replay : ce que le correctif fait disparaître, le plus grave d'abord. Rien d'autre ne le désigne.
      git(probe, "apply", this.file(id, ".patch"));
      const after = (await new MapSource(probe).refresh()).model;
      git(probe, "apply", "-R", this.file(id, ".patch"));
      const gone = before.findings.filter((f) => f.proof.some((p) => fixFiles.includes(p.path)) && !after.findings.some((x) => x.code === f.code && x.message === f.message));
      const HYGIENE = new Set(["uncalled_entry", "dead_code", "unused_value", "unknown_callable", "unresolved_target", "dynamic_path"]);
      const finding = gone.find((f) => !HYGIENE.has(f.code));
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
    // Un fichier que le correctif de l'agent a créé n'existe pas encore dans la copie : il reste à écrire.
    return existsSync(join(r.copy, path)) ? readFileSync(join(r.copy, path), "utf8") : "";
  }
  /** Écrire dans la copie : seulement un fichier du problème, jamais un test de l'agent. */
  write(id: string, path: string, text: string): void {
    const r = this.get(id);
    if (!r.copy || !this.files(id).includes(path) || r.tests.includes(path)) throw new Error("ce fichier ne s'édite pas ici");
    mkdirSync(dirname(join(r.copy, path)), { recursive: true });
    writeFileSync(join(r.copy, path), text);
  }

  /** Ce que l'ingénieur a changé dans sa copie, hors tests. */
  diff(id: string): string {
    const r = this.get(id);
    if (!r.copy) return "";
    const tracked = spawnSync("git", ["diff", "HEAD", "--", ".", ...r.tests.map((t) => `:(exclude)${t}`), ":(exclude).vision"], { cwd: r.copy, encoding: "utf8", maxBuffer: 16 << 20 }).stdout;
    // Un fichier créé par l'ingénieur compte aussi : git ne le voit pas encore.
    const created = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: r.copy, encoding: "utf8" }).stdout.split("\n")
      .filter((f) => f && !r.tests.includes(f) && !f.startsWith(".vision/"))
      .map((f) => spawnSync("git", ["diff", "--no-index", "--", "/dev/null", f], { cwd: r.copy!, encoding: "utf8" }).stdout).join("");
    return tracked + created;
  }

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
    delete r.submitted; delete r.comparison; delete r.proposal;
    this.save(r);
    return r;
  }

  /** Rejouer depuis le début : la copie est retirée, ta solution et la confrontation oubliées. */
  reset(id: string): Replay {
    const r = this.get(id);
    if (r.copy) this.drop(r.copy);
    delete r.copy; delete r.last; delete r.submitted; delete r.comparison; delete r.proposal;
    this.save(r);
    return r;
  }

  /**
   * Préparer la proposition : une copie du projet à jour (sa branche courante), ton correctif reporté dessus,
   * puis la suite de tests du projet, tsc avant et après, la carte avant et après. Rien n'est écrit dans le projet.
   */
  async prepare(id: string): Promise<Replay> {
    const r = this.get(id);
    if (!r.submitted) throw new Error("rends d'abord ta solution");
    const branch = git(this.root, "rev-parse", "--abbrev-ref", "HEAD").trim();
    const head = git(this.root, "rev-parse", "HEAD").trim();
    const testsDir = join(this.dir, `${id}.tests`);
    const addsTests = r.tests.filter((t) => spawnSync("git", ["cat-file", "-e", `${head}:${t}`], { cwd: this.root }).status !== 0);
    const dir = this.worktree(`${id}-proposer`, head, testsDir);
    const patchFile = join(this.dir, `${id}.yours.patch`);
    writeFileSync(patchFile, r.submitted.diff);
    const steps: ProposalStep[] = [];
    const ok = (t: ReplayTest[]) => t.length > 0 && t.every((x) => x.ok);
    steps.push({ name: "Tests du replay", ok: ok(r.submitted.result), note: `${r.submitted.result.filter((x) => x.ok).length} sur ${r.submitted.result.length}, sur ta copie` });
    // L'état du projet sans ton correctif : le test du replay, tsc, la carte.
    const without = this.runTests(dir, r.tests);
    const tsc = (cwd: string) => existsSync(join(cwd, "tsconfig.json")) ? (spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd, encoding: "utf8", maxBuffer: 64 << 20, timeout: 240_000 }).stdout.match(/error TS\d+/g) ?? []).length : undefined;
    const tscBefore = tsc(dir);
    const mapBefore = (await new MapSource(dir).refresh()).model;
    const check = spawnSync("git", ["apply", "--check", patchFile], { cwd: dir, encoding: "utf8" });
    const applies = check.status === 0;
    steps.push({ name: "Patch", ok: applies, note: applies ? `reporté sur ${branch}, sans conflit` : `en conflit avec ${branch} : ${check.stderr.split("\n")[0]}` });
    let impact: MapChange[] = [], withYours: ReplayTest[] = [];
    if (applies) {
      git(dir, "apply", patchFile);
      withYours = this.runTests(dir, r.tests);
      const suite = this.runTests(dir, []);
      steps.splice(1, 0, { name: "Suite du projet", ok: ok(suite), note: `${suite.filter((x) => x.ok).length} sur ${suite.length}, sur ${branch} à jour` });
      const tscAfter = tsc(dir);
      steps.splice(2, 0, { name: "Analyse statique", ok: tscAfter === undefined || tscAfter <= (tscBefore ?? 0), note: tscAfter === undefined ? "pas de tsconfig : non lancée" : tscAfter > (tscBefore ?? 0) ? `tsc : ${tscAfter - (tscBefore ?? 0)} message${tscAfter - (tscBefore ?? 0) > 1 ? "s" : ""} de plus` : "tsc, aucun message de plus" });
      impact = mapChanges(mapBefore, (await new MapSource(dir).refresh()).model);
      const gone = impact.filter((c) => c.kind === "finding" && c.sign === "removed").length, added = impact.filter((c) => c.kind === "finding" && c.sign === "added").length;
      steps.splice(3, 0, { name: "Impact", ok: added === 0, note: gone || added ? [gone && `${gone} constat${gone > 1 ? "s" : ""} en moins`, added && `${added} en plus`].filter(Boolean).join(", ") : `${impact.length} changement${impact.length > 1 ? "s" : ""} sur la carte` });
    }
    rmSync(join(dir, ".vision"), { recursive: true, force: true });
    rmSync(join(dir, ".replay-result.json"), { force: true });
    const short = r.fixFiles.map((f) => basename(f).replace(/\.[^.]+$/, "")).join("-");
    const num = r.id.slice(2);
    const WHAT: Record<string, string> = { race_read_then_write: "la lecture puis réécriture sans revérifier", unguarded_route: "la garde manquante", scheduled_on_every_instance: "la tâche lancée sur chaque machine" };
    const title = `Corrige ${r.finding ? WHAT[r.finding.code] ?? "le constat" : "le bug"} dans ${r.fixFiles.map((f) => basename(f)).join(", ")} (replay #${num})`;
    const url = spawnSync("git", ["remote", "get-url", "origin"], { cwd: this.root, encoding: "utf8" }).stdout.trim();
    const remote = !url ? "none" : /github\.com/.test(url) && spawnSync("gh", ["--version"]).status === 0 ? "github" : "other";
    const body = [
      `Issu du replay #${num}, rejoué à partir de la correction de ${r.agent.name} du ${new Date(r.agent.at).toLocaleDateString("fr-FR")}.`,
      r.comparison ? `\n${r.comparison.sentence}` : "",
      `\nTests du replay : ${withYours.filter((x) => x.ok).length} sur ${withYours.length} avec ce correctif, ${without.filter((x) => x.ok).length} sur ${without.length} sans.`,
      addsTests.length ? `Ajoute le test ${addsTests.join(", ")}, écrit par ${r.agent.name}.` : "",
      impact.length ? `\nSur la carte de VisionLayer :\n${impact.slice(0, 12).map((c) => `- ${c.sign === "added" ? "ajouté" : "retiré"} : ${c.text}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");
    r.proposal = {
      at: new Date().toISOString(), onto: { branch, commit: head }, steps, impact, addsTests, title, body, branch: `replay/${num}-${short}`, remote,
      protects: [
        { label: `Sur ${branch} avec ton correctif`, note: "ce que la PR apporterait", result: withYours },
        { label: `Sur ${branch} tel qu'il est`, note: `le commit ${head.slice(0, 7)}`, result: without },
        { label: `Sur l'état capturé ${r.base.slice(0, 7)}`, note: "avant toute correction", result: r.before },
      ],
    };
    this.save(r);
    return r;
  }

  /**
   * Le clic : la branche est créée depuis la copie préparée, avec ton correctif et les tests qu'il apporte.
   * Si le projet a un remote GitHub et que gh est là, elle est poussée et la PR ouverte en brouillon ; sinon
   * la branche reste dans le dépôt, prête à pousser. VisionLayer ne fusionne jamais.
   */
  propose(id: string): Replay {
    const r = this.get(id);
    const p = r.proposal;
    if (!p) throw new Error("proposition non préparée");
    if (!p.steps.find((s) => s.name === "Patch")?.ok) throw new Error("le correctif ne se reporte pas sans conflit");
    const dir = join(homedir(), ".visionlayer", "replays", `${basename(this.root)}-${id}-proposer`);
    if (!existsSync(dir)) throw new Error("la copie préparée a disparu : prépare de nouveau");
    git(dir, "switch", "-c", p.branch);
    git(dir, "add", "-A", "--", ...r.fixFiles, ...p.addsTests);
    git(dir, "-c", "user.name=" + (git(this.root, "config", "user.name").trim() || "VisionLayer"), "-c", "user.email=" + (git(this.root, "config", "user.email").trim() || "replay@visionlayer"), "commit", "-q", "-m", `${p.title}\n\n${p.body}`);
    const commit = git(dir, "rev-parse", "HEAD").trim();
    const remote = spawnSync("git", ["remote", "get-url", "origin"], { cwd: this.root, encoding: "utf8" }).stdout.trim();
    const gh = spawnSync("gh", ["--version"]).status === 0;
    if (!/github\.com/.test(remote) || !gh) {
      p.done = { at: new Date().toISOString(), commit, pushed: false, note: !remote ? `Ce dépôt n'a pas de remote : la branche ${p.branch} est prête dans le dépôt, à pousser toi-même.` : !gh ? `gh n'est pas installé : la branche ${p.branch} est prête, à pousser toi-même.` : `Le remote n'est pas sur GitHub : la branche ${p.branch} est prête, à pousser toi-même.` };
    } else {
      const push = spawnSync("git", ["push", "-u", "origin", p.branch], { cwd: dir, encoding: "utf8" });
      if (push.status !== 0) p.done = { at: new Date().toISOString(), commit, pushed: false, note: `La poussée a échoué : ${push.stderr.split("\n")[0]}. La branche ${p.branch} est prête dans le dépôt.` };
      else {
        const pr = spawnSync("gh", ["pr", "create", "--draft", "--head", p.branch, "--base", p.onto.branch, "--title", p.title, "--body", p.body], { cwd: dir, encoding: "utf8" });
        p.done = pr.status === 0 ? { at: new Date().toISOString(), commit, pushed: true, url: pr.stdout.trim(), note: "PR ouverte en brouillon, à relire et fusionner par l'équipe." } : { at: new Date().toISOString(), commit, pushed: true, note: `Branche poussée ; la PR n'a pas pu être ouverte : ${pr.stderr.split("\n")[0]}` };
      }
    }
    this.drop(dir);
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
    // Les dépendances déjà installées : à la racine, et dans le paquet de chaque test (un monorepo).
    for (const d of new Set([".", ...listFiles(testsDir).map((t) => packageOf(path, t))])) {
      if (existsSync(join(this.root, d, "node_modules")) && !existsSync(join(path, d, "node_modules"))) symlinkSync(join(this.root, d, "node_modules"), join(path, d, "node_modules"));
    }
    return path;
  }
  private drop(path: string) { spawnSync("git", ["worktree", "remove", "--force", path], { cwd: this.root }); }

  /** Lancer les tests du Replay avec le lanceur du projet ; le résultat par test. */
  private runTests(cwd: string, tests: string[]): ReplayTest[] {
    return runProjectTests(cwd, tests);
  }
}

/** Le paquet qui contient un test : le dossier du `package.json` le plus proche. */
function packageOf(cwd: string, test: string): string {
  for (let d = dirname(test); ; d = dirname(d)) {
    if (existsSync(join(cwd, d, "package.json"))) return d;
    if (d === "." || d === "/") return ".";
  }
}

/** Le lanceur que le paquet déclare dans son script `test`. Sans indication : vitest, puis jest si le paquet l'emploie. */
function runnerOf(cwd: string): "vitest" | "jest" | "tsx" | "node" {
  let pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> } = {};
  try { pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")); } catch { /* sans manifeste */ }
  const script = pkg.scripts?.test ?? "";
  if (/\bvitest\b/.test(script)) return "vitest";
  if (/\bjest\b/.test(script)) return "jest";
  if (/\btsx\b.*--test/.test(script)) return "tsx";
  if (/\bnode\b.*--test/.test(script)) return "node";
  return { ...pkg.dependencies, ...pkg.devDependencies }.jest ? "jest" : "vitest";
}

/** Le rapport TAP de node:test : un résultat par test, sans les suites qui les regroupent. */
function parseTap(text: string): ReplayTest[] {
  const lines = text.split("\n");
  const out: { depth: number; test: ReplayTest }[] = [];
  lines.forEach((l, i) => {
    const m = /^(\s*)(not ok|ok) \d+ - (.+)$/.exec(l);
    if (!m) return;
    const ok = m[2] === "ok";
    const error = ok ? undefined : lines.slice(i + 1, i + 14).find((x) => /^\s*error: /.test(x))?.replace(/^\s*error: /, "").replace(/^['|>-]+\s*/, "").slice(0, 300);
    out.push({ depth: m[1]!.length, test: { name: m[3]!, ok, ...(error ? { message: error } : {}) } });
  });
  // Un test suivi d'un plus profond juste avant lui est une suite : le rapport écrit la suite après ses tests.
  return out.filter((x, i) => !(i > 0 && out[i - 1]!.depth > x.depth)).map((x) => x.test);
}

/** Lancer des tests avec le lanceur de chacun de leurs paquets ; le résultat par test. */
export function runProjectTests(cwd: string, tests: string[]): ReplayTest[] {
  const byPackage = new Map<string, string[]>();
  for (const t of tests) { const p = packageOf(cwd, t); byPackage.set(p, [...(byPackage.get(p) ?? []), p === "." ? t : t.slice(p.length + 1)]); }
  const out: ReplayTest[] = [];
  for (const [pkg, files] of byPackage) {
    const dir = join(cwd, pkg);
    const runner = runnerOf(dir);
    if (runner === "tsx" || runner === "node") {
      const [cmd, args] = runner === "tsx" ? ["npx", ["tsx", "--test", "--test-reporter=tap", ...files]] as const : ["node", ["--test", "--test-reporter=tap", ...files]] as const;
      // Lancé depuis un autre test, node:test changerait de format : on lui rend un environnement neutre.
      const { NODE_TEST_CONTEXT: _, ...env } = process.env;
      const run = spawnSync(cmd, [...args], { cwd: dir, env, encoding: "utf8", maxBuffer: 64 << 20, timeout: 120_000 });
      const parsed = parseTap(run.stdout ?? "");
      out.push(...(parsed.length ? parsed : [{ name: "les tests n'ont pas pu tourner", ok: false }]));
      continue;
    }
    const file = join(dir, ".replay-result.json");
    rmSync(file, { force: true });
    const args = runner === "jest" ? ["jest", ...files, "--json", `--outputFile=${file}`] : ["vitest", "run", ...files, "--reporter=json", `--outputFile=${file}`];
    spawnSync("npx", args, { cwd: dir, encoding: "utf8", maxBuffer: 64 << 20, timeout: 120_000 });
    try {
      const data = JSON.parse(readFileSync(file, "utf8")) as { testResults: { assertionResults: { title: string; status: string; failureMessages?: string[] }[] }[] };
      // Le message d'échec, sans la pile d'appels ni les codes de couleur du terminal.
      const why = (m?: string[]) => m?.[0]?.replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter((l) => !/^\s+at /.test(l)).slice(0, 6).join("\n").trim();
      out.push(...data.testResults.flatMap((f) => f.assertionResults.map((a) => ({ name: a.title, ok: a.status === "passed", ...(a.status !== "passed" && why(a.failureMessages) ? { message: why(a.failureMessages)! } : {}) }))));
    } catch { out.push({ name: "les tests n'ont pas pu tourner", ok: false }); }
    finally { rmSync(file, { force: true }); }
  }
  return out;
}

function listFiles(dir: string, rel = ""): string[] {
  if (!existsSync(join(dir, rel))) return [];
  return readdirSync(join(dir, rel), { withFileTypes: true }).flatMap((d) => d.isDirectory() ? listFiles(dir, join(rel, d.name)) : [join(rel, d.name)]);
}
const sentence = (m: string) => m.replace(/^./, (c) => c.toUpperCase()).replace(/\.?$/, ".");
