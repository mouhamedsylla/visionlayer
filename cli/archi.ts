#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { readModel } from "../vision/model/store.js";
import { readInfraModel } from "../vision/infra/store.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel } from "../vision/arch/build.js";
import { writeArchModel } from "../vision/arch/store.js";
import { buildFlow } from "../vision/arch/flow.js";
import { formatArchModel, formatFlow } from "../vision/arch/format.js";
import { cliArgs } from "../vision/cli/args.js";

const args = cliArgs();
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const asJson = args.includes("--json");
const feature = flag("--feature");
const root = resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--feature") ?? ".");

if (!existsSync(root)) {
  console.error(`usage: vision archi [chemin] [--feature <point d'entrée>] [--json]\nLe chemin "${root}" n'existe pas.`);
  process.exit(1);
}

const model = existsSync(resolve(root, ".vision", "model.json")) ? readModel(root) : buildModel(root);
const infra = readInfraModel(root) ?? buildInfraModel(root);
const arch = buildArchModel(root, model, infra);
if (existsSync(resolve(root, ".vision"))) writeArchModel(root, arch);

if (feature) {
  const entry = arch.entries.find((e) => e.name === feature || e.id === feature);
  if (!entry) {
    console.error(`point d'entrée « ${feature} » introuvable. Disponibles : ${arch.entries.map((e) => e.name).join(", ")}`);
    process.exit(1);
  }
  const flow = buildFlow(root, model, arch, { entry: entry.id });
  if (!flow) {
    console.error(`parcours de « ${feature} » non calculable (fichier illisible ou logique introuvable)`);
    process.exit(1);
  }
  process.stdout.write(asJson ? JSON.stringify(flow, null, 2) + "\n" : formatFlow(flow, arch));
} else {
  process.stdout.write(asJson ? JSON.stringify(arch, null, 2) + "\n" : formatArchModel(arch));
}
