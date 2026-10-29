#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { readModel } from "../vision/model/store.js";
import { readInfraModel } from "../vision/infra/store.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildStackModel } from "../vision/stack/build.js";
import { formatStackModel } from "../vision/stack/format.js";
import { diffStacks } from "../vision/stack/diff.js";
import { readStackModel, writeStackModel } from "../vision/stack/store.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();
const asJson = args.includes("--json");
const root = resolve(args.find((a) => !a.startsWith("--")) ?? ".");

if (!existsSync(root)) {
  console.error(`usage: vision stack [chemin] [--json]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}

const model = existsSync(resolve(root, ".vision", "model.json")) ? readModel(root) : buildModel(root);
const infra = readInfraModel(root) ?? buildInfraModel(root);
const stack = buildStackModel(root, model, infra);
if (existsSync(resolve(root, ".vision"))) writeStackModel(root, stack);
const previous = readStackModel(root, "previous");
process.stdout.write(asJson ? JSON.stringify(stack, null, 2) + "\n" : formatStackModel(stack, previous ? diffStacks(previous, stack) : undefined));
