import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StackModel } from "./types.js";

/** `.vision/stack.json` — projection générée ; `stack.previous.json` = état au scan précédent (archivé par `update`). */
export function writeStackModel(root: string, stack: StackModel): void {
  const dir = join(root, ".vision");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "stack.json"), JSON.stringify(stack, null, 2) + "\n");
}

export function readStackModel(root: string, which: "current" | "previous" = "current"): StackModel | undefined {
  const path = join(root, ".vision", which === "current" ? "stack.json" : "stack.previous.json");
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf-8")) as StackModel;
}
