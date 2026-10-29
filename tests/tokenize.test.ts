import { test } from "node:test";
import assert from "node:assert/strict";
import { hasOverlap, tokenize } from "../vision/context/tokenize.js";

test("tokenize: découpe le camelCase", () => {
  assert.deepStrictEqual(tokenize("InvitationService"), ["invitation", "service"]);
});

test("tokenize: découpe les chemins et le snake_case/kebab-case", () => {
  assert.deepStrictEqual(tokenize("src/auth/token-service_v2.ts"), [
    "src",
    "auth",
    "token",
    "service",
    "v2",
    "ts",
  ]);
});

test("tokenize: filtre les mots vides (stopwords) français et anglais", () => {
  assert.deepStrictEqual(tokenize("Implement the invitation for the user"), [
    "implement",
    "invitation",
    "user",
  ]);
  assert.deepStrictEqual(tokenize("Ajouter une expiration pour les invitations"), [
    "ajouter",
    "expiration",
    "invitations",
  ]);
});

test("tokenize: filtre les tokens d'un seul caractère", () => {
  assert.deepStrictEqual(tokenize("a b cd"), ["cd"]);
});

test("hasOverlap: vrai si au moins un token est dans l'ensemble cible", () => {
  assert.equal(hasOverlap(["invitation", "service"], new Set(["service"])), true);
  assert.equal(hasOverlap(["invitation", "service"], new Set(["payment"])), false);
  assert.equal(hasOverlap([], new Set(["service"])), false);
});
