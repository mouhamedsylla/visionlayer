import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { InfraModel } from "./types.js";

/** `.vision/infra.json` — projection générée (comme model.json) ; jamais éditée à la main. */
export function writeInfraModel(root: string, infra: InfraModel): void {
  const dir = join(root, ".vision");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "infra.json"), JSON.stringify(infra, null, 2) + "\n");
}

export function readInfraModel(root: string): InfraModel | undefined {
  const path = join(root, ".vision", "infra.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf-8")) as InfraModel;
}
