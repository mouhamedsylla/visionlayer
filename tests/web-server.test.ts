import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWebServer } from "../vision/web/server.js";
import { redactSecrets } from "../vision/web/source.js";

const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");

async function withServer(staticDir: string | undefined, run: (base: string) => Promise<void>): Promise<void> {
  const server = createWebServer({ root: ATELIER, staticDir });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test("web : GET /api/map donne la carte v2, et la garde jusqu'au clic", async () => {
  await withServer(undefined, async (base) => {
    const first = await (await fetch(`${base}/api/map`)).json();
    assert.equal(first.model.version, 2);
    assert.ok(first.model.nodes.some((n: { id: string }) => n.id === "api"));
    const again = await (await fetch(`${base}/api/map`)).json();
    assert.equal(again.builtAt, first.builtAt, "une lecture ne relance pas l'analyse");
    const refreshed = await (await fetch(`${base}/api/map/refresh`, { method: "POST" })).json();
    assert.equal(refreshed.reread, 0, "rien n'a changé : aucun fichier relu");
  });
});

test("web : le projet ouvert, par son nom", async () => {
  await withServer(undefined, async (base) => {
    const p = await (await fetch(`${base}/api/project`)).json();
    assert.equal(p.name, "atelier-api");
  });
});

test("web : lecture seule, route inconnue, chemin hors du build", async () => {
  const dist = mkdtempSync(join(tmpdir(), "vision-ui-"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>ok</title>");
  await withServer(dist, async (base) => {
    assert.equal((await fetch(`${base}/api/map`, { method: "DELETE" })).status, 404);
    assert.equal((await fetch(`${base}/api/inconnue`)).status, 404);
    assert.equal((await fetch(`${base}/index.html`, { method: "POST" })).status, 405);
    for (const escape of ["/..%2f..%2fpackage.json", "/%2e%2e/%2e%2e/package.json"]) {
      assert.match(await (await fetch(base + escape)).text(), /<title>ok<\/title>/, `${escape} reste dans le build`);
    }
    const page = await fetch(`${base}/architecture`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>ok<\/title>/);
  });
});

test("web : un passage d'un fichier cité par la carte ; refus hors carte, hors dépôt, fichier d'environnement", async () => {
  await withServer(undefined, async (base) => {
    const ok = await (await fetch(`${base}/api/source?path=src/db/schema.ts&from=71&to=73`)).json();
    assert.equal(ok.from, 71);
    assert.deepEqual(ok.lines, ["// Seule l'API écrit ici : jamais l'app web, jamais le worker.", `export const payments = pgTable("payments", {`, "  id: id(),"]);
    assert.equal((await fetch(`${base}/api/source?path=package.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/source?path=../../package.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/source?path=.env`)).status, 403);
    assert.equal((await fetch(`${base}/api/source`)).status, 400);
  });
});

test("web : un passage masque ce qui ressemble à un secret, pas une lecture de variable", () => {
  assert.equal(redactSecrets(`  STRIPE_SECRET_KEY: "sk_live_123"`), `  STRIPE_SECRET_KEY: <valeur masquée>`);
  assert.equal(redactSecrets(`const url = "postgres://app:pw@db:5432/app";`), `const url = "postgres://***@db:5432/app";`);
  assert.equal(redactSecrets(`const API_KEY = process.env.API_KEY;`), `const API_KEY = process.env.API_KEY;`);
});

test("web : GET /api/stack donne les technologies lues, et le code de leurs lignes", async () => {
  await withServer(undefined, async (base) => {
    const before = await fetch(`${base}/api/source?path=package.json&from=29&to=29`);
    assert.equal(before.status, 404, "inventaire pas encore calculé : le manifeste n'est pas cité");
    const s = await (await fetch(`${base}/api/stack`)).json();
    const stripe = s.stack.technologies.find((t: { id: string }) => t.id === "stripe");
    assert.ok(stripe, "Stripe vient du manifeste");
    assert.equal(s.tech.stripe.name, "Stripe");
    assert.ok(s.tech.stripe.icon, "logo Simple Icons");
    assert.ok(s.tech.typescript, "les langages ont aussi leur étiquette");
    const map = await (await fetch(`${base}/api/map`)).json();
    assert.equal(s.builtAt, map.builtAt);
    const line = await (await fetch(`${base}/api/source?path=package.json&from=29&to=29`)).json();
    assert.match(line.lines[0], /"stripe"/);
  });
});

test("web : GET /api/deploy donne les workflows lus, que l'aperçu de code peut ouvrir", async () => {
  await withServer(undefined, async (base) => {
    const d = await (await fetch(`${base}/api/deploy`)).json();
    const ci = d.deploy.pipelines.find((p: { path: string }) => p.path === ".github/workflows/ci.yml");
    assert.deepEqual(ci.triggers.map((t: { label: string }) => t.label), ["pull_request", "push (main)"]);
    assert.ok(ci.jobs[0].steps.some((s: { kind: string }) => s.kind === "check"));
    const line = await (await fetch(`${base}/api/source?path=.github/workflows/ci.yml&from=1&to=1`)).json();
    assert.equal(line.lines[0], "name: ci");
  });
});

test("web : GET /api/knowledge donne les notes déclarées et les points d'entrée sans feature", async () => {
  await withServer(undefined, async (base) => {
    const k = await (await fetch(`${base}/api/knowledge`)).json();
    assert.deepEqual(k.report.concepts, []);
    assert.ok(k.report.entriesWithoutFeature.includes("POST /bookings"));
    assert.deepEqual(k.sinceStart, []);
  });
});
