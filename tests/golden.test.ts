import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import type { SystemModel } from "../vision/model/types.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

for (const name of readdirSync(FIXTURES_DIR)) {
  test(`golden fixture: ${name}`, () => {
    const fixtureRoot = join(FIXTURES_DIR, name);
    const model = buildModel(fixtureRoot);

    // Le chemin racine est absolu et dépend de la machine/checkout — on le
    // normalise avant comparaison, cf. tests/fixtures/*/expected.json.
    const normalized: SystemModel = {
      ...model,
      repository: { root: "FIXTURE_ROOT" },
    };

    const expected = JSON.parse(readFileSync(join(fixtureRoot, "expected.json"), "utf-8"));

    assert.deepStrictEqual(normalized, expected);
  });
}
