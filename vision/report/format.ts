import { formatDiff } from "../diff/format.js";
import type { ChangeReport } from "./build.js";

export function formatChangeReport(report: ChangeReport): string {
  const lines: string[] = [];

  lines.push("CHANGE REPORT");
  lines.push("─".repeat(32));
  lines.push("");

  lines.push("TASK");
  lines.push(report.task);
  lines.push("");

  lines.push("INTENT");
  lines.push(report.intent ?? "(non fourni)");
  lines.push("");

  lines.push("COMMIT");
  lines.push(report.commit ?? "(pas de dépôt Git détecté)");
  lines.push("");

  lines.push(...formatDiff(report.diff).split("\n"));
  lines.push("");

  lines.push("VERIFICATION");
  lines.push("Tests / Semgrep : non disponible — pas encore intégrés (architecture.md §5, étape 13).");
  lines.push("");

  lines.push("RISQUE");
  lines.push(`Niveau : ${report.riskLevel.toUpperCase()}`);
  lines.push(
    report.requiresHumanApproval
      ? "Approbation humaine requise avant merge (gouvernance §6)."
      : "Vérification automatique suffisante (gouvernance §6).",
  );
  lines.push("");

  lines.push("RISQUES DÉTECTÉS AUTOMATIQUEMENT");
  if (report.detectedRisks.length === 0) {
    lines.push("(aucun détecté — ceci ne garantit pas l'absence de risque, seulement l'absence de signal calculable)");
  } else {
    for (const risk of report.detectedRisks) lines.push(`⚠ ${risk}`);
  }
  lines.push("");

  lines.push("HUMAN REVIEW");
  lines.push(
    report.requiresHumanApproval
      ? "Ce changement touche un périmètre classé MEDIUM ou HIGH — revue humaine explicite requise avant merge."
      : "Aucune revue humaine obligatoire pour ce changement (classé LOW).",
  );

  return lines.join("\n");
}
