import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2, ArchNode } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/**
 * La portée des points d'entrée au niveau des fonctions, et les composants
 * calculés depuis ce qui s'exécute. De petits dépôts écrits sur place, une
 * forme chacun : jamais un projet.
 */

const comps = (m: ArchModelV2, parent: string) => m.nodes.filter((n) => n.parent === parent && n.facets.component);
const comp = (m: ArchModelV2, parent: string, name: string): ArchNode => {
  const c = comps(m, parent).find((n) => n.name === name);
  assert.ok(c, `${name} absent : ${comps(m, parent).map((n) => n.name).join(", ")}`);
  return c;
};
const shape = (c: ArchNode) => `${c.name} ${c.facets.component!.reach} ${c.files!.length}f ${c.facets.component!.entrypoints.length}e`;
const keys = (c: ArchNode) => c.facets.component!.entrypoints.map((id) => id.split(":").slice(2).join(":")).sort();
const touches = (c: ArchNode) => c.facets.component!.touches.map((t) => `${t.kind} ${t.entity ?? t.topic ?? t.node}`).sort();
const calls = (m: ArchModelV2, parent: string) => {
  const ids = new Map(comps(m, parent).map((n) => [n.id, n.name]));
  return m.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => `${ids.get(e.from)} > ${ids.get(e.to)} ×${e.count}`).sort();
};

