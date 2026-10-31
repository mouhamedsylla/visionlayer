import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import { PackRegistry } from "../vision/facts/registry.js";
import type { ArchModelV2 } from "../vision/arch/types.js";

/** Un pack comme un agent l'écrirait : une requête, ce qu'il produit, ses tests ; aucun script. */
const NODE_SCHEDULE = (expect = '"0 8 * * *"') => `id: node-schedule
name: node-schedule
languages: [javascript, typescript]
when: { imports: [node-schedule] }
provides: [entrypoint]
match:
  - query: |
      (call_expression
        function: (member_expression object: (identifier) @obj property: (property_identifier) @method)
        arguments: (arguments . (string (string_fragment) @expr) . (identifier) @fn)) @call
    where:
      obj: { import_of: node-schedule }
      method: [scheduleJob]
    at: call
    emit: entrypoint($file, schedule, @expr, @fn, @fn:line)
tests:
  - name: S1 une tâche par scheduleJob
    files:
      jobs.ts: |
        import schedule from "node-schedule";
        function sendDigest() {}
        schedule.scheduleJob("0 8 * * *", sendDigest);
    expect: ['entrypoint(jobs.ts, schedule, ${expect}, sendDigest, _)']
  - name: S2 un autre objet n'est pas une tâche
    files:
      jobs.ts: |
        const schedule = { scheduleJob(_e: string, _f: () => void) {} };
        function x() {}
        schedule.scheduleJob("* * * * *", x);
    absent: ['entrypoint(jobs.ts, schedule, _, _, _)']
`;

