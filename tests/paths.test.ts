import { test } from "node:test";
import assert from "node:assert/strict";
import { assertWithinRepo } from "../vision/model/paths.js";

test("assertWithinRepo accepte un chemin interne normal", () => {
  assert.doesNotThrow(() => assertWithinRepo("/repo", "src/a.ts"));
});

test("assertWithinRepo refuse une traversée de chemin", () => {
  assert.throws(() => assertWithinRepo("/repo", "../../etc/passwd"));
});

test("assertWithinRepo refuse un chemin absolu hors racine", () => {
  assert.throws(() => assertWithinRepo("/repo", "/etc/passwd"));
});