const API = {
  Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "src/server.ts"]\n`,
  "src/server.ts": [
    `import express from "express";`,
    `import { listItems } from "./items/list";`,
    `import { createItem } from "./items/create";`,
    `import { createOrder } from "./orders/create";`,
    `import { getOrder } from "./orders/get";`,
    `import { health } from "./health";`,
    `const app = express();`,
    `app.get("/items", listItems);`,
    `app.post("/items", createItem);`,
    `app.post("/orders", createOrder);`,
    `app.get("/orders/:id", getOrder);`,
    `app.get("/health", health);`,
    `app.listen(3000);`,
  ].join("\n"),
  "src/db.ts": `import pg from "pg";\nconst { Pool } = pg;\nexport const pool = new Pool();\n`,
  "src/session.ts": [
    `import { pool } from "./db";`,
    `export async function requireUser(req) {`,
    `  const r = await pool.query("SELECT * FROM sessions WHERE id = $1", [req.cookies.sid]);`,
    `  if (!r.rows.length) throw new HttpError(401, "unauthenticated");`,
    `  return r.rows[0];`,
    `}`,
    `export async function openSession(userId) {`,
    `  await pool.query("INSERT INTO sessions (user_id) VALUES ($1)", [userId]);`,
    `}`,
  ].join("\n"),
  "src/items/list.ts": [
    `import { pool } from "../db";`,
    `export async function listItems(req, res) {`,
    `  const r = await pool.query("SELECT * FROM items");`,
    `  res.json(r.rows);`,
    `}`,
  ].join("\n"),
  "src/items/create.ts": [
    `import { pool } from "../db";`,
    `import { requireUser } from "../session";`,
    `export async function createItem(req, res) {`,
    `  await requireUser(req);`,
    `  await pool.query("INSERT INTO items (name) VALUES ($1)", [req.body.name]);`,
    `  res.json({ ok: true });`,
    `}`,
  ].join("\n"),
  "src/orders/create.ts": [
    `import { pool } from "../db";`,
    `import { requireUser } from "../session";`,
    `import { price } from "./price";`,
    `export async function createOrder(req, res) {`,
    `  const user = await requireUser(req);`,
    `  const total = price(req.body.lines);`,
    `  await pool.query("INSERT INTO orders (user_id, total) VALUES ($1, $2)", [user.id, total]);`,
    `  res.json({ total });`,
    `}`,
  ].join("\n"),
  "src/orders/price.ts": `export function price(lines) {\n  return lines.reduce((n, l) => n + l.cents, 0);\n}\n`,
  "src/orders/get.ts": [
    `import { pool } from "../db";`,
    `import { requireUser } from "../session";`,
    `export async function getOrder(req, res) {`,
    `  await requireUser(req);`,
    `  const r = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);`,
    `  res.json(r.rows[0]);`,
    `}`,
  ].join("\n"),
  "src/health.ts": `import { pool } from "./db";\nexport async function health(req, res) {\n  await pool.query("SELECT 1");\n  res.json({ ok: true });\n}\n`,
};

test("modules d'une API : un par dossier ou fichier à la racine ; le socle, la session partagée, chaque fichier avec sa couche", async () => {
  const m = await mapOf(API);
  const api = m.nodes.find((n) => n.level === "deployable" && n.facets.entrypoints?.some((e) => e.key === "POST /orders"))!;
  assert.deepEqual(comps(m, api.id).map(shape).sort(), [
    "db base 1f 5e", "health own 1f 1e", "items own 2f 2e", "orders own 3f 2e", "session shared 1f 3e",
  ]);
  // Calculé, et il le dit ; le nom vient du dossier, ou du fichier posé à la racine.
  const session = comp(m, api.id, "session");
  assert.equal(session.status, "proposed");
  assert.equal(session.level, "component");
  assert.equal(session.facets.component!.grouping, "folder");
  assert.deepEqual(keys(session), ["GET /orders/:id", "POST /items", "POST /orders"]);
  // Le socle ne touche aucune donnée lui-même : chaque lecture est écrite chez son appelant ; il ouvre la connexion.
  assert.deepEqual(touches(comp(m, api.id, "db")), []);
  assert.deepEqual(comp(m, api.id, "db").facets.component!.layers, { "src/db.ts": "data" });
  assert.deepEqual(touches(session), ["read sessions", "write sessions"]);
  // Le dossier orders : ses routes et la fonction qu'elles seules appellent, chaque fichier avec sa couche.
  const orders = comp(m, api.id, "orders");
  assert.deepEqual(orders.files, ["src/orders/create.ts", "src/orders/get.ts", "src/orders/price.ts"]);
  assert.deepEqual(orders.facets.component!.layers, { "src/orders/create.ts": "entry", "src/orders/get.ts": "entry", "src/orders/price.ts": "logic" });
  assert.ok(calls(m, api.id).includes("session > db ×2"), calls(m, api.id).join(" ; "));
  assert.ok(calls(m, api.id).some((c) => c.startsWith("orders > session ")), calls(m, api.id).join(" ; "));
  // M4 : une route n'exécute de la session que ce qu'elle appelle.
  const order = api.facets.entrypoints!.find((e) => e.key === "POST /orders")!;
  assert.deepEqual(order.files, ["src/db.ts", "src/orders/create.ts", "src/orders/price.ts", "src/session.ts"]);
  const sessionWrites = m.edges.find((e) => e.kind === "write" && e.target?.entity === "sessions")!;
  assert.deepEqual(sessionWrites.occurrences.flatMap((o) => o.entrypoints ?? []), []);
});

const FUNCTIONS = {
  "firebase.json": JSON.stringify({ functions: [{ source: "functions", codebase: "default" }] }),
  "functions/package.json": JSON.stringify({ name: "functions", main: "lib/index.js" }),
  "functions/src/index.ts": [
    `import { onCall } from "firebase-functions/v2/https";`,
    `import { search } from "./search/engine";`,
    `import { render as draw } from "./media/render";`,
    `import { audit } from "./audit";`,
    `import { log } from "./log";`,
    `export const find = onCall(async (req) => {`,
    `  log("find");`,
    `  return search(req.data.q, 10);`,
    `});`,
    `export const suggest = onCall(async (req) => {`,
    `  log("suggest");`,
    `  return search(req.data.q, 3);`,
    `});`,
    `export const render = onCall(async (req) => {`,
    `  log("render");`,
    `  return draw(req.data);`,
    `});`,
    `export const ping = onCall(async () => {`,
    `  log("ping");`,
    `  return "ok";`,
    `});`,
    `export { audit };`,
  ].join("\n"),
  "functions/src/log.ts": `export function log(what) {\n  console.log(what);\n}\n`,
  "functions/src/audit.ts": `export function audit(what) {\n  return what.length;\n}\n`,
  "functions/src/search/engine.ts": [
    `import { rank } from "./rank";`,
    `import { tokenize } from "./tokens";`,
    `export function search(q, n) {`,
    `  return rank(tokenize(q)).slice(0, n);`,
    `}`,
  ].join("\n"),
  "functions/src/search/rank.ts": `import { tokenize } from "./tokens";\nexport function rank(words) {\n  return words.map((w) => tokenize(w));\n}\n`,
  "functions/src/search/tokens.ts": `export function tokenize(q) {\n  return String(q).split(" ");\n}\n`,
  "functions/src/media/render.ts": `import { encode } from "./encode";\nexport function render(data) {\n  return encode(data);\n}\n`,
  "functions/src/media/encode.ts": `export function encode(data) {\n  return JSON.stringify(data);\n}\n`,
};

test("portée au niveau des fonctions : un fichier importé par l'index mais jamais appelé n'est exécuté par personne", async () => {
  const m = await mapOf(FUNCTIONS);
  const fns = m.nodes.find((n) => n.id === "functions")!;
  const entry = (key: string) => fns.facets.entrypoints!.find((e) => e.key === key)!;
  // Avant : chaque fonction de l'index recevait tout ce que l'index importe.
  assert.deepEqual(entry("ping").files, ["functions/src/index.ts", "functions/src/log.ts"]);
  assert.deepEqual(entry("find").files, [
    "functions/src/index.ts", "functions/src/log.ts", "functions/src/search/engine.ts", "functions/src/search/rank.ts", "functions/src/search/tokens.ts",
  ]);
  assert.ok(fns.facets.entrypoints!.every((e) => !e.files?.includes("functions/src/audit.ts")));
  // Ses lignes dans son propre fichier : sa fonction seulement.
  assert.deepEqual(entry("ping").ranges, [[18, 21]]);
});

test("modules d'une codebase de fonctions : un dossier par sous-système, l'index et le journal au socle", async () => {
  const m = await mapOf(FUNCTIONS);
  assert.deepEqual(comps(m, "functions").map(shape).sort(), [
    "index base 1f 4e", "log base 1f 4e", "media own 2f 1e", "search shared 3f 2e",
  ]);
  assert.deepEqual(comp(m, "functions", "search").files, ["functions/src/search/engine.ts", "functions/src/search/rank.ts", "functions/src/search/tokens.ts"]);
  assert.equal(comp(m, "functions", "search").facets.component!.functions, 3);
  // Jamais exécuté : dans aucun module.
  assert.ok(comps(m, "functions").every((c) => !c.files!.includes("functions/src/audit.ts")));
  assert.deepEqual(calls(m, "functions"), ["index > log ×4", "index > media ×1", "index > search ×2"]);
});

test("modules : un dossier reste le module que l'équipe a rangé, même quand un de ses fichiers sert ailleurs", async () => {
  const m = await mapOf({
    ...FUNCTIONS,
    // media/encode.ts déménage dans search/ : rangé avec la recherche, appelé par le rendu.
    "functions/src/media/render.ts": `import { encode } from "../search/encode";\nexport function render(data) {\n  return encode(data);\n}\n`,
    "functions/src/media/encode.ts": "",
    "functions/src/search/encode.ts": `export function encode(data) {\n  return JSON.stringify(data);\n}\n`,
  });
  assert.deepEqual(comp(m, "functions", "search").files, ["functions/src/search/encode.ts", "functions/src/search/engine.ts", "functions/src/search/rank.ts", "functions/src/search/tokens.ts"]);
  assert.deepEqual(comp(m, "functions", "media").files, ["functions/src/media/render.ts"]);
  assert.ok(calls(m, "functions").includes("media > search ×1"), calls(m, "functions").join(" ; "));
});
