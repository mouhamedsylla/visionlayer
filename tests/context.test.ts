import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { buildAgentContext } from "../vision/context/build.js";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

test("buildAgentContext: correspondance directe + voisin par dépendance", () => {
  const model = buildModel(join(FIXTURES_DIR, "simple-dependency"));
  const context = buildAgentContext(model, "greet function");

  assert.equal(context.semanticInterpretationApplied, false);
  assert.deepStrictEqual(
    context.matchedFiles.map((f) => f.path),
    ["src/a.ts"],
  );
  assert.deepStrictEqual(context.matchedFiles[0]!.matchedSymbols, ["greet"]);

  // b.ts dépend de a.ts (import), donc il doit apparaître comme lié même si
  // "greet" n'y est pas déclaré.
  assert.deepStrictEqual(
    context.relatedFiles.map((f) => f.path),
    ["src/b.ts"],
  );
});

test("buildAgentContext: correspondance via un nom ré-exporté, pas une déclaration locale", () => {
  const model = buildModel(join(FIXTURES_DIR, "re-export"));
  const context = buildAgentContext(model, "generate token");

  const paths = context.matchedFiles.map((f) => f.path).sort();
  // "generate" est déclaré dans token.ts ; "generateToken" n'existe QUE comme
  // ré-export dans index.ts — les deux doivent être trouvés.
  assert.deepStrictEqual(paths, ["src/auth/index.ts", "src/auth/token.ts"]);

  const indexEntry = context.matchedFiles.find((f) => f.path === "src/auth/index.ts")!;
  assert.deepStrictEqual(indexEntry.matchedReExports, ["generateToken"]);
  assert.deepStrictEqual(indexEntry.matchedSymbols, []);
});

test("buildAgentContext: aucune correspondance ne renvoie des listes vides, pas tout le repository", () => {
  const model = buildModel(join(FIXTURES_DIR, "nested-modules"));
  const context = buildAgentContext(model, "quelque chose de totalement étranger");

  assert.deepStrictEqual(context.matchedFiles, []);
  assert.deepStrictEqual(context.relatedFiles, []);
});
