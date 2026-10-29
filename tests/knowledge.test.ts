import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildKnowledge } from "../vision/knowledge/build.js";
import { loadKnowledge, parseAnchor } from "../vision/knowledge/load.js";
import { claimDetail, confirmClaim, lineDiff } from "../vision/knowledge/detail.js";
import type { KnowledgeReport } from "../vision/knowledge/types.js";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "vision-knowledge-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: root, stdio: "ignore" });
  git("init", "-q");
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const edit = (path: string, from: string, to: string) => {
    const t = readFileSync(join(root, path), "utf-8");
    assert.ok(t.includes(from), `${path} : « ${from} » absent`);
    writeFileSync(join(root, path), t.replace(from, to));
  };
  const commit = (msg: string) => (git("add", "-A"), git("commit", "-q", "-m", msg));
  return { root, write, edit, commit, done: () => rmSync(root, { recursive: true, force: true }) };
}

const QUOTA = `export function reserve(count: number, cap: number) {
  // @k quota.cap
  if (count >= cap) throw new Error("quota");
  return count + 1;
}

export function claim(status: string) {
  if (status !== "queued") return null;
  return "rendering";
}

export function render(job: string) {
  // @k render.reply
  try {
    run(job);
  } catch (e) {
    return 200;
  }
  return 200;
}

function run(job: string) {
  return job;
}
`;

const KNOWLEDGE = `concept: demo.video
kind: feature
name: Vidéo
entries: [videoCreate]
claims:
  - id: demo.cap
    type: rule
    text: Pas plus que le plafond.
    anchor: src/quota.ts#reserve@quota.cap
  - id: demo.claim
    type: failure
    text: Une tâche rejouée ne relance rien.
    anchor: src/quota.ts#claim
  - id: demo.reply
    type: failure
    text: Un rendu raté répond 200.
    anchor: src/quota.ts#render@render.reply
  - id: demo.purpose
    type: purpose
    text: Rendre une vidéo.
    anchor: src/quota.ts#render
  - id: demo.retries
    type: assumption
    text: La file réessaie tout ce qui n'est pas 2xx.
`;

const byId = (r: KnowledgeReport) => Object.fromEntries(r.concepts.flatMap((c) => c.claims).map((c) => [c.id, c]));

test("parseAnchor : chemin, symbole, méthode, marqueur ; refuse de sortir du dépôt", () => {
  assert.deepEqual(parseAnchor("src/a.ts#f@x.y"), { raw: "src/a.ts#f@x.y", path: "src/a.ts", symbol: "f", marker: "x.y" });
  assert.deepEqual(parseAnchor("src/a.ts#C.m"), { raw: "src/a.ts#C.m", path: "src/a.ts", symbol: "C.m", marker: undefined });
  assert.equal(parseAnchor("../x.ts#f"), undefined);
  assert.equal(parseAnchor("/etc/passwd"), undefined);
  assert.equal(parseAnchor(".env"), undefined);
  assert.equal(parseAnchor("functions/.env.local#X"), undefined);
});

test("loadKnowledge : une affirmation non ancrée n'est acceptée que pour une hypothèse ou une définition", () => {
  const r = repo();
  try {
    r.write(".vision/knowledge/a.yaml", "concept: a\nkind: feature\nname: A\nclaims:\n  - id: a.rule\n    type: rule\n    text: Sans ancrage.\n  - id: a.hyp\n    type: assumption\n    text: Hypothèse.\n");
    const { concepts, errors } = loadKnowledge(r.root);
    assert.deepEqual(concepts[0]!.claims.map((c) => c.id), ["a.hyp"]);
    assert.match(errors[0]!.message, /a\.rule/);
  } finally {
    r.done();
  }
});

