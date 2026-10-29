import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Un cas par ligne de docs/fonctionnement/constats.md : ce qui déclenche, ce qui fait taire. */
const found = (m: ArchModelV2, code: string) => m.findings.filter((f) => f.code === code).map((f) => `${f.proof.map((p) => `${p.path}:${p.line}`).join(" ")} [${f.nodes?.join(",")}]`).sort();
const messages = (m: ArchModelV2, code: string) => m.findings.filter((f) => f.code === code).map((f) => f.message);

const API = (routes: string[]) => ({
  "api/Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
  "api/main.ts": [`import express from "express";`, `import Stripe from "stripe";`, `const stripe = new Stripe("k");`, `const app = express();`, `const h = (req: unknown, res: unknown) => {};`, ...routes].join("\n"),
});
const WEB = (code: string) => ({ "web/index.html": `<script type="module" src="./main.ts"></script>\n`, "web/main.ts": code });

test("uncalled_entry : une route qu'aucun code du dépôt n'appelle ; santé, webhook signé, service sans client dans le dépôt", async () => {
  const m = await mapOf({
    ...API([
      `app.get("/orders", h);`,
      `app.post("/orders/:id/cancel", h);`,
      `app.get("/healthz", h);`,
      `app.post("/webhooks/stripe", (req: any, res: any) => { stripe.webhooks.constructEvent(req.body, "s", "w"); });`,
    ]),
    ...WEB(`export const list = () => fetch("/orders");\n`),
  });
  assert.deepEqual(found(m, "uncalled_entry"), ["api/main.ts:7 [api]"]);
  assert.deepEqual(messages(m, "uncalled_entry"), ["« POST /orders/:id/cancel » : aucun code du dépôt n'appelle cette route"]);

  // Aucun client dans le dépôt : rien à comparer, aucun constat.
  const alone = await mapOf(API([`app.get("/orders", h);`, `app.post("/orders/:id/cancel", h);`]));
  assert.deepEqual(found(alone, "uncalled_entry"), []);
});

test("uncalled_entry : un appel du dépôt qui n'a pas pu être lu est dit dans le message, et compté non lu", async () => {
  const m = await mapOf({
    ...API([`app.get("/orders", h);`, `app.post("/orders/:id/cancel", h);`]),
    ...WEB(`export const list = () => fetch("/orders");\nconst target = process.env.TARGET!;\nexport const any = () => fetch(target);\nexport const ext = () => fetch("https://api.github.com/x");\n`),
  });
  assert.deepEqual(messages(m, "uncalled_entry"), ["« POST /orders/:id/cancel » : aucun code du dépôt n'appelle cette route, mais 1 appel HTTP du dépôt n'a pas pu être lu"]);
  const gaps = m.coverage.flatMap((c) => c.gaps).filter((g) => g.kind === "path_dynamic");
  assert.deepEqual(gaps.map((g) => `${g.count} ${g.proof?.path}:${g.proof?.line}`), ["1 web/main.ts:3"]);
});

test("scheduled_on_every_instance : des tâches planifiées sur un déployable à plusieurs instances", async () => {
  const files = (min: number) => ({
    "fly.toml": `app = "shop"\n[http_service]\n  internal_port = 3000\n  min_machines_running = ${min}\n`,
    Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
    "main.ts": `import cron from "node-cron";\ncron.schedule("0 3 * * *", () => {});\ncron.schedule("*/5 * * * *", () => {});\n`,
  });
  const two = await mapOf(files(2));
  assert.deepEqual(found(two, "scheduled_on_every_instance"), ["main.ts:2 main.ts:3 fly.toml:4 [shop]"]);
  assert.deepEqual(messages(two, "scheduled_on_every_instance"), ["les 2 tâches planifiées de shop démarrent sur chacune de ses 2 instances : chaque tâche s'exécute 2 fois"]);
  assert.deepEqual(found(await mapOf(files(1)), "scheduled_on_every_instance"), []);
});

test("missing_timeout : node-postgres sans délai ; ioredis qui rejoue sans limite ; ce qui le fait taire", async () => {
  const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n` };
  const m = await mapOf({ ...SERVER,
    "main.ts": [
      `import pg from "pg";`,
      `import IORedis from "ioredis";`,
      `import mysql from "mysql2";`,
      `const base = { max: 5 };`,
      `export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });`,
      `export const timed = new pg.Pool({ connectionString: "x", connectionTimeoutMillis: 5000 });`,
      `export const spread = new pg.Pool({ ...base });`,
      `export const fromEnv = new pg.Pool();`,
      `export const redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });`,
      `export const capped = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, commandTimeout: 2000 });`,
      `export const plain = new IORedis(process.env.REDIS_URL);`,
      `export const my = mysql.createPool({ uri: "x" });`,
    ].join("\n"),
  });
  assert.deepEqual(found(m, "missing_timeout"), ["main.ts:5 [image,postgresql]", "main.ts:9 [image,redis]"]);
});

test("dead_code : une fonction exportée que rien n'emploie ; import entier, test, fichier lancé, hors déployable", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
    "lib.ts": [
      `export function used() {}`,
      `export function unused() {}`,
      `export const unusedArrow = () => 1;`,
      `export function selfUsed() {}`,
      `export function caller() { return selfUsed(); }`,
      `export function testedOnly() {}`,
      `function local() {}`,
      `export { local };`,
    ].join("\n"),
    "ns.ts": `export function a() {}\nexport function b() {}\n`,
    "b.ts": `export function viaBarrel() {}\nexport function deadInB() {}\n`,
    "index.ts": `export * from "./b";\n`,
    "dyn.ts": `export function lazy() {}\n`,
    "lib.test.ts": `import { testedOnly } from "./lib";\ntestedOnly();\n`,
    "scripts/tool.ts": `export function orphan() {}\n`,
    "main.ts": [
      `import { used, caller } from "./lib";`,
      `import * as ns from "./ns";`,
      `import { viaBarrel } from "./index";`,
      `export function boot() { used(); caller(); ns.a(); viaBarrel(); return import("./dyn"); }`,
    ].join("\n"),
  });
  assert.deepEqual(found(m, "dead_code"), ["b.ts:2 [image]", "lib.ts:2 [image]", "lib.ts:3 [image]", "lib.ts:7 [image]"]);
  assert.deepEqual(messages(m, "dead_code").sort(), [
    "`deadInB` est exportée, mais aucun fichier du dépôt ne l'importe et son fichier ne l'emploie pas",
    "`local` est exportée, mais aucun fichier du dépôt ne l'importe et son fichier ne l'emploie pas",
    "`unusedArrow` est exportée, mais aucun fichier du dépôt ne l'importe et son fichier ne l'emploie pas",
    "`unused` est exportée, mais aucun fichier du dépôt ne l'importe et son fichier ne l'emploie pas",
  ]);
});

test("dead_code : un fichier que personne n'importe, rangé avec le code d'un déployable ; un script lancé par package.json", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "src/main.ts"]\n`,
    "package.json": `{ "scripts": { "seed": "tsx src/seed.ts" } }\n`,
    "src/main.ts": `export {};\n`,
    "src/import/csv.ts": `export async function importCsv(path: string) { return path; }\n`,
    "src/seed.ts": `export function seed() {}\n`,
    "src/vite.config.ts": `export function plugin() {}\n`,
    "docs/mockup.tsx": `export function Mock() { return null; }\n`,
  });
  assert.deepEqual(found(m, "dead_code"), ["src/import/csv.ts:1 []"]);
});

