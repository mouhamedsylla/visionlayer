#!/usr/bin/env node
import { resolve } from "node:path";
import { readModel } from "../vision/model/store.js";
import { buildAgentContext } from "../vision/context/build.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();
const taskFlagIndex = args.indexOf("--task");

if (taskFlagIndex === -1 || !args[taskFlagIndex + 1]) {
  console.error('usage: vision context --task "description de la tâche" [root]');
  process.exit(1);
}

const task = args[taskFlagIndex + 1]!;
const rootArg = args.filter((_, i) => i !== taskFlagIndex && i !== taskFlagIndex + 1)[0];
const target = resolve(rootArg ?? ".");

const model = readModel(target);
const context = buildAgentContext(model, task);

console.log(`TÂCHE\n  ${context.task}`);
console.log(`\nMOTS-CLÉS DÉTECTÉS\n  ${context.taskTokens.join(", ") || "(aucun)"}`);

console.log(`\nFICHIERS PERTINENTS (${context.matchedFiles.length})`);
if (context.matchedFiles.length === 0) console.log("  (aucun)");
for (const f of context.matchedFiles) {
  console.log(`  ${f.path}`);
  if (f.matchedSymbols.length > 0) console.log(`    symboles correspondants: ${f.matchedSymbols.join(", ")}`);
  if (f.matchedReExports.length > 0) console.log(`    ré-exports correspondants: ${f.matchedReExports.join(", ")}`);
}

console.log(`\nFICHIERS LIÉS — un saut de dépendance (${context.relatedFiles.length})`);
if (context.relatedFiles.length === 0) console.log("  (aucun)");
for (const f of context.relatedFiles) {
  console.log(`  ${f.path}`);
}

console.log(
  `\nINTERPRÉTATION SÉMANTIQUE : aucune (ADR 0005) — uniquement des faits déterministes (correspondance de mots-clés + voisinage direct). L'absence de contraintes/flows affichés ne signifie pas qu'il n'en existe pas : cette capacité n'est pas encore construite.`,
);
