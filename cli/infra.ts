#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildInfraModel } from "../vision/infra/build.js";
import { formatInfraModel } from "../vision/infra/format.js";
import { writeInfraModel } from "../vision/infra/store.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();
const asJson = args.includes("--json");
const root = resolve(args.find((a) => !a.startsWith("--")) ?? ".");

if (!existsSync(root)) {
  console.error(`usage: vision infra [chemin] [--json]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}

const infra = buildInfraModel(root);
if (existsSync(resolve(root, ".vision"))) writeInfraModel(root, infra);
process.stdout.write(asJson ? JSON.stringify(infra, null, 2) + "\n" : formatInfraModel(infra));
