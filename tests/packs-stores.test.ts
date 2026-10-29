import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/stores.md (I = image, D = connexion, Q = lecture et écriture). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n` };
const stores = (m: ArchModelV2) => m.nodes.filter((n) => n.role === "store" || n.role === "channel").map((n) => `${n.id} ${n.role} ${n.tech?.join(",")}`).sort();
const storeOf = (m: ArchModelV2, tech: string) => m.nodes.find((n) => (n.role === "store" || n.role === "channel") && n.tech?.[0] === tech);
const proofOf = (m: ArchModelV2, tech: string) => storeOf(m, tech)?.proof.map((p) => `${p.path}:${p.line}`);
const access = (m: ArchModelV2) => m.edges.filter((e) => e.kind === "read" || e.kind === "write").map((e) => `${e.kind} ${e.to} ${e.target?.entity}`).sort();
const entities = (m: ArchModelV2, tech: string) => storeOf(m, tech)?.facets.data?.entities.map((e) => `${e.name} ${e.proof?.path}:${e.proof?.line}`).sort();

test("stores I1 I2 I3 I4 : images officielles, autres noms, file de messages, image construite", async () => {
  const m = await mapOf({
    "compose.yaml": [
      "services:",
      "  db:",
      "    image: bitnami/postgresql:16",
      "  docs:",
      "    image: mongo:7",
      "  cache:",
      "    image: redis/redis-stack:latest",
      "  bus:",
      "    image: rabbitmq:3-management",
      "  search:",
      "    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0",
      "  custom:",
      "    build: ./db",
      "    image: mysql",
    ].join("\n"),
    "db/Dockerfile": `FROM mysql:8\n`,
  });
  assert.deepEqual(stores(m), [
    "bus channel rabbitmq",
    "cache store redis",
    "db store postgresql",
    "docs store mongodb",
    "search store elasticsearch",
  ]);
});

test("stores D1 D2 D3 D8 D9 : connexions SQL, connexion tirée, connexion importée", async () => {
  const m = await mapOf({ ...SERVER,
    "types.ts": `import type { Pool } from "pg";\nexport type P = Pool;\n`,
    "db.ts": [
      `import pg from "pg";`,
      `export const pool = new pg.Pool({ connectionString: "x" });`,
    ].join("\n"),
    "index.ts": `export * from "./db";\n`,
    "my.ts": [
      `import mysql from "mysql2/promise";`,
      `export const conn = mysql.createPool("mysql://x");`,
    ].join("\n"),
    "main.ts": [
      `import { pool } from "./index";`,
      `import "./types";`,
      `import { conn } from "./my";`,
      `import postgres from "postgres";`,
      `const sql = postgres("postgres://x");`,
      `export async function a() {`,
      `  const client = await pool.connect();`,
      `  await client.query("SELECT * FROM users WHERE id = $1", [1]);`,
      `  await pool.query({ text: "INSERT INTO audit_log (x) VALUES ($1)", values: [1] });`,
      "  await sql`SELECT * FROM orders o JOIN order_items i ON i.order_id = o.id`;",
      `  await sql.unsafe("DELETE FROM sessions");`,
      `  await conn.execute("UPDATE stock SET n = n - 1");`,
      `  await conn.query({ sql: "SELECT * FROM products" });`,
      `}`,
    ].join("\n"),
  });
  assert.deepEqual(stores(m), ["mysql store mysql", "postgresql store postgresql"]);
  // La preuve du stockage est la ligne qui ouvre la connexion.
  assert.deepEqual(proofOf(m, "mysql"), ["my.ts:2"]);
  // Deux connexions Postgres (node-postgres, Postgres.js) : la preuve est l'une d'elles.
  assert.ok(["db.ts:2", "main.ts:5"].includes(proofOf(m, "postgresql")?.[0] ?? ""));
  assert.deepEqual(access(m), [
    "read mysql products",
    "read postgresql order_items",
    "read postgresql orders",
    "read postgresql users",
    "write mysql stock",
    "write postgresql audit_log",
    "write postgresql sessions",
  ]);
});

test("stores D1 : importer seulement un type ne connecte à rien", async () => {
  const m = await mapOf({ ...SERVER, "main.ts": `import type { Pool } from "pg";\nimport { Client } from "pg";\nexport type P = Pool | Client;\n` });
  assert.deepEqual(stores(m), []);
});

test("stores D4 D5 D8 Q4 : MongoDB, Mongoose, collections", async () => {
  const m = await mapOf({ ...SERVER,
    "mongo.ts": [
      `import { MongoClient } from "mongodb";`,
      `const client = new MongoClient("mongodb://x");`,
      `export const db = client.db("app");`,
      `export const users = db.collection("users");`,
    ].join("\n"),
    "main.ts": [
      `import { db, users } from "./mongo";`,
      `import mongoose from "mongoose";`,
      `await mongoose.connect("mongodb://y");`,
      `export const a = () => users.findOne({ email: "x" });`,
      `export const b = () => db.collection("orders").insertOne({});`,
      `export const c = () => users.updateMany({}, { $set: { a: 1 } });`,
      `export const d = () => db.collection("orders").aggregate([]);`,
    ].join("\n"),
  });
  assert.deepEqual(stores(m), ["mongodb store mongodb"]);
  assert.deepEqual(access(m), ["read mongodb orders", "read mongodb users", "write mongodb orders", "write mongodb users"]);
  assert.deepEqual(entities(m, "mongodb"), ["orders main.ts:5", "users mongo.ts:4"]);
});

test("stores D6 D7 : ioredis sous n'importe quel nom, grappe, node-redis", async () => {
  const a = await mapOf({ ...SERVER, "main.ts": `import IORedis from "ioredis";\nexport const r = new IORedis("redis://x", { maxRetriesPerRequest: null });\n` });
  assert.deepEqual(proofOf(a, "redis"), ["main.ts:2"]);
  const b = await mapOf({ ...SERVER, "main.ts": `import Redis from "ioredis";\nexport const c = new Redis.Cluster([{ host: "a" }]);\n` });
  assert.deepEqual(stores(b), ["redis store redis"]);
  const c = await mapOf({ ...SERVER, "main.ts": `const { createClient } = require("redis");\nconst client = createClient({ url: "redis://x" });\nmodule.exports = client;\n` });
  assert.deepEqual(proofOf(c, "redis"), ["main.ts:2"]);
});

test("stores Q5 : une table déclarée par Drizzle garde sa déclaration comme preuve", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": `import { pgTable, text } from "drizzle-orm/pg-core";\nexport const users = pgTable("users", { id: text("id") });\n`,
    "main.ts": [
      `import { Pool } from "pg";`,
      `import "./schema";`,
      `const pool = new Pool();`,
      `export const a = () => pool.query("SELECT * FROM users");`,
      `export const b = () => pool.query("SELECT * FROM audit_log");`,
    ].join("\n"),
  });
  assert.deepEqual(entities(m, "postgresql"), ["audit_log main.ts:5", "users schema.ts:2"]);
});

test("stores D1 : le pool tiré du module, comme l'écrit la documentation de node-postgres en ESM", async () => {
  const m = await mapOf({ ...SERVER, "main.ts": `import pg from "pg";\nconst { Pool } = pg;\nexport const pool = new Pool();\nexport const a = () => pool.query("SELECT * FROM users");\n` });
  assert.deepEqual(proofOf(m, "postgresql"), ["main.ts:3"]);
  assert.deepEqual(access(m), ["read postgresql users"]);
});
