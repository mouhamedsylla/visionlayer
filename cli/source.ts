#!/usr/bin/env node
import { resolve } from "node:path";
import { readModel } from "../vision/model/store.js";
import { resolveSymbol } from "../vision/model/query.js";
import { assertWithinRepo } from "../vision/model/paths.js";
import { cliArgs } from "../vision/cli/args.js";

const [name, root] = cliArgs();
const target = resolve(root ?? ".");

if (!name) {
  console.error("usage: vision source <symbol> [root]");
  process.exit(1);
}

const model = readModel(target);
const outcome = resolveSymbol(model, name);

switch (outcome.kind) {
  case "found": {
    const { file, symbol, via } = outcome.result;
    assertWithinRepo(target, file.path);
    if (via.length > 0) {
      console.log(`(ré-exporté via ${via.map((v) => v.file).join(" -> ")})`);
    }
    console.log(`${symbol.location.path}:${symbol.location.startLine}`);
    break;
  }
  case "ambiguous":
    console.log(`"${name}" est ambigu — ${outcome.results.length} déclarations trouvées :`);
    for (const r of outcome.results) {
      console.log(`  ${r.symbol.id} -> ${r.symbol.location.path}:${r.symbol.location.startLine}`);
    }
    process.exitCode = 1;
    break;
  case "external":
    console.log(
      `"${name}" est ré-exporté depuis un module externe ("${outcome.externalSource}") — pas de ligne de code locale.`,
    );
    process.exitCode = 1;
    break;
  case "not-found":
    console.log(`"${name}" introuvable dans le modèle.`);
    process.exitCode = 1;
    break;
}
