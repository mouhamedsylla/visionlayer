import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSyntaxError, parse } from "../vision/parsers/parser.js";

test("parse: produit un arbre valide pour du TypeScript correct", () => {
  const tree = parse("export function greet(): string { return 'x'; }", "typescript");
  assert.equal(tree.rootNode.type, "program");
  assert.equal(hasSyntaxError(tree), false);
});

test("hasSyntaxError: détecte une syntaxe invalide sans planter", () => {
  const tree = parse("export function broken( {\n  return true\n", "typescript");
  assert.equal(hasSyntaxError(tree), true);
});

test("parse: gère le JavaScript", () => {
  const tree = parse("function f() { return 1; }", "javascript");
  assert.equal(hasSyntaxError(tree), false);
});

test("parse: gère le JSX sans planter (grammaire tree-sitter-javascript)", () => {
  const tree = parse("function App() { return <div>hello</div>; }", "jsx");
  assert.equal(hasSyntaxError(tree), false);
});

test("parse: gère le TSX sans planter (grammaire tree-sitter-typescript/tsx)", () => {
  const tree = parse(
    "export function App(): JSX.Element { return <div>hello</div>; }",
    "tsx",
  );
  assert.equal(hasSyntaxError(tree), false);
});

test("parse: un fichier de plus de 32 Kio ne fait pas échouer le binding (cas Nafar, videoCourses.ts)", () => {
  const entry = 'export const v = [\n' + '  { id: "x", title: "Un titre assez long pour peser", url: "https://example.invalid/a/b/c" },\n'.repeat(4000) + "];\n";
  assert.ok(Buffer.byteLength(entry) > 300_000);
  const tree = parse(entry, "typescript");
  assert.equal(tree.rootNode.type, "program");
  assert.equal(hasSyntaxError(tree), false);
});

test("parse: un `&` nu dans du texte ou un attribut JSX n'écarte plus le fichier (Nafar : « Crédits & sources »)", () => {
  const src = [
    'import { x } from "./x";',
    "export function Page() {",
    '  return <Hero title="Crédits IA &" sub="a & b">Crédits & sources {x && 1} &amp; fin</Hero>;',
    "}",
    "export const after = 1;",
  ].join("\n");
  const tree = parse(src, "tsx");
  assert.equal(hasSyntaxError(tree), false);
  // Remplacement octet pour octet : les positions restent exactes.
  const decl = tree.rootNode.namedChildren.find((n) => n.text.includes("after"))!;
  assert.equal(decl.startPosition.row, 4);
  assert.equal(tree.rootNode.text, src.replace(/Crédits IA &/, "Crédits IA  ").replace("a & b", "a   b").replace("Crédits & sources", "Crédits   sources"));
});

test("parse: une vraie erreur de syntaxe reste une erreur, même avec un `&` à côté", () => {
  const tree = parse("export function f( { return <div>a & b</div>; }", "tsx");
  assert.equal(hasSyntaxError(tree), true);
});
