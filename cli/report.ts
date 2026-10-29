#!/usr/bin/env node
import { join, resolve } from "node:path";
import { readModel } from "../vision/model/store.js";
import { readPreviousModel } from "../vision/model/history.js";
import { currentCommit } from "../vision/git/local.js";
import { loadRiskPolicy } from "../vision/policy/riskClassifier.js";
import { buildChangeReport } from "../vision/report/build.js";
import { formatChangeReport } from "../vision/report/format.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();

function flagValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

const task = flagValue("--task");
if (!task) {
  console.error('usage: vision report --task "..." [--intent "..."] [--policy <chemin.yaml>] [root]');
  process.exit(1);
}

const consumedFlags = new Set(["--task", "--intent", "--policy"]);
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i]!;
  if (consumedFlags.has(a)) {
    i++; // saute la valeur du flag
    continue;
  }
  if (!a.startsWith("--")) positional.push(a);
}

const intent = flagValue("--intent");
const policyPathArg = flagValue("--policy");
const target = resolve(positional[0] ?? ".");

const before = readPreviousModel(target);
if (!before) {
  console.error(
    "Pas de modèle précédent trouvé — lancez `vision update` au moins deux fois (avant et après le changement) avant de générer un rapport.",
  );
  process.exit(1);
}
const after = readModel(target);
const commit = currentCommit(target);

const policyPath = resolve(policyPathArg ?? join(import.meta.dirname, "..", "policies", "high-risk-paths.yaml"));
const policy = loadRiskPolicy(policyPath);

const report = buildChangeReport({ task, intent, commit, before, after, policy });
console.log(formatChangeReport(report));