const FLOW = {
  Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
  "schema.ts": `import { pgTable, text } from "drizzle-orm/pg-core";\nexport const orders = pgTable("orders", { id: text("id"), status: text("status"), note: text("note") });\n`,
  "queue.ts": `import { Queue } from "bullmq";\nexport const mails = new Queue("mails");\n`,
  "db.ts": `import { drizzle } from "drizzle-orm/node-postgres";\nexport const db = drizzle("postgres://x");\n`,
};

test("write_then_enqueue : écrire puis publier hors transaction ; dans la transaction ; une transaction reçue en paramètre", async () => {
  const m = await mapOf({ ...FLOW,
    "main.ts": [
      `import { db } from "./db";`,
      `import { mails } from "./queue";`,
      `import { orders } from "./schema";`,
      `export async function afterTx() {`,
      `  const o = await db.transaction(async (tx) => {`,
      `    return tx.insert(orders).values({ id: "1" });`,
      `  });`,
      `  await mails.add("created", { o });`,
      `}`,
      `export async function plain() {`,
      `  await db.update(orders).set({ note: "x" });`,
      `  await mails.add("noted", {});`,
      `}`,
      `export async function insideTx() {`,
      `  await db.transaction(async (tx) => {`,
      `    await tx.insert(orders).values({ id: "2" });`,
      `    await mails.add("created", {});`,
      `  });`,
      `}`,
      `export async function given(tx: any) {`,
      `  await tx.update(orders).set({ note: "y" });`,
      `  await mails.add("noted", {});`,
      `}`,
      `export async function enqueueFirst() {`,
      `  await mails.add("first", {});`,
      `  await db.update(orders).set({ note: "z" });`,
      `}`,
    ].join("\n"),
  });
  assert.deepEqual(found(m, "write_then_enqueue").map((s) => s.split(" ").slice(0, 2).join(" ")), ["main.ts:12 main.ts:11", "main.ts:8 main.ts:6"]);
  assert.deepEqual(messages(m, "write_then_enqueue").sort(), [
    "la donnée est écrite dans une transaction, puis le message « mails » est publié après elle : si la publication échoue, l'écriture reste",
    "la donnée est écrite, puis le message « mails » est publié sans transaction commune : si la publication échoue, l'écriture reste",
  ]);
});

test("race_read_then_write : lire filtré, mettre à jour sans refiltrer, alors qu'un autre code écrit la colonne ; verrou", async () => {
  const m = await mapOf({ ...FLOW,
    "main.ts": [
      `import { and, eq } from "drizzle-orm";`,
      `import { db } from "./db";`,
      `import { orders } from "./schema";`,
      `export async function expire() {`,
      `  const rows = await db`,
      `    .select({ id: orders.id })`,
      `    .from(orders)`,
      `    .where(eq(orders.status, "pending"));`,
      `  for (const r of rows) await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, r.id));`,
      `}`,
      `export async function recheck() {`,
      `  const rows = await db.select().from(orders).where(eq(orders.status, "pending"));`,
      `  for (const r of rows) await db.update(orders).set({ status: "cancelled" }).where(and(eq(orders.id, r.id), eq(orders.status, "pending")));`,
      `}`,
      `export async function locked() {`,
      `  const rows = await db.select().from(orders).where(eq(orders.status, "pending")).for("update");`,
      `  for (const r of rows) await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, r.id));`,
      `}`,
      `export async function confirm(id: string) {`,
      `  await db.update(orders).set({ status: "confirmed" }).where(eq(orders.id, id));`,
      `}`,
    ].join("\n"),
  });
  assert.deepEqual(found(m, "race_read_then_write").map((s) => s.split(" [")[0]), ["main.ts:6 main.ts:9 main.ts:13 main.ts:17 main.ts:20"]);
  assert.deepEqual(messages(m, "race_read_then_write"), ["`expire` lit des lignes de orders filtrées sur `status`, puis les met à jour sans revérifier `status`, alors qu'un autre code écrit `status` entre-temps"]);
});
