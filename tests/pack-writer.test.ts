import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPacks, loadPackText } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import { PackRegistry } from "../vision/facts/registry.js";
import { packBrief } from "../vision/writer/brief.js";
import { checkForAgent, syntaxTree } from "../vision/writer/tools.js";

const EXAMPLE = readFileSync(join(import.meta.dirname, "..", "vision", "writer", "example-pack.yaml"), "utf8");

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "vision-writer-"));
  for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }
  return dir;
}

test("la fiche : la technologie, sa version, sa documentation, le vocabulaire ; rien du code du projet", async () => {
  const dir = project({
    "package.json": JSON.stringify({ dependencies: { "node-schedule": "^2.1.1" } }),
    "node_modules/node-schedule/README.md": "# node-schedule\nschedule.scheduleJob(rule, fn)",
    "src/secret.ts": "export const SECRET_PROJECT_CODE = 1;",
  });
  try {
    const brief = packBrief({ root: dir, pkg: "node-schedule", builtins: await loadPacks(), example: EXAMPLE });
    assert.equal(brief.version, "^2.1.1");
    assert.deepEqual(brief.sources, ["node_modules/node-schedule/README.md"]);
    assert.match(brief.text, /schedule\.scheduleJob\(rule, fn\)/);
    assert.match(brief.text, /`trust\(Fichier, Mécanisme, Ligne\)`/);
    assert.match(brief.text, /`entrypoint\(Fichier, Genre, Clé, Fonction, Ligne\)`/);
    assert.doesNotMatch(brief.text, /SECRET_PROJECT_CODE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("syntax_tree rend les nœuds nommés, leurs champs, leurs lignes et le texte des feuilles", () => {
  const tree = syntaxTree('import cp from "x";\napp.use(cp("s"));');
  assert.match(tree, /^\(program\)  L1/);
  assert.match(tree, /function: \(member_expression\)  L2/);
  assert.match(tree, /property: \(property_identifier\)  L2  "use"/);
});

test("check_pack : un pack juste est accepté avec les faits de chaque test ; un test faux dit ce qui manque et ce qui est sorti", async () => {
  const builtins = await loadPacks();
  const good = await checkForAgent(EXAMPLE, builtins);
  assert.equal(good.ok, true);
  assert.match(good.text, /\[ok\] S1 une tâche par scheduleJob/);
  assert.match(good.text, /entrypoint\("jobs\.ts", "schedule", "0 8 \* \* \*", "sendDigest", 3\)/);

  const bad = await checkForAgent(EXAMPLE.replace('"0 8 * * *", sendDigest, _)', '"0 9 * * *", sendDigest, _)'), builtins);
  assert.equal(bad.ok, false);
  assert.match(bad.text, /\[ÉCHEC\] S1/);
  assert.match(bad.text, /"0 9 \* \* \*".*attendu, absent/);
  assert.match(bad.text, /"0 8 \* \* \*"/);
});

test("trust : un mécanisme de confiance se pose sur le bloc qui atteint son fichier, et l'aperçu le montre", async () => {
  const dir = project({
    Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "app.ts"]\n`,
    "app.ts": `import auth from "auth-lib";\nauth.verify();\n`,
  });
  const pack = `id: auth-lib
name: auth-lib
languages: [javascript, typescript]
when: { imports: [auth-lib] }
provides: [trust]
match:
  - query: |
      (call_expression function: (member_expression object: (identifier) @o property: (property_identifier) @m)) @c
    where: { o: { import_of: auth-lib }, m: [verify] }
    emit: trust($file, token, $line)
tests:
  - name: T1
    files:
      a.ts: |
        import auth from "auth-lib";
        auth.verify();
    expect: ['trust(a.ts, token, 2)']
`;
  try {
    const builtins = await loadPacks();
    const registry = new PackRegistry(dir, builtins);
    const base = new FactBase(dir, builtins);
    base.refresh();
    const preview = await registry.preview(base, pack);
    assert.equal(preview.state.status, "active", preview.state.reason);
    assert.deepEqual(preview.changes.map((c) => [c.sign, c.kind, c.text, c.proof?.line]), [["added", "trust", "image reconnaît ses appelants par token", 2]]);

    const trial = base.clone();
    trial.setPacks([...builtins, await loadPackText(pack, "p.yaml", { allowScript: false })]);
    const node = assemble(trial.database(), { name: "t", packs: [...trial.packs] }).nodes.find((n) => n.facets.trust);
    assert.deepEqual(node?.facets.trust?.mechanisms.map((m) => [m.name, m.proof.path, m.proof.line]), [["token", "app.ts", 2]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
