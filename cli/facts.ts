#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { FactBase, type FactCache } from "../vision/facts/base.js";
import { loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import { formatNeutral } from "../vision/facts/format.js";
import { formatScore, score } from "../vision/facts/score.js";
import { cliArgs } from "../vision/cli/args.js";

/**
 * vision facts [chemin] [--json] [--score] [--oracle fichier]
 * La carte neutre (ADR 0017) produite par la base de faits et les packs (RYP-190).
 * Les faits de chaque fichier sont gardés dans .vision/facts.json si .vision/ existe :
 * au passage suivant, seul un fichier modifié est relu.
 */
const args = cliArgs();
const oracleAt = args.indexOf("--oracle");
const oracleArg = oracleAt >= 0 ? args[oracleAt + 1] : undefined;
const root = resolve(args.find((a, i) => !a.startsWith("--") && (oracleAt < 0 || i !== oracleAt + 1)) ?? ".");
if (!existsSync(root)) {
  console.error(`usage: vision facts [chemin] [--json] [--score] [--oracle fichier]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}

const cachePath = join(root, ".vision", "facts.json");
const cache = existsSync(cachePath) ? (JSON.parse(readFileSync(cachePath, "utf8")) as FactCache) : undefined;
const packs = await loadPacks();
const base = new FactBase(root, packs, cache);
const t0 = Date.now();
const r = base.refresh();
const model = assemble(base.database(), { name: basename(root), packs });
if (existsSync(join(root, ".vision"))) writeFileSync(cachePath, JSON.stringify(base.toCache()));

if (args.includes("--json")) process.stdout.write(JSON.stringify(model, null, 2) + "\n");
else {
  process.stdout.write(formatNeutral(model));
  process.stdout.write(`\n${r.read.length} fichiers relus, ${r.reused} repris du cache, en ${Date.now() - t0} ms\n`);
}
// Un projet de contrôle garde son oracle à côté du code cloné : --oracle le désigne.
if (args.includes("--score") || oracleArg) {
  const oracle = oracleArg ? resolve(oracleArg) : join(root, "expected.arch.json");
  if (!existsSync(oracle)) console.error("pas d'oracle expected.arch.json dans ce projet");
  else process.stdout.write(`\nFace à l'oracle\n${formatScore(score(model, JSON.parse(readFileSync(oracle, "utf8"))))}\n`);
}
