import { test } from "node:test";
import assert from "node:assert/strict";
import { diffModels } from "../vision/diff/diff.js";
import { formatDiff } from "../vision/diff/format.js";
import type { SystemModel } from "../vision/model/types.js";

function model(overrides: Partial<SystemModel>): SystemModel {
  return { repository: { root: "/repo" }, files: [], dependencies: [], reExports: [], ...overrides };
}

test("diffModels: fichier, symbole et dépendance ajoutés", () => {
  const before = model({
    files: [{ path: "a.ts", language: "typescript", symbols: [] }],
  });
  const after = model({
    files: [
      { path: "a.ts", language: "typescript", symbols: [] },
      {
        path: "b.ts",
        language: "typescript",
        symbols: [
          {
            id: "b.ts#f",
            name: "f",
            kind: "function",
            exported: true,
            location: { path: "b.ts", startLine: 1, endLine: 2 },
          },
        ],
      },
    ],
    dependencies: [{ from: "a.ts", to: "b.ts", raw: "./b", external: false }],
  });

  const diff = diffModels(before, after);
  assert.deepStrictEqual(diff.addedFiles, ["b.ts"]);
  assert.deepStrictEqual(diff.removedFiles, []);
  assert.deepStrictEqual(diff.addedSymbols.map((s) => s.id), ["b.ts#f"]);
  assert.deepStrictEqual(diff.addedDependencies, [{ from: "a.ts", to: "b.ts", raw: "./b", external: false }]);
  assert.deepStrictEqual(diff.affectedFiles, ["a.ts", "b.ts"]);
});

test("diffModels: fichier et dépendance supprimés", () => {
  const before = model({
    files: [
      { path: "a.ts", language: "typescript", symbols: [] },
      { path: "b.ts", language: "typescript", symbols: [] },
    ],
    dependencies: [{ from: "a.ts", to: "b.ts", raw: "./b", external: false }],
  });
  const after = model({
    files: [{ path: "a.ts", language: "typescript", symbols: [] }],
  });

  const diff = diffModels(before, after);
  assert.deepStrictEqual(diff.removedFiles, ["b.ts"]);
  assert.deepStrictEqual(diff.removedDependencies, [{ from: "a.ts", to: "b.ts", raw: "./b", external: false }]);
});

test("diffModels: un symbole qui devient exporté est signalé comme changé, pas ajouté/supprimé", () => {
  const symbolBefore = {
    id: "a.ts#f",
    name: "f",
    kind: "function" as const,
    exported: false,
    location: { path: "a.ts", startLine: 1, endLine: 2 },
  };
  const before = model({ files: [{ path: "a.ts", language: "typescript", symbols: [symbolBefore] }] });
  const after = model({
    files: [{ path: "a.ts", language: "typescript", symbols: [{ ...symbolBefore, exported: true }] }],
  });

  const diff = diffModels(before, after);
  assert.deepStrictEqual(diff.addedSymbols, []);
  assert.deepStrictEqual(diff.removedSymbols, []);
  assert.equal(diff.changedSymbols.length, 1);
  assert.equal(diff.changedSymbols[0]!.before.exported, false);
  assert.equal(diff.changedSymbols[0]!.after.exported, true);
});

test("diffModels: ré-export ajouté", () => {
  const before = model({ files: [{ path: "a.ts", language: "typescript", symbols: [] }] });
  const after = model({
    files: [{ path: "a.ts", language: "typescript", symbols: [] }],
    reExports: [
      { file: "a.ts", exportedName: "x", originalName: "x", sourceFile: "b.ts", external: false },
    ],
  });

  const diff = diffModels(before, after);
  assert.equal(diff.addedReExports.length, 1);
  assert.equal(diff.addedReExports[0]!.exportedName, "x");
});

test("diffModels: aucun changement → listes vides et rapport explicite", () => {
  const m = model({ files: [{ path: "a.ts", language: "typescript", symbols: [] }] });
  const diff = diffModels(m, m);
  assert.deepStrictEqual(diff.affectedFiles, []);
  assert.match(formatDiff(diff), /aucun changement détecté/);
});

test("formatDiff: produit le format ARCHITECTURE CHANGES / AFFECTED", () => {
  const before = model({});
  const after = model({
    files: [
      {
        path: "a.ts",
        language: "typescript",
        symbols: [
          {
            id: "a.ts#f",
            name: "f",
            kind: "function",
            exported: true,
            location: { path: "a.ts", startLine: 1, endLine: 2 },
          },
        ],
      },
    ],
  });
  const out = formatDiff(diffModels(before, after));
  assert.match(out, /^ARCHITECTURE CHANGES/);
  assert.match(out, /\+ a\.ts/);
  assert.match(out, /\+ f \(function\) in a\.ts/);
  assert.match(out, /AFFECTED/);
});
