import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChangeReport } from "../vision/report/build.js";
import { formatChangeReport } from "../vision/report/format.js";
import type { RiskPolicy } from "../vision/policy/riskClassifier.js";
import type { SystemModel } from "../vision/model/types.js";

function model(overrides: Partial<SystemModel>): SystemModel {
  return { repository: { root: "/repo" }, files: [], dependencies: [], reExports: [], ...overrides };
}

const POLICY: RiskPolicy = {
  high: { paths: ["**/auth/**"], requiredApprovals: 1, blockMergeUntilApproved: true },
  medium: { paths: ["**/src/**"], requiredApprovals: 1, blockMergeUntilApproved: false },
  low: { paths: ["**/*.md"], requiredApprovals: 0, blockMergeUntilApproved: false },
};

test("buildChangeReport: change LOW ne requiert pas d'approbation humaine", () => {
  const before = model({});
  const after = model({ files: [{ path: "docs/readme.md", language: "typescript", symbols: [] }] });

  const report = buildChangeReport({ task: "update docs", before, after, policy: POLICY });
  assert.equal(report.riskLevel, "low");
  assert.equal(report.requiresHumanApproval, false);
});

test("buildChangeReport: change touchant un chemin auth est classé HIGH", () => {
  const before = model({});
  const after = model({
    files: [{ path: "src/auth/service.ts", language: "typescript", symbols: [] }],
  });

  const report = buildChangeReport({ task: "add auth check", before, after, policy: POLICY });
  assert.equal(report.riskLevel, "high");
  assert.equal(report.requiresHumanApproval, true);
});

test("buildChangeReport: détecte le risque d'un fichier supprimé qui avait des dépendants", () => {
  const before = model({
    files: [
      { path: "a.ts", language: "typescript", symbols: [] },
      { path: "b.ts", language: "typescript", symbols: [] },
    ],
    dependencies: [{ from: "a.ts", to: "b.ts", raw: "./b", external: false }],
  });
  const after = model({ files: [{ path: "a.ts", language: "typescript", symbols: [] }] });

  const report = buildChangeReport({ task: "remove b", before, after, policy: POLICY });
  assert.equal(report.detectedRisks.length, 1);
  assert.match(report.detectedRisks[0]!, /b\.ts a été supprimé/);
  assert.match(report.detectedRisks[0]!, /a\.ts/);
});

test("formatChangeReport: absence d'intent explicite, jamais fabriqué", () => {
  const before = model({});
  const after = model({});
  const report = buildChangeReport({ task: "x", before, after, policy: POLICY });
  const out = formatChangeReport(report);
  assert.match(out, /INTENT\n\(non fourni\)/);
});
