#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { readModel } from "../vision/model/store.js";
import { readInfraModel } from "../vision/infra/store.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel } from "../vision/arch/build.js";
import { buildKnowledge } from "../vision/knowledge/build.js";
import { formatKnowledge } from "../vision/knowledge/format.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();
const asJson = args.includes("--json");
const root = resolve(args.find((a) => !a.startsWith("--")) ?? ".");

if (!existsSync(root)) {
  console.error(`usage: vision knowledge [chemin] [--json]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}

// Les points d'entrée de la carte servent à vérifier les features déclarées et à lister celles qui manquent.
const model = existsSync(resolve(root, ".vision", "model.json")) ? readModel(root) : buildModel(root);
const infra = readInfraModel(root) ?? buildInfraModel(root);
const arch = buildArchModel(root, model, infra);
const entries = arch.entries.filter((e) => e.kind !== "app" && e.kind !== "server").map((e) => e.name);

const report = buildKnowledge(root, entries);
process.stdout.write(asJson ? JSON.stringify(report, null, 2) + "\n" : formatKnowledge(report));
