import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { currentCommit } from "../vision/git/local.js";

test("currentCommit: retourne un SHA sur un vrai dépôt Git (celui-ci)", () => {
  // Ce projet est lui-même un dépôt Git — pas besoin d'en fabriquer un pour ce test.
  const commit = currentCommit(join(import.meta.dirname, ".."));
  assert.match(commit ?? "", /^[0-9a-f]{40}$/);
});

test("currentCommit: retourne undefined sans planter hors d'un dépôt Git", () => {
  const dir = mkdtempSync(join(tmpdir(), "vision-not-a-repo-"));
  try {
    assert.equal(currentCommit(dir), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
