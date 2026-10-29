import type { ArchitectureDiff, ChangedSymbol } from "./diff.js";

export function formatDiff(diff: ArchitectureDiff): string {
  const lines: string[] = ["ARCHITECTURE CHANGES", ""];
  const changeLineCountBefore = lines.length;

  for (const f of diff.addedFiles) lines.push(`+ ${f}`);
  for (const f of diff.removedFiles) lines.push(`- ${f}`);
  for (const s of diff.addedSymbols) lines.push(`+ ${s.name} (${s.kind}) in ${s.location.path}`);
  for (const s of diff.removedSymbols) lines.push(`- ${s.name} (${s.kind}) in ${s.location.path}`);
  for (const c of diff.changedSymbols) lines.push(`~ ${c.id}: ${describeSymbolChange(c)}`);
  for (const d of diff.addedDependencies) lines.push(`+ dependency: ${d.from} -> ${d.to}`);
  for (const d of diff.removedDependencies) lines.push(`- dependency: ${d.from} -> ${d.to}`);
  for (const r of diff.addedReExports) {
    lines.push(`+ re-export: ${r.exportedName} in ${r.file} (from ${r.sourceFile})`);
  }
  for (const r of diff.removedReExports) lines.push(`- re-export: ${r.exportedName} in ${r.file}`);

  if (lines.length === changeLineCountBefore) lines.push("(aucun changement détecté)");

  lines.push("", "AFFECTED");
  if (diff.affectedFiles.length === 0) {
    lines.push("(aucun)");
  } else {
    for (const f of diff.affectedFiles) lines.push(`- ${f}`);
  }

  return lines.join("\n");
}

function describeSymbolChange(c: ChangedSymbol): string {
  const parts: string[] = [];
  if (c.before.exported !== c.after.exported) {
    parts.push(c.after.exported ? "devient exporté" : "n'est plus exporté");
  }
  if (c.before.kind !== c.after.kind) {
    parts.push(`${c.before.kind} -> ${c.after.kind}`);
  }
  return parts.join(", ");
}
