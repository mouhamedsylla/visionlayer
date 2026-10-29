import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { languageFor, scan, supportedExtensions } from "../vision/scanner/scanner.js";

test("languageFor: reconnaît les extensions supportées", () => {
  assert.equal(languageFor("a.ts"), "typescript");
  assert.equal(languageFor("a.tsx"), "tsx");
  assert.equal(languageFor("a.js"), "javascript");
  assert.equal(languageFor("a.jsx"), "jsx");
  assert.equal(languageFor("a.json"), undefined);
  assert.equal(languageFor("a.md"), undefined);
});

test("supportedExtensions: liste exactement les 8 extensions gérées", () => {
  assert.deepStrictEqual(new Set(supportedExtensions()), new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]));
});

test("scan: découvre les fichiers supportés et ignore node_modules/.git/dist", () => {
  const root = mkdtempSync(join(tmpdir(), "vision-scanner-test-"));
  try {
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "node_modules", "dep"), { recursive: true });
    mkdirSync(join(root, "dist"), { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });

    writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "src", "b.jsx"), "export const b = 1;\n");
    writeFileSync(join(root, "README.md"), "# not code\n");
    writeFileSync(join(root, "node_modules", "dep", "index.ts"), "export const dep = 1;\n");
    writeFileSync(join(root, "dist", "compiled.js"), "module.exports = {};\n");
    writeFileSync(join(root, ".git", "config.js"), "// pas du code applicatif\n");

    const snapshot = scan(root);
    assert.deepStrictEqual(snapshot.files, ["src/a.ts", "src/b.jsx"]);
    assert.equal(snapshot.root, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
