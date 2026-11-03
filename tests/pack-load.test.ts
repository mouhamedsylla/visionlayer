import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadedMeta, loadProposal, retirePack } from "../vision/writer/load.js";

test("un pack proposé se charge seul avec sa fiche, puis se retire sans rien perdre", () => {
  const root = mkdtempSync(join(tmpdir(), "vl-load-"));
  mkdirSync(join(root, ".vision", "packs", "proposes"), { recursive: true });
  writeFileSync(join(root, ".vision", "packs", "proposes", "next.yaml"), "id: next\n");
  loadProposal(root, "next", { by: "muse", pkg: "next", at: "2026-11-03T10:00:00Z", tests: 14, cost: 0.2 });
  assert.ok(existsSync(join(root, ".vision", "packs", "next.yaml")));
  assert.equal(loadedMeta(root, "next")?.tests, 14);
  retirePack(root, "next");
  assert.ok(!existsSync(join(root, ".vision", "packs", "next.yaml")));
  assert.ok(existsSync(join(root, ".vision", "packs", "retires", "next.yaml")));
  assert.equal(loadedMeta(root, "next"), undefined);
  assert.throws(() => retirePack(root, "../x"));
});
