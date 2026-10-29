import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { dependenciesOf, dependentsOf, resolveSymbol } from "../vision/model/query.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

test("resolveSymbol: déclaration directe simple", () => {
  const model = buildModel(join(FIXTURES_DIR, "simple-dependency"));
  const outcome = resolveSymbol(model, "greet");
  assert.equal(outcome.kind, "found");
  if (outcome.kind === "found") {
    assert.equal(outcome.result.file.path, "src/a.ts");
    assert.deepStrictEqual(outcome.result.via, []);
  }
});

test("resolveSymbol: suit une chaîne de ré-export avec alias jusqu'à la déclaration réelle", () => {
  const model = buildModel(join(FIXTURES_DIR, "re-export"));

  // La navigation naïve (déclarations directes uniquement) ne trouve rien :
  // "generateToken" n'est déclaré nulle part, seulement ré-exporté.
  const outcome = resolveSymbol(model, "generateToken");
  assert.equal(outcome.kind, "found");
  if (outcome.kind === "found") {
    assert.equal(outcome.result.file.path, "src/auth/token.ts");
    assert.equal(outcome.result.symbol.name, "generate");
    assert.equal(outcome.result.via.length, 1);
    assert.equal(outcome.result.via[0]!.file, "src/auth/index.ts");
  }
});

test("resolveSymbol: nom totalement inconnu", () => {
  const model = buildModel(join(FIXTURES_DIR, "simple-dependency"));
  const outcome = resolveSymbol(model, "doesNotExist");
  assert.equal(outcome.kind, "not-found");
});

test("dependenciesOf / dependentsOf traversent correctement des chemins imbriqués", () => {
  const model = buildModel(join(FIXTURES_DIR, "nested-modules"));

  const deps = dependenciesOf(model, "src/auth/token/service.ts");
  assert.equal(deps.length, 1);
  assert.equal(deps[0]!.to, "src/auth/user/service.ts");

  const dependents = dependentsOf(model, "src/auth/user/service.ts");
  assert.equal(dependents.length, 1);
  assert.equal(dependents[0]!.from, "src/auth/token/service.ts");
});
