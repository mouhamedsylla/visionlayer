import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { classifyChange, classifyPath, loadRiskPolicy } from "../vision/policy/riskClassifier.js";

const POLICY_PATH = join(import.meta.dirname, "..", "policies", "high-risk-paths.yaml");

test("loadRiskPolicy: charge les trois niveaux depuis le YAML réel de RYPHA", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  assert.ok(policy.high.paths.includes("**/auth/**"));
  assert.ok(policy.medium.paths.includes("**/src/**"));
  assert.ok(policy.low.paths.includes("**/*.md"));
  assert.equal(policy.high.blockMergeUntilApproved, true);
  assert.equal(policy.low.blockMergeUntilApproved, false);
});

test("classifyPath: un chemin auth est HIGH même profondément imbriqué", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  assert.equal(classifyPath(policy, "src/auth/invitations/service.ts"), "high");
});

test("classifyPath: un chemin src générique est MEDIUM", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  assert.equal(classifyPath(policy, "src/notifications/email.ts"), "medium");
});

test("classifyPath: la documentation est LOW", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  assert.equal(classifyPath(policy, "docs/architecture.md"), "low");
});

test("classifyChange: un seul chemin HIGH classe tout le changement HIGH", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  const level = classifyChange(policy, ["docs/readme.md", "src/auth/service.ts", "src/utils/helper.ts"]);
  assert.equal(level, "high");
});

test("classifyChange: sans chemin HIGH mais avec du MEDIUM → MEDIUM", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  const level = classifyChange(policy, ["docs/readme.md", "src/utils/helper.ts"]);
  assert.equal(level, "medium");
});

test("classifyChange: uniquement LOW → LOW", () => {
  const policy = loadRiskPolicy(POLICY_PATH);
  assert.equal(classifyChange(policy, ["docs/readme.md", "tests/a.test.ts"]), "low");
});
