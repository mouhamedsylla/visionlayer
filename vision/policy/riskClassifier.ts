import { readFileSync } from "node:fs";
import { minimatch } from "minimatch";
import { parse as parseYaml } from "yaml";

export type RiskLevel = "low" | "medium" | "high";

interface RiskTier {
  paths: string[];
  requiredApprovals: number;
  blockMergeUntilApproved: boolean;
}

export interface RiskPolicy {
  high: RiskTier;
  medium: RiskTier;
  low: RiskTier;
}

/**
 * Charge `policies/high-risk-paths.yaml` (gouvernance §6) — la même source
 * de vérité que celle destinée à CODEOWNERS/branch protection. `vision
 * report` ne réinvente pas de règle : il applique celle déjà écrite.
 */
export function loadRiskPolicy(policyPath: string): RiskPolicy {
  const raw = parseYaml(readFileSync(policyPath, "utf-8")) as Record<string, unknown>;
  return {
    high: toTier(raw.high_risk),
    medium: toTier(raw.medium_risk),
    low: toTier(raw.low_risk),
  };
}

function toTier(node: unknown): RiskTier {
  const n = (node ?? {}) as Record<string, unknown>;
  return {
    paths: Array.isArray(n.paths) ? (n.paths as string[]) : [],
    requiredApprovals: typeof n.required_approvals === "number" ? n.required_approvals : 0,
    blockMergeUntilApproved: n.block_merge_until_approved === true,
  };
}

export function classifyPath(policy: RiskPolicy, path: string): RiskLevel {
  if (policy.high.paths.some((p) => minimatch(path, p))) return "high";
  if (policy.medium.paths.some((p) => minimatch(path, p))) return "medium";
  return "low";
}

/** Le pire niveau parmi tous les fichiers affectés — un seul chemin HIGH suffit à classer tout le changement HIGH. */
export function classifyChange(policy: RiskPolicy, affectedFiles: string[]): RiskLevel {
  let worst: RiskLevel = "low";
  for (const path of affectedFiles) {
    const level = classifyPath(policy, path);
    if (level === "high") return "high";
    if (level === "medium") worst = "medium";
  }
  return worst;
}
