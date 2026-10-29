import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFile } from "../vision/extractor/extractor.js";

/**
 * Tests unitaires directs sur extractFile(), avec des extraits en mémoire —
 * complémentaires aux golden fixtures (tests/golden.test.ts), qui valident le
 * pipeline complet sur de vrais petits repositories. Ici on isole chaque
 * forme syntaxique une par une pour un retour rapide et précis.
 */

const NO_KNOWN_FILES = new Set<string>();

test("extractFile: fonction exportée", () => {
  const { file } = extractFile("a.ts", "export function f(): void {}", "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(
    file.symbols.map((s) => [s.name, s.kind, s.exported]),
    [["f", "function", true]],
  );
});

test("extractFile: fonction non exportée", () => {
  const { file } = extractFile("a.ts", "function f(): void {}", "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(
    file.symbols.map((s) => [s.name, s.kind, s.exported]),
    [["f", "function", false]],
  );
});

test("extractFile: classe, interface, type, enum exportés", () => {
  const source = [
    "export class Foo {}",
    "export interface Bar {}",
    "export type Baz = string;",
    "export enum Qux { A, B }",
  ].join("\n");
  const { file } = extractFile("a.ts", source, "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(
    file.symbols.map((s) => [s.name, s.kind]),
    [
      ["Foo", "class"],
      ["Bar", "interface"],
      ["Baz", "type"],
      ["Qux", "enum"],
    ],
  );
});

test("extractFile: plusieurs déclarateurs dans un seul const/let", () => {
  const { file } = extractFile("a.ts", "export const x = 1, y = 2;", "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(
    file.symbols.map((s) => s.name),
    ["x", "y"],
  );
});

test("extractFile: import externe (bare specifier) marqué external", () => {
  const { dependencies } = extractFile("a.ts", "import { z } from 'zod';", "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(dependencies, [{ from: "a.ts", to: "zod", raw: "zod", external: true }]);
});

test("extractFile: import relatif non résolvable garde le specifier brut, marqué interne", () => {
  const { dependencies } = extractFile("a.ts", "import { z } from './missing';", "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(dependencies, [
    { from: "a.ts", to: "./missing", raw: "./missing", external: false },
  ]);
});

test("extractFile: ré-export local (même fichier)", () => {
  const source = "function helper(): void {}\nexport { helper };";
  const { file, reExports } = extractFile("a.ts", source, "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(
    file.symbols.map((s) => [s.name, s.exported]),
    [["helper", false]],
  );
  assert.deepStrictEqual(reExports, [
    { file: "a.ts", exportedName: "helper", originalName: "helper", sourceFile: "a.ts", external: false },
  ]);
});

test("extractFile: `export * from` et `export default` sans déclaration inline ne plantent pas", () => {
  assert.doesNotThrow(() => extractFile("a.ts", "export * from './x';", "typescript", NO_KNOWN_FILES));
  const { file, reExports } = extractFile("a.ts", "export * from './x';", "typescript", NO_KNOWN_FILES);
  assert.deepStrictEqual(file.symbols, []);
  assert.deepStrictEqual(reExports, []);
});

test("extractFile: syntaxe invalide → parseError renseigné, aucun fait produit", () => {
  const { file, dependencies, reExports } = extractFile(
    "a.ts",
    "export function broken( {\n  return true\n",
    "typescript",
    NO_KNOWN_FILES,
  );
  assert.equal(typeof file.parseError, "string");
  assert.deepStrictEqual(file.symbols, []);
  assert.deepStrictEqual(dependencies, []);
  assert.deepStrictEqual(reExports, []);
});