test("knowledge : un refactoring sans changement de comportement ne périme rien ; un changement périme, contredit ou rend orphelin ; reconfirmer rétablit", () => {
  const r = repo();
  try {
    r.write("src/quota.ts", QUOTA);
    r.write(".vision/knowledge/video.yaml", KNOWLEDGE);
    r.commit("connaissance");

    let k = byId(buildKnowledge(r.root, ["videoCreate", "tutorTurn"]));
    assert.equal(k["demo.cap"]!.state, "verified");
    assert.equal(k["demo.purpose"]!.state, "current");
    assert.equal(k["demo.retries"]!.state, "unanchored");
    assert.equal(k["demo.cap"]!.reference.uncommitted, false);

    // Refactoring : `claim` renommé et déplacé dans un autre fichier, commentaire ajouté dans une partie ancrée.
    r.edit("src/quota.ts", 'export function claim(status: string) {\n  if (status !== "queued") return null;\n  return "rendering";\n}\n', "");
    r.write("src/claim.ts", 'export function claimQueued(status: string) {\n  if (status !== "queued") return null;\n  return "rendering";\n}\n');
    r.edit("src/quota.ts", '  if (count >= cap) throw new Error("quota");', '  if (count >= cap) throw new Error("quota"); // plafond atteint');
    r.commit("refactor");

    const report = buildKnowledge(r.root, ["videoCreate", "tutorTurn"]);
    k = byId(report);
    assert.equal(k["demo.claim"]!.state, "verified");
    assert.equal(k["demo.claim"]!.anchors[0]!.status, "moved");
    assert.equal(k["demo.claim"]!.anchors[0]!.at?.path, "src/claim.ts");
    assert.equal(k["demo.claim"]!.anchors[0]!.at?.symbol, "claimQueued");
    assert.equal(k["demo.cap"]!.state, "verified", "un commentaire ne change pas le code");
    assert.deepEqual(report.entriesWithoutFeature, ["tutorTurn"]);

    // Changements de comportement.
    r.edit("src/quota.ts", "if (count >= cap)", "if (count > cap)");
    r.edit("src/quota.ts", '  try {\n    run(job);\n  } catch (e) {\n    return 200;\n  }\n  return 200;', "  run(job);\n  return 200;");
    r.edit("src/claim.ts", 'export function claimQueued(status: string) {\n  if (status !== "queued") return null;\n  return "rendering";\n}\n', "");
    r.commit("comportement");

    k = byId(buildKnowledge(r.root));
    assert.equal(k["demo.cap"]!.state, "stale");
    assert.equal(k["demo.reply"]!.state, "contradicted");
    assert.equal(k["demo.claim"]!.state, "orphan");
    assert.equal(k["demo.purpose"]!.state, "stale", "le symbole entier a changé");

    // Reconfirmation : toucher les lignes de l'affirmation fait avancer le point de référence.
    r.edit(".vision/knowledge/video.yaml", "    text: Pas plus que le plafond.\n", "    text: Pas plus que le plafond plus un.\n    confirmed: après le changement\n");
    r.commit("reconfirme");
    k = byId(buildKnowledge(r.root));
    assert.equal(k["demo.cap"]!.state, "verified");
    assert.equal(k["demo.reply"]!.state, "contradicted");
  } finally {
    r.done();
  }
});

test("knowledge : une affirmation non commitée est comparée à l'état courant, et signalée comme telle", () => {
  const r = repo();
  try {
    r.write("src/quota.ts", QUOTA);
    r.commit("code");
    r.write(".vision/knowledge/video.yaml", KNOWLEDGE);
    const k = byId(buildKnowledge(r.root));
    assert.equal(k["demo.cap"]!.reference.uncommitted, true);
    assert.equal(k["demo.cap"]!.state, "verified");
  } finally {
    r.done();
  }
});

test("knowledge : la recherche d'un marqueur déplacé n'ouvre que les fichiers de code, jamais un .env", () => {
  const r = repo();
  try {
    r.write("src/quota.ts", QUOTA);
    r.write(".vision/knowledge/video.yaml", KNOWLEDGE);
    r.commit("connaissance");
    r.edit("src/quota.ts", "  // @k quota.cap\n", "");
    r.edit("src/quota.ts", "export function reserve(", "export function reserveSlot(");
    r.write(".env", "# @k quota.cap\n");
    chmodSync(join(r.root, ".env"), 0o000); // l'ouvrir lèverait une erreur
    const k = byId(buildKnowledge(r.root));
    assert.notEqual(k["demo.cap"]!.anchors[0]!.at?.path, ".env");
  } finally {
    r.done();
  }
});

test("lineDiff : lignes ajoutées et retirées, longues suites inchangées repliées", () => {
  const a = ["a", "b", "c", "d", "e", "f", "g", "h", "x"];
  const b = ["a", "b", "c", "d", "e", "f", "g", "h", "y"];
  const d = lineDiff(a, b, 10, 20);
  assert.deepEqual(d.map((l) => l.kind), ["gap", "same", "same", "del", "add"]);
  assert.equal(d[0]!.text, "6 lignes inchangées");
  assert.deepEqual(d.slice(3).map((l) => [l.line, l.text]), [[18, "x"], [28, "y"]]);
});

test("détail et reconfirmation humaine : diff du code ancré depuis la référence, puis ligne confirmed écrite et état rétabli", () => {
  const r = repo();
  try {
    r.write("src/quota.ts", QUOTA);
    r.write(".vision/knowledge/video.yaml", KNOWLEDGE);
    r.commit("connaissance");
    r.edit("src/quota.ts", "if (count >= cap)", "if (count > cap)");
    r.commit("comportement");

    const cap = byId(buildKnowledge(r.root))["demo.cap"]!;
    assert.equal(cap.state, "stale");
    const [d] = claimDetail(r.root, cap);
    assert.deepEqual(d!.diff!.filter((l) => l.kind !== "same").map((l) => [l.kind, l.text.trim()]), [["del", 'if (count >= cap) throw new Error("quota");'], ["add", 'if (count > cap) throw new Error("quota");']]);
    assert.deepEqual(d!.commits.map((c) => c.subject), ["comportement"]);

    const at = confirmClaim(r.root, "demo.cap", "2026-09-28");
    const yaml = readFileSync(join(r.root, ".vision/knowledge/video.yaml"), "utf-8").split("\n");
    assert.match(yaml[at.line - 1]!, /^    confirmed: "2026-09-28/);
    const after = byId(buildKnowledge(r.root))["demo.cap"]!;
    assert.equal(after.state, "verified", "non commitée : comparée au code actuel");
    // Une seconde reconfirmation remplace la ligne, n'en ajoute pas.
    confirmClaim(r.root, "demo.cap", "2026-09-29");
    assert.equal(readFileSync(join(r.root, ".vision/knowledge/video.yaml"), "utf-8").match(/confirmed:/g)!.length, 1);
  } finally {
    r.done();
  }
});
