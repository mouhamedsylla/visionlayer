import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProjectTests } from "../vision/replay/replay.js";

test("Replay : les tests tournent depuis leur paquet, avec le lanceur qu'il déclare", () => {
  const dir = mkdtempSync(join(tmpdir(), "vision-replay-"));
  try {
    mkdirSync(join(dir, "backend", "src"), { recursive: true });
    writeFileSync(join(dir, "backend", "package.json"), `{ "scripts": { "test": "node --test src/*.test.js" } }\n`);
    writeFileSync(join(dir, "backend", "src", "a.test.js"), [
      `const { describe, it } = require("node:test");`, `const assert = require("node:assert");`,
      `describe("suite", () => {`, `  it("passe", () => assert.equal(1, 1));`, `  it("échoue", () => assert.equal(1, 2));`, `});`,
    ].join("\n"));
    const r = runProjectTests(dir, ["backend/src/a.test.js"]);
    assert.deepEqual(r.map((x) => `${x.name} ${x.ok}`), ["passe true", "échoue false"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
