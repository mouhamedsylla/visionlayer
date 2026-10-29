import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import type { ArchModelV2, CodeFunction } from "../vision/arch/types.js";
import { MapSource } from "../vision/web/map-source.js";
import { mapOf } from "./pack-fixture.js";

const fns = (m: ArchModelV2): CodeFunction[] => m.nodes.flatMap((n) => n.facets.functions ?? []);
const named = (m: ArchModelV2, name: string) => fns(m).find((f) => f.name === name)!;

test("fonctions, sur un petit dépôt : ce que fait son code, qui l'appelle, ce qu'elle appelle", async () => {
  const m = await mapOf({
    "shop/Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "src/server.ts"]\n`,
    "shop/src/server.ts": [
      `import express from "express";`,
      `import { checkout } from "./orders";`,
      `const app = express();`,
      `app.post("/orders/:id/checkout", checkout);`,
      `app.listen(3000);`,
    ].join("\n"),
    "shop/src/orders.ts": [
      `import { price } from "./price";`,
      `export async function checkout(req, res) {`,
      `  const total = price(req.body.items);`,
      `  if (total <= 0) throw new HttpError(400, "empty");`,
      `  res.json({ total });`,
      `}`,
    ].join("\n"),
    "shop/src/price.ts": [
      `export function price(items) {`,
      `  if (!items.length) throw new HttpError(400, "no_items");`,
      `  return items.reduce((n, i) => n + i.cents, 0);`,
      `}`,
      `function quiet() { return 1; }`,
    ].join("\n"),
    "shop/src/price.test.ts": `import { price } from "./price";\nexport function t() { price([]); }\n`,
    "shop/src/admin.ts": [
      `import { price } from "./price";`,
      `export const reprice = withAuth({ role: "admin" }, async (req) => {`,
      `  return price(req.body.items);`,
      `});`,
    ].join("\n"),
  });
  const price = named(m, "price");
  assert.equal(price.id, "shop/src/price.ts:1");
  assert.equal(price.end, 4);
  assert.equal(price.exported, true);
  assert.deepEqual(price.flow?.map((s) => [s.kind, s.code]), [["refuse", "no_items"]]);
  // une fonction emballée dans un appel est lue sous le nom de sa constante : son appel compte
  assert.deepEqual(price.calledFrom?.map((c) => [`${c.proof.path}:${c.proof.line}`, c.fn]).sort(), [["shop/src/admin.ts:3", "reprice"], ["shop/src/orders.ts:3", "checkout"]]);
  assert.deepEqual(named(m, "checkout").calls?.map((c) => [c.name, c.local, c.to]), [["price", true, "shop/src/price.ts:1"]]);
  // muette et jamais appelée : rien à apprendre ; un fichier de test n'est pas lu comme du code du produit
  assert.equal(fns(m).find((f) => f.name === "quiet"), undefined);
  assert.equal(fns(m).find((f) => f.proof.path.endsWith(".test.ts")), undefined);
});

test("fonctions, sur atelier-api : une garde appelée partout, un appel nommé plusieurs fois compté une fois", async () => {
  const m = (await new MapSource(join(import.meta.dirname, "corpus", "atelier-api")).get()).model;
  const guard = named(m, "requireUser");
  assert.equal(guard.calledFrom?.length, 8);
  assert.ok(guard.flow?.some((s) => s.kind === "refuse"));
  const names = named(m, "toMessage").calls?.map((c) => c.name) ?? [];
  assert.equal(names.length, new Set(names).size);
  assert.deepEqual(named(m, "sendEmail").calls?.filter((c) => c.local).map((c) => c.name), ["getSender", "toMessage", "shouldRetry"]);
});

test("fonctions emballées : le point d'entrée déclaré au-dessus de sa fonction reçoit son déroulé, ses appels comptent", async () => {
  const m = await mapOf({
    "firebase.json": JSON.stringify({ functions: [{ source: "functions", codebase: "default" }] }),
    "functions/package.json": JSON.stringify({ name: "functions", main: "lib/index.js" }),
    "functions/src/index.ts": [
      `import { onCall, HttpsError } from "firebase-functions/v2/https";`,
      `import { requireAdmin } from "./guard";`,
      `export const grant = onCall(`,
      `  { region: "europe-west1" },`,
      `  async (req) => {`,
      `    await requireAdmin(req.auth?.uid);`,
      `    if (!req.data) throw new HttpsError("invalid-argument", "no_data");`,
      `  },`,
      `);`,
    ].join("\n"),
    "functions/src/guard.ts": `export async function requireAdmin(uid) {\n  if (!uid) throw new HttpsError("unauthenticated", "auth");\n}\n`,
  });
  const grant = m.nodes.flatMap((n) => n.facets.entrypoints ?? []).find((e) => e.key === "grant")!;
  assert.deepEqual(grant.flow?.map((s) => [s.kind, s.depth, s.code ?? s.name]), [["invoke", 0, "requireAdmin"], ["refuse", 1, "unauthenticated"], ["refuse", 0, "invalid-argument"]]);
  assert.deepEqual(named(m, "requireAdmin").calledFrom?.map((c) => c.fn), ["grant"]);
});

test("deux routes écrites dans une même fonction : aucune ne reçoit le déroulé de l'autre", async () => {
  const m = await mapOf({
    "svc/Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n`,
    "svc/server.ts": [
      `import { createServer } from "node:http";`,
      `import { render } from "./render";`,
      `const server = createServer((req, res) => {`,
      `  if (req.method === "GET" && req.url === "/healthz") return res.end("ok");`,
      `  if (req.method === "POST" && req.url === "/render") { render(req, res); return; }`,
      `  res.statusCode = 404; res.end();`,
      `});`,
      `server.listen(8080);`,
    ].join("\n"),
    "svc/render.ts": `export async function render(req, res) {\n  if (!req.headers.authorization) throw new HttpError(401, "no_token");\n  res.end();\n}\n`,
  });
  const routes = m.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind === "http");
  assert.deepEqual(routes.map((e) => e.key).sort(), ["GET /healthz", "POST /render"]);
  assert.deepEqual(routes.map((e) => e.flow?.length ?? 0), [0, 0]);
});
