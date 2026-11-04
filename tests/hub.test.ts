import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHub, demoProjects } from "../vision/web/hub.js";

function project() {
  const dir = mkdtempSync(join(tmpdir(), "vision-hub-"));
  const p = join(dir, "shop");
  mkdirSync(p);
  writeFileSync(join(p, "package.json"), `{ "name": "shop", "scripts": { "start": "node main.js" }, "dependencies": { "express": "4" } }\n`);
  writeFileSync(join(p, "main.js"), `const express = require("express");\nconst app = express();\napp.get("/a", (q, r) => r.end());\napp.listen(1);\n`);
  writeFileSync(join(p, "demo.json"), `{ "name": "Boutique", "note": "exemple" }\n`);
  return { dir, p };
}
async function withHub(opts: Parameters<typeof createHub>[0], run: (u: string) => Promise<void>) {
  const s = createHub(opts);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  try { await run(`http://127.0.0.1:${(s.address() as AddressInfo).port}`); } finally { s.close(); }
}

test("démonstration : les projets sont fixés, seule la question à Vigie passe, et la carte est lue", async () => {
  const { dir, p } = project();
  try {
    assert.deepEqual(demoProjects(dir).map((x) => [x.id, x.name, x.note, x.path]), [["shop", "Boutique", "exemple", p]]);
    await withHub({ demo: true, projects: demoProjects(dir) }, async (u) => {
      const hub = await (await fetch(`${u}/hub/projects`)).json();
      assert.equal(hub.demo, true);
      assert.equal(hub.projects[0].path, undefined, "le chemin de la machine n'est pas montré");
      assert.equal((await fetch(`${u}/hub/open?target=/etc`, { method: "POST" })).status, 403);
      const map = await (await fetch(`${u}/p/shop/api/map`)).json();
      assert.ok(map.model.nodes.flatMap((n: any) => n.facets.entrypoints ?? []).some((e: any) => e.key === "GET /a"));
      for (const path of ["/api/map/refresh", "/api/packs/write?pkg=x", "/api/replays/test?id=r", "/api/settings/link?agent=muse"]) {
        assert.equal((await fetch(`${u}/p/shop${path}`, { method: "POST" })).status, 403, path);
      }
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("en local : on ouvre un dossier, une adresse qui n'est pas GitHub est refusée", async () => {
  const { dir, p } = project();
  try {
    await withHub({}, async (u) => {
      const opened = await (await fetch(`${u}/hub/open?target=${encodeURIComponent(p)}`, { method: "POST" })).json();
      assert.equal(opened.name, "shop");
      assert.equal((await fetch(`${u}/p/${opened.id}/api/map`)).status, 200);
      assert.equal((await fetch(`${u}/hub/open?target=${encodeURIComponent("https://example.com/a/b")}`, { method: "POST" })).status, 400);
      assert.equal((await fetch(`${u}/hub/open?target=${encodeURIComponent(join(dir, "absent"))}`, { method: "POST" })).status, 500);
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
