#!/usr/bin/env node
import { resolve } from "node:path";
import { readModel } from "../vision/model/store.js";
import { readPreviousModel } from "../vision/model/history.js";
import { diffModels } from "../vision/diff/diff.js";
import { formatDiff } from "../vision/diff/format.js";
import { cliArgs } from "../vision/cli/args.js";

const target = resolve(cliArgs()[0] ?? ".");

const before = readPreviousModel(target);
if (!before) {
  console.error(
    "Pas de modèle précédent trouvé — lancez `vision update` au moins deux fois (avant et après un changement) avant de comparer.",
  );
  process.exit(1);
}

const after = readModel(target);
console.log(formatDiff(diffModels(before, after)));
