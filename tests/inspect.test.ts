import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { buildInspectResult } from "../vision/inspect/build.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

test("buildInspectResult: requête par chemin de fichier", () => {
  const root = join(FIXTURES_DIR, "simple-dependency");
  const model = buildModel(root);
  const result = buildInspectResult(model, root, "src/a.ts");

  assert.equal(result.kind, "file");
  if (result.kind === "file") {
    assert.equal(result.file.path, "src/a.ts");
    assert.deepStrictEqual(result.file.symbols.map((s) => s.name), ["greet"]);
    assert.deepStrictEqual(result.file.dependents.map((d) => d.from), ["src/b.ts"]);
  }
});

test("buildInspectResult: requête par nom de symbole", () => {
  const root = join(FIXTURES_DIR, "simple-dependency");
  const model = buildModel(root);
  const result = buildInspectResult(model, root, "greet");

  assert.equal(result.kind, "symbol");
  if (result.kind === "symbol") {
    assert.equal(result.symbol.name, "greet");
    assert.deepStrictEqual(result.via, []);
    assert.equal(result.file.path, "src/a.ts");
  }
});

test("buildInspectResult: suit la chaîne de ré-export comme vision source", () => {
  const root = join(FIXTURES_DIR, "re-export");
  const model = buildModel(root);
  const result = buildInspectResult(model, root, "generateToken");

  assert.equal(result.kind, "symbol");
  if (result.kind === "symbol") {
    assert.equal(result.symbol.name, "generate");
    assert.equal(result.file.path, "src/auth/token.ts");
    assert.equal(result.via.length, 1);
  }
});

test("buildInspectResult: requête inconnue", () => {
  const root = join(FIXTURES_DIR, "simple-dependency");
  const model = buildModel(root);
  const result = buildInspectResult(model, root, "doesNotExist");
  assert.deepStrictEqual(result, { kind: "not-found" });
});
