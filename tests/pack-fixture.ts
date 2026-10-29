import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import { checkArchModelV2 } from "../vision/arch/schema.js";
import type { ArchModelV2 } from "../vision/arch/types.js";

/** Un petit dépôt écrit sur place : un exemple par forme de l'API, pas un projet. */
export async function mapOf(files: Record<string, string>): Promise<ArchModelV2> {
  const dir = mkdtempSync(join(tmpdir(), "vision-pack-"));
  try {
    for (const [p, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), text);
    }
    const base = new FactBase(dir, await loadPacks());
    base.refresh();
    const model = assemble(base.database(), { name: "t", packs: await loadPacks() });
    assert.deepEqual(checkArchModelV2(model), []);
    return model;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}


/** Les lignes d'une relation, en texte : pour vérifier un fait avant son passage dans la carte. */
export async function factsOf(files: Record<string, string>, rel: string): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), "vision-pack-"));
  try {
    for (const [p, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      writeFileSync(join(dir, p), text);
    }
    const base = new FactBase(dir, await loadPacks());
    base.refresh();
    return base.database().get(rel).map((t) => t.args.join(" ")).sort();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
