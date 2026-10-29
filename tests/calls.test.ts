import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { buildCallSequence } from "../vision/logic/calls.js";

const REFERENCE = join(import.meta.dirname, "..", "examples", "reference-project");

function sequenceOf(symbolId: string) {
  const model = buildModel(REFERENCE);
  const symbol = model.files.flatMap((f) => f.symbols).find((s) => s.id === symbolId);
  assert.ok(symbol, `symbole ${symbolId} absent du modèle`);
  const source = readFileSync(join(REFERENCE, symbol.location.path), "utf-8");
  const sequence = buildCallSequence(model, symbol, source);
  assert.ok(sequence);
  return sequence;
}

test("buildCallSequence: appels dans l'ordre du code, résolus vers les imports", () => {
  const seq = sequenceOf("src/auth/invitations/service.ts#createInvitation");
  assert.deepStrictEqual(
    seq.steps.map((s) => [s.callee, s.line, s.target.kind]),
    [
      ["randomUUID", 10, "import"],
      ["generate", 12, "import"],
      ["Date.now", 13, "unresolved"],
      ["save", 15, "import"],
      ["send", 16, "import"],
    ],
  );
  const generate = seq.steps[1]!.target;
  assert.equal(generate.kind, "import");
  if (generate.kind === "import") {
    assert.equal(generate.file, "src/auth/token/service.ts");
    assert.equal(generate.external, false);
  }
  const uuid = seq.steps[0]!.target;
  if (uuid.kind === "import") assert.equal(uuid.external, true);
  assert.equal(seq.facts.branches, 0);
  assert.equal(seq.facts.loops, 0);
  assert.equal(seq.facts.returnType, "Invitation");
});

test("buildCallSequence: appel vers un symbole local du même fichier", () => {
  const seq = sequenceOf("src/auth/token/service.ts#validate");
  const local = seq.steps.find((s) => s.callee === "isExpired");
  assert.ok(local);
  assert.deepStrictEqual(local.target, { kind: "local", file: "src/auth/token/service.ts", line: 7 });
});

test("buildCallSequence: interface sans corps → séquence vide, pas d'erreur", () => {
  const seq = sequenceOf("src/auth/invitations/repository.ts#Invitation");
  assert.deepStrictEqual(seq.steps, []);
});
