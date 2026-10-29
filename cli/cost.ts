#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { readModel } from "../vision/model/store.js";
import { readInfraModel } from "../vision/infra/store.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel } from "../vision/arch/build.js";
import { readJournal } from "../vision/activity/journal.js";
import { buildCostReport, readPrices } from "../vision/activity/cost.js";
import { formatCostReport } from "../vision/activity/format.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();
const asJson = args.includes("--json");
const root = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
if (!existsSync(root)) {
  console.error(`usage: vision cost [chemin] [--json]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}
const model = existsSync(resolve(root, ".vision", "model.json")) ? readModel(root) : buildModel(root);
const arch = buildArchModel(root, model, readInfraModel(root) ?? buildInfraModel(root));
const report = buildCostReport(arch, readJournal(root), readPrices(root));
process.stdout.write(asJson ? JSON.stringify(report, null, 2) + "\n" : formatCostReport(report));
