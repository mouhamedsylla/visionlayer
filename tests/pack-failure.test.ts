import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import { checkArchModelV2 } from "../vision/arch/schema.js";

test("un pack qui échoue sur un fichier ne fait pas tomber la carte : l'échec est un manque de couverture", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vision-pack-failed-"));
  try {
    const files: Record<string, string> = {
      Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n`,
      "server.ts": `import express from "express";\nconst app = express();\napp.get("/health", (_req, res) => res.send("ok"));\napp.listen(3000);\n`,
      "odd.ts": `export const strange = 1;\n`,
    };
    for (const [p, t] of Object.entries(files)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), t); }
    const builtins = await loadPacks();
    const express = builtins.find((p) => p.id === "express")!;
    // Un pack écrit trop vite : il casse sur une forme de code qu'il n'attendait pas.
    const fragile = { ...express, id: "fragile", rules: [], matches: [], script: ({ file }: { file: { path: string } }) => { if (file.path === "odd.ts") throw new Error("forme inattendue"); return []; } };
    const packs = [...builtins, fragile as typeof express];
    const base = new FactBase(dir, packs);
    base.refresh();
    const model = assemble(base.database(), { name: "t", packs });
    assert.deepEqual(checkArchModelV2(model), []);
    // Les autres packs ont fait leur travail.
    assert.ok(model.nodes.flatMap((n) => n.facets.entrypoints ?? []).some((e) => e.key === "GET /health"));
    const gap = model.coverage.flatMap((c) => c.gaps).find((g) => g.kind === "pack_failed");
    assert.equal(gap?.subject, "fragile : forme inattendue");
    assert.deepEqual(gap?.where?.map((p) => p.path), ["odd.ts"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
