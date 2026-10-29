#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { scanRepository } from "../vision/model/scan.js";
import { cliArgs } from "../vision/cli/args.js";

const target = resolve(cliArgs()[0] ?? ".");

if (!existsSync(target)) {
  console.error(`usage: vision scan [chemin]\nLe chemin "${target}" n'existe pas.`);
  process.exit(1);
}

const { model, filesWithErrors, visionDir } = scanRepository(target, { archive: false });

console.log(`Scanned ${model.files.length} file(s), ${model.dependencies.length} dependency edge(s).`);
if (filesWithErrors.length > 0) {
  console.log(`${filesWithErrors.length} file(s) with syntax errors (skipped, not extracted):`);
  for (const path of filesWithErrors) console.log(`  - ${path}`);
}
console.log(`Output written to ${visionDir}`);
