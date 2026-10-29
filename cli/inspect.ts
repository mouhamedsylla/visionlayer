#!/usr/bin/env node
import { resolve } from "node:path";
import { readModel } from "../vision/model/store.js";
import { buildInspectResult, type FileInspection } from "../vision/inspect/build.js";
import { cliArgs } from "../vision/cli/args.js";

const [query, root] = cliArgs();
const target = resolve(root ?? ".");

if (!query) {
  console.error("usage: vision inspect <file-path|symbol-name> [root]");
  process.exit(1);
}

const model = readModel(target);
const result = buildInspectResult(model, target, query);

switch (result.kind) {
  case "file":
    printFile(result.file);
    break;
  case "symbol":
    console.log(`SYMBOLE ${result.symbol.name} (${result.symbol.kind}${result.symbol.exported ? ", exporté" : ""})`);
    if (result.via.length > 0) console.log(`  Ré-exporté via: ${result.via.map((v) => v.file).join(" -> ")}`);
    console.log(`  Défini dans: ${result.symbol.location.path}:${result.symbol.location.startLine}`);
    console.log();
    printFile(result.file);
    break;
  case "ambiguous":
    console.log(`"${query}" est ambigu — ${result.candidates.length} candidats :`);
    for (const c of result.candidates) console.log(`  ${c.id}`);
    process.exitCode = 1;
    break;
  case "external":
    console.log(`"${query}" est ré-exporté depuis un module externe ("${result.externalSource}").`);
    process.exitCode = 1;
    break;
  case "not-found":
    console.log(`"${query}" introuvable — ni fichier ni symbole dans le modèle.`);
    process.exitCode = 1;
    break;
}

function printFile(f: FileInspection): void {
  console.log(`FICHIER ${f.path} (${f.language})`);
  if (f.parseError) console.log(`  ⚠ erreur de syntaxe: ${f.parseError}`);

  console.log(f.symbols.length === 0 ? "  Symboles: (aucun)" : "  Symboles:");
  for (const s of f.symbols) {
    console.log(`    ${s.exported ? "export " : ""}${s.kind} ${s.name}  (${s.location.path}:${s.location.startLine})`);
  }

  console.log(f.dependsOn.length === 0 ? "  Dépend de: (aucune)" : "  Dépend de:");
  for (const d of f.dependsOn) console.log(`    -> ${d.to}${d.external ? " (externe)" : ""}`);

  console.log(f.dependents.length === 0 ? "  Utilisé par: (aucun)" : "  Utilisé par:");
  for (const d of f.dependents) console.log(`    <- ${d.from}`);
}
