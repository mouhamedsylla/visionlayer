import type { SystemModel } from "../model/types.js";
import { dependentsOf } from "../model/query.js";
import { diffModels, type ArchitectureDiff } from "../diff/diff.js";
import { classifyChange, type RiskLevel, type RiskPolicy } from "../policy/riskClassifier.js";

export interface ChangeReport {
  task: string;
  intent?: string;
  commit?: string;
  diff: ArchitectureDiff;
  riskLevel: RiskLevel;
  requiresHumanApproval: boolean;
  /** Risques déduits déterministiquement du graphe — pas une interprétation, cf. ADR 0005. */
  detectedRisks: string[];
}

export interface BuildChangeReportParams {
  task: string;
  intent?: string;
  commit?: string;
  before: SystemModel;
  after: SystemModel;
  policy: RiskPolicy;
}

export function buildChangeReport(params: BuildChangeReportParams): ChangeReport {
  const diff = diffModels(params.before, params.after);
  const riskLevel = classifyChange(params.policy, diff.affectedFiles);
  const detectedRisks = detectRisks(params.before, diff);

  return {
    task: params.task,
    intent: params.intent,
    commit: params.commit,
    diff,
    riskLevel,
    requiresHumanApproval: riskLevel !== "low",
    detectedRisks,
  };
}

/**
 * Signaux de risque calculables sans interprétation : un fichier/symbole
 * supprimé qui avait des dépendants avant le changement. Le graphe de
 * dépendances reste au niveau fichier, pas symbole — donc pour un symbole
 * qui perd son export, le signal porte sur le fichier entier, pas la preuve
 * qu'un dépendant utilisait précisément CE symbole (limite documentée, pas
 * une fausse certitude).
 */
function detectRisks(before: SystemModel, diff: ArchitectureDiff): string[] {
  const risks: string[] = [];

  for (const removedFile of diff.removedFiles) {
    const dependents = dependentsOf(before, removedFile);
    if (dependents.length > 0) {
      risks.push(
        `${removedFile} a été supprimé alors que ${dependents.length} fichier(s) en dépendaient : ${dependents
          .map((d) => d.from)
          .join(", ")}.`,
      );
    }
  }

  for (const change of diff.changedSymbols) {
    if (change.before.exported && !change.after.exported) {
      const dependents = dependentsOf(before, change.after.location.path);
      if (dependents.length > 0) {
        risks.push(
          `${change.id} n'est plus exporté, et ${dependents.length} fichier(s) dépendent de ${change.after.location.path} : ${dependents
            .map((d) => d.from)
            .join(", ")} — à vérifier (le graphe ne distingue pas quel symbole précis chaque dépendant utilise).`,
        );
      }
    }
  }

  return risks;
}
