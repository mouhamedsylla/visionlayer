import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ArchModel } from "./types.js";

/** `.vision/architecture.json` — projection générée, jamais éditée à la main. */
export function writeArchModel(root: string, arch: ArchModel): void {
  const dir = join(root, ".vision");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "architecture.json"), JSON.stringify(arch, null, 2) + "\n");
}

export function readArchModel(root: string): ArchModel | undefined {
  const path = join(root, ".vision", "architecture.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf-8")) as ArchModel;
}