const PROJECT: Record<string, string> = {
  Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "jobs.ts"]\n`,
  "jobs.ts": `import schedule from "node-schedule";\nexport function sendDigest() {}\nschedule.scheduleJob("0 8 * * *", sendDigest);\n`,
};

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "vision-registry-"));
  for (const [p, t] of Object.entries(PROJECT)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }
  mkdirSync(join(dir, ".vision", "packs"), { recursive: true });
  return dir;
}
const map = (base: FactBase): ArchModelV2 => assemble(base.database(), { name: "t", packs: [...base.packs] });
const schedules = (m: ArchModelV2) => m.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind === "schedule").map((e) => `${e.key} ${e.handler?.name}`);

test("ADR 0019 : un pack local posé est vérifié, chargé à chaud, puis retiré ; la carte revient à l'identique", async () => {
  const dir = project();
  try {
    const builtins = await loadPacks();
    const registry = new PackRegistry(dir, builtins);
    let base = new FactBase(dir, builtins);
    base.refresh();
    base = await registry.sync(base);
    const before = map(base);
    assert.deepEqual(schedules(before), []);

    writeFileSync(join(dir, ".vision", "packs", "node-schedule.yaml"), NODE_SCHEDULE());
    base = await registry.sync(base);
    assert.deepEqual(registry.states().map((s) => [s.id, s.status, s.reason]), [["node-schedule", "active", undefined]]);
    assert.deepEqual(schedules(map(base)), ["0 8 * * * sendDigest"]);

    unlinkSync(join(dir, ".vision", "packs", "node-schedule.yaml"));
    base = await registry.sync(base);
    assert.deepEqual(registry.states(), []);
    assert.deepEqual(map(base), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ADR 0019 : une version qui échoue à ses tests est refusée, et la version d'avant reste en place", async () => {
  const dir = project();
  try {
    const builtins = await loadPacks();
    const registry = new PackRegistry(dir, builtins);
    let base = new FactBase(dir, builtins);
    base.refresh();
    const file = join(dir, ".vision", "packs", "node-schedule.yaml");
    writeFileSync(file, NODE_SCHEDULE());
    base = await registry.sync(base);
    const good = map(base);

    // Une correction ratée : son propre test ne passe plus.
    writeFileSync(file, NODE_SCHEDULE('"0 9 * * *"'));
    base = await registry.sync(base);
    const [state] = registry.states();
    assert.equal(state!.status, "failed");
    assert.match(state!.reason!, /test « S1 une tâche par scheduleJob » : entrypoint\(jobs\.ts, schedule, "0 9 \* \* \*", sendDigest, _\) attendu, absent/);
    assert.deepEqual(map(base), good);

    // Corrigée : elle repasse.
    writeFileSync(file, NODE_SCHEDULE());
    base = await registry.sync(base);
    assert.equal(registry.states()[0]!.status, "active");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ADR 0019 : refusés au chargement, avec la raison : un script, une relation non déclarée, une arité fausse, un cycle ; inactif si ce qu'il lit manque", async () => {
  const dir = project();
  try {
    const builtins = await loadPacks();
    const registry = new PackRegistry(dir, builtins);
    let base = new FactBase(dir, builtins);
    base.refresh();
    const put = (name: string, text: string) => writeFileSync(join(dir, ".vision", "packs", `${name}.yaml`), text);
    const tests = `tests:\n  - name: t\n    files: { a.ts: "export const a = 1;" }\n`;
    put("a-script", `id: a-script\nname: S\nscript: x.ts\nprovides: [x]\n${tests}`);
    put("b-undeclared", `id: b-undeclared\nname: U\nprovides: [x_b]\nrules: |\n  y_b(F) :- file(F).\n${tests}`);
    put("c-arity", `id: c-arity\nname: A\nprovides: [entrypoint]\nrules: |\n  entrypoint(F, x) :- file(F).\n${tests}`);
    put("d-cycle1", `id: d-cycle1\nname: C1\nprovides: [c_one]\nrequires: [c_two]\nrules: |\n  c_one(F) :- c_two(F).\n${tests}`);
    put("e-cycle2", `id: e-cycle2\nname: C2\nprovides: [c_two]\nrequires: [c_one]\nrules: |\n  c_two(F) :- c_one(F).\n${tests}`);
    put("f-waits", `id: f-waits\nname: W\nprovides: [w_out]\nrequires: [nobody_makes_this]\nrules: |\n  w_out(F) :- nobody_makes_this(F).\n${tests}`);
    base = await registry.sync(base);
    const st = Object.fromEntries(registry.states().map((s) => [s.id, `${s.status} : ${s.reason ?? ""}`]));
    assert.match(st["a-script"]!, /^failed : .*pas droit à un script/);
    assert.match(st["b-undeclared"]!, /^failed : produit sans le déclarer : y_b/);
    assert.match(st["c-arity"]!, /^failed : entrypoint a 2 arguments ici, 5 dans le pack/);
    assert.match(st["e-cycle2"]!, /^failed : cycle avec le pack d-cycle1/);
    assert.match(st["f-waits"]!, /^inactive : nobody_makes_this n'est produite par aucun pack actif/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ADR 0019 : la carte servie (MCP, interface) prend le pack au rafraîchissement suivant, sans redémarrer, et dit ce qui a changé", async () => {
  const { MapSource } = await import("../vision/web/map-source.js");
  const dir = project();
  try {
    const source = new MapSource(dir);
    const first = await source.get();
    writeFileSync(join(dir, ".vision", "packs", "node-schedule.yaml"), NODE_SCHEDULE());
    const grown = await source.refresh();
    assert.deepEqual(schedules(grown.model), ["0 8 * * * sendDigest"]);
    assert.ok(grown.changes?.items.some((c) => c.sign === "added"), JSON.stringify(grown.changes));
    assert.deepEqual(grown.localPacks?.map((p) => p.status), ["active"]);
    unlinkSync(join(dir, ".vision", "packs", "node-schedule.yaml"));
    const back = await source.refresh();
    assert.deepEqual(back.model, first.model);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ADR 0019 : un pack proposé s'essaie à part ; on voit ce qu'il ajouterait, et la carte acceptée ne bouge pas", async () => {
  const dir = project();
  try {
    const builtins = await loadPacks();
    const registry = new PackRegistry(dir, builtins);
    const base = new FactBase(dir, builtins);
    base.refresh();
    const accepted = map(base);
    const { state, changes } = await registry.preview(base, NODE_SCHEDULE());
    assert.equal(state.status, "active");
    assert.ok(changes.some((c) => c.sign === "added" && /sendDigest|0 8/.test(JSON.stringify(c))), JSON.stringify(changes));
    assert.deepEqual(map(base), accepted);
    assert.deepEqual(registry.states(), []);
    // Un pack proposé qui échoue à ses tests ne montre rien et dit pourquoi.
    const bad = await registry.preview(base, NODE_SCHEDULE('"1 1 1 1 1"'));
    assert.equal(bad.state.status, "failed");
    assert.deepEqual(bad.changes, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
