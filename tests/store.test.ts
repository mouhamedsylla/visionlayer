import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readModel, writeModel } from "../vision/model/store.js";
import type { SystemModel } from "../vision/model/types.js";

test("writeModel/readModel: aller-retour fidèle, y compris reExports", () => {
  const root = mkdtempSync(join(tmpdir(), "vision-store-test-"));
  try {
    const original: SystemModel = {
      repository: { root },
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
      dependencies: [{ from: "a.ts", to: "zod", raw: "zod", external: true }],
      reExports: [
        { file: "a.ts", exportedName: "f", originalName: "f", sourceFile: "a.ts", external: false },
      ],
    };

    writeModel(root, original);
    assert.ok(existsSync(join(root, ".vision", "model.json")));
    assert.ok(existsSync(join(root, ".vision", "metadata.json")));

    const roundTripped = readModel(root);
    assert.deepStrictEqual(roundTripped, original);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writeModel: metadata.json reflète les compteurs réels", () => {
  const root = mkdtempSync(join(tmpdir(), "vision-store-test-"));
  try {
    const model: SystemModel = {
      repository: { root },
      files: [
        { path: "a.ts", language: "typescript", symbols: [] },
        { path: "b.ts", language: "typescript", symbols: [] },
      ],
      dependencies: [{ from: "b.ts", to: "a.ts", raw: "./a", external: false }],
      reExports: [],
    };
    writeModel(root, model);

    const metadata = JSON.parse(readFileSync(join(root, ".vision", "metadata.json"), "utf-8"));
    assert.equal(metadata.fileCount, 2);
    assert.equal(metadata.dependencyCount, 1);
    assert.equal(typeof metadata.generatedAt, "string");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
