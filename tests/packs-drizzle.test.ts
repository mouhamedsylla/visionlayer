import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/drizzle.md (S = schéma, Q = requête). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n` };
const access = (m: ArchModelV2) => m.edges.filter((e) => e.kind === "read" || e.kind === "write").map((e) => `${e.kind} ${e.to} ${e.target?.entity}`).sort();
const entities = (m: ArchModelV2, tech: string) => (m.nodes.find((n) => n.tech?.[0] === tech && n.facets.data)?.facets.data?.entities ?? []).map((e) => e.name).sort();

test("drizzle S1 S4 Q1 Q2 Q3 Q4 Q5 Q6 : tables, schéma réparti, lectures, écritures, transaction, module", async () => {
  const m = await mapOf({ ...SERVER,
    "schema/users.ts": `import { pgTable, text } from "drizzle-orm/pg-core";\nexport const users = pgTable("users", { id: text("id") });\n`,
    "schema/orders.ts": `import { pgTable, text } from "drizzle-orm/pg-core";\nexport const orders = pgTable("orders", { id: text("id") });\nexport const items = pgTable("order_items", { id: text("id") });\n`,
    "schema/index.ts": `export * from "./users";\nexport * from "./orders";\n`,
    "server.ts": [
      `import { drizzle } from "drizzle-orm/node-postgres";`,
      `import { users, orders } from "./schema";`,
      `import * as schema from "./schema";`,
      `const db = drizzle(process.env.DATABASE_URL!);`,
      `export const list = () => db.select({ id: users.id }).from(users).leftJoin(orders, undefined as never);`,
      `export const add = () => db.transaction(async (tx) => { await tx.insert(orders).values({ id: "1" }); await tx.update(users).set({ id: "2" }); });`,
      `export const drop = () => db.delete(schema.items);`,
      `export const read = () => db.select().from(schema.items).crossJoin(users);`,
      `const cache = new Map(); cache.delete("users"); Array.from(cache);`,
    ].join("\n"),
  });
  assert.deepEqual(access(m), [
    "read postgresql order_items", "read postgresql orders", "read postgresql users",
    "write postgresql order_items", "write postgresql orders", "write postgresql users",
  ]);
  assert.deepEqual(entities(m, "postgresql"), ["order_items", "orders", "users"]);
});

test("drizzle S2 S3 S5 : schéma nommé, créateur de tables, vue", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": [
      `import { pgSchema, pgTableCreator, pgView, text } from "drizzle-orm/pg-core";`,
      `const app = pgSchema("app");`,
      `export const accounts = app.table("accounts", { id: text("id") });`,
      `const shopTable = pgTableCreator((name) => \`shop_\${name}\`);`,
      `export const products = shopTable("products", { id: text("id") });`,
      `export const active = pgView("active_accounts").as((qb) => qb.select().from(accounts));`,
    ].join("\n"),
    "server.ts": [
      `import { drizzle } from "drizzle-orm/node-postgres";`,
      `import { accounts, products, active } from "./schema";`,
      `const db = drizzle("");`,
      `export const a = () => db.select().from(active);`,
      `export const b = () => db.insert(products).values({ id: "1" });`,
    ].join("\n"),
  });
  assert.deepEqual(entities(m, "postgresql"), ["active_accounts", "app.accounts", "shop_products"]);
  // La requête qui définit la vue n'est pas une lecture de app.accounts.
  assert.deepEqual(access(m), ["read postgresql active_accounts", "write postgresql shop_products"]);
});

test("drizzle Q7 Q8 Q9 Q10 : compter, API relationnelle, SQL brut", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": [
      `import { sqliteTable, text } from "drizzle-orm/sqlite-core";`,
      `export const notes = sqliteTable("notes", { id: text("id") });`,
      `export const tags = sqliteTable("tags", { id: text("id") });`,
      `export const slots = sqliteTable("slots", { id: text("id") });`,
      `export const audit = sqliteTable("audit_log", { id: text("id") });`,
    ].join("\n"),
    "server.ts": [
      `import { drizzle } from "drizzle-orm/better-sqlite3";`,
      `import { sql, eq } from "drizzle-orm";`,
      `import * as schema from "./schema";`,
      `import { notes, slots } from "./schema";`,
      `const db = drizzle("", { schema });`,
      `export const n = () => db.$count(notes);`,
      `export const t = () => db.query.tags.findMany();`,
      "export const s = (id: string) => db.run(sql`SELECT id FROM slots WHERE id = ${id} FOR UPDATE`);",
      "export const w = () => db.run(sql`INSERT INTO audit_log (id) VALUES ('x')`);",
      "export const v = () => db.run(sql`DELETE FROM ${notes} WHERE 1 = 1`);",
      "export const c = () => db.select().from(slots).where(sql`id = 'a'`);",
    ].join("\n"),
  });
  assert.deepEqual(access(m), [
    "read sqlite notes", "read sqlite slots", "read sqlite tags",
    "write sqlite audit_log", "write sqlite notes",
  ]);
});

test("drizzle E1 à E6 : valeurs permises, et celles que rien n'écrit (constat unused_value)", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
    "schema.ts": [
      `import { pgTable, pgEnum, text } from "drizzle-orm/pg-core";`,
      `export const STATUS = ["pending", "paid", "on_hold"] as const;`,
      `export const tier = pgEnum("tier", ["free", "pro", "team"]);`,
      `export const orders = pgTable("orders", {`,
      `  status: text("status", { enum: STATUS }).notNull().default("pending"),`,
      `  tier: tier("tier"),`,
      `  channel: text("channel", { enum: ["web", "phone"] }),`,
      `});`,
      `export const logs = pgTable("logs", (t) => ({ level: t.text("level", { enum: ["info", "error"] }) }));`,
    ].join("\n"),
    "main.ts": [
      `import { sql } from "drizzle-orm";`,
      `import { orders, logs } from "./schema";`,
      `declare const db: any; declare const next: string; declare const patch: object;`,
      `export const a = () => db.update(orders).set({ status: "paid" });`,
      `export const b = () => db.insert(orders).values([{ tier: "free" }]);`,
      "export const c = () => db.execute(sql`UPDATE orders SET tier = 'pro'`);",
      `export const d = () => db.update(orders).set({ channel: next });`,
      `export const e = () => db.insert(logs).values(patch);`,
    ].join("\n"),
  });
  const unused = m.findings.filter((f) => f.code === "unused_value").map((f) => `${f.proof[0]!.path}:${f.proof[0]!.line} ${f.message}`).sort();
  assert.deepEqual(unused, [
    "schema.ts:2 orders.status accepte « on_hold », que rien n'écrit",
    "schema.ts:3 orders.tier accepte « team », que rien n'écrit",
  ]);
});

const entity = (m: ArchModelV2, name: string) => m.nodes.flatMap((n) => n.facets.data?.entities ?? []).find((e) => e.name === name)!;
const cons = (m: ArchModelV2, name: string) => (entity(m, name).constraints ?? [])
  .map((c) => `${c.kind}${c.name ? ` ${c.name}` : ""} (${c.fields.join(", ")})${c.where ? ` où ${c.where}` : ""}${c.references ? ` → ${c.references}` : ""} :${c.proof.line}`).sort();

test("drizzle C1 à C8 : colonnes, clé primaire, unicité, clé étrangère, index partiel, check", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": [
      `import { sql } from "drizzle-orm";`,
      `import { check, foreignKey, index, integer, pgTable, primaryKey, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";`,
      `const id = () => uuid("id").primaryKey();`,
      `export const users = pgTable("users", {`,
      `  id: id(),`,
      `  email: text("email").notNull().unique(),`,
      `  nick: text().unique("users_nick"),`,
      `});`,
      `export const orders = pgTable("orders", {`,
      `  id: id(),`,
      `  userId: uuid("user_id").references(() => users.id).notNull(),`,
      `  status: text("status", { enum: ["open", "paid"] }).notNull(),`,
      `  qty: integer("qty"),`,
      `}, (t) => [`,
      "  uniqueIndex(\"orders_one_open\").on(t.userId).where(sql`status = 'open'`),",
      `  index("orders_status").on(t.status, t.qty),`,
      "  check(\"qty_positive\", sql`${t.qty} > 0`),",
      `]);`,
      `export const tags = pgTable("tags", { orderId: uuid("order_id"), label: text("label") }, (t) => ({`,
      `  pk: primaryKey({ columns: [t.orderId, t.label] }),`,
      `  fk: foreignKey({ columns: [t.orderId], foreignColumns: [orders.id] }),`,
      `  one: unique("tags_label").on(t.label),`,
      `}));`,
    ].join("\n"),
  });
  assert.deepEqual((entity(m, "orders").fields ?? []).map((f) => `${f.name} ${f.type}${f.nullable ? "" : " !"}${f.values ? ` [${f.values.join(" ")}]` : ""}`), [
    "id uuid !", "user_id uuid !", "status text ! [open paid]", "qty integer",
  ]);
  assert.deepEqual(cons(m, "users"), ["primary (id) :5", "unique (email) :6", "unique users_nick (nick) :7"]);
  assert.deepEqual(cons(m, "orders"), [
    "check qty_positive () où t.qty > 0 :17",
    "foreign (user_id) → users :11",
    "index orders_status (status, qty) :16",
    "primary (id) :10",
    "unique orders_one_open (user_id) où status = 'open' :15",
  ]);
  assert.deepEqual(cons(m, "tags"), ["foreign (order_id) → orders :21", "primary (order_id, label) :20", "unique tags_label (label) :22"]);
});

test("drizzle W1 à W4 : valeur par défaut, écriture littérale, écriture calculée, section du schéma", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": [
      `import { pgTable, text } from "drizzle-orm/pg-core";`,
      `// ── Commandes ─────────────────────`,
      `export const orders = pgTable("orders", {`,
      `  id: text("id"),`,
      `  status: text("status", { enum: ["open", "paid"] }).notNull().default("open"),`,
      `  paidAt: text("paid_at"),`,
      `});`,
    ].join("\n"),
    "server.ts": [
      `import { drizzle } from "drizzle-orm/node-postgres";`,
      `import { orders } from "./schema";`,
      `const db = drizzle(process.env.DATABASE_URL!);`,
      `export async function open(id: string) { await db.insert(orders).values({ id }); }`,
      `export async function pay(id: string, at: string) {`,
      `  await db.update(orders).set({ status: "paid", paidAt: at });`,
      `}`,
    ].join("\n"),
  });
  const e = entity(m, "orders");
  assert.equal(e.group, "Commandes");
  const field = (n: string) => e.fields!.find((f) => f.name === n)!;
  assert.equal(field("status").default, "open");
  assert.deepEqual(field("status").writes?.map((w) => `${w.value} ${w.fn} :${w.proof.line}`), ["paid pay :6"]);
  assert.deepEqual(field("paid_at").writes?.map((w) => `${w.value ?? "calculée"} ${w.fn}`), ["calculée pay"]);
  assert.deepEqual(field("id").writes?.map((w) => `${w.value ?? "calculée"} ${w.fn} :${w.proof.line}`), ["calculée open :4"]);
});

test("drizzle R1 à R5 : les colonnes que rend une lecture", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": [
      `import { pgTable, text } from "drizzle-orm/pg-core";`,
      `export const users = pgTable("users", { id: text("id"), email: text("email"), phone: text("phone") });`,
      `export const sessions = pgTable("sessions", { id: text("id"), userId: text("user_id") });`,
    ].join("\n"),
    "server.ts": [
      `import { drizzle } from "drizzle-orm/node-postgres";`,
      `import { eq } from "drizzle-orm";`,
      `import { users, sessions } from "./schema";`,
      `const db = drizzle(process.env.DATABASE_URL!);`,
      `export const r1 = () => db.select({ email: users.email, phone: users.phone }).from(users);`,
      `export const r2 = () => db.select().from(users);`,
      `export const r3 = () => db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId));`,
      `export const r4 = () => db.select({ sid: sessions.id, email: users.email }).from(sessions).innerJoin(users, eq(users.id, sessions.userId));`,
      `export const r5 = (id: string) => db.select({ uid: sessions.userId }).from(sessions).where(eq(sessions.id, id));`,
    ].join("\n"),
  });
  const fields = m.nodes.flatMap((n) => n.facets.data?.entities ?? []).flatMap((t) => (t.fields ?? []).map((f) => ({ t: t.name, f })));
  const reads = (t: string, f: string) => (fields.find((x) => x.t === t && x.f.name === f)?.f.reads ?? []).map((r) => `${r.proof.line}${r.whole ? "*" : ""}`).sort();
  assert.deepEqual(reads("users", "phone"), ["5", "6*", "7*"]);
  assert.deepEqual(reads("users", "email"), ["5", "6*", "7*", "8"]);
  assert.deepEqual(reads("users", "id"), ["6*", "7*"]);
  assert.deepEqual(reads("sessions", "id"), ["8"]);
  // R5 : sessions.id n'est que dans la condition de r5 ; seul user_id est rendu.
  assert.deepEqual(reads("sessions", "user_id"), ["9"]);
});

test("drizzle C10 C11 : ce que l'auteur dit d'une table, d'une colonne, d'une contrainte ; ce que fait une suppression", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": [
      `import { pgTable, text, uuid, uniqueIndex } from "drizzle-orm/pg-core";`,
      `// ── Comptes ──────────────`,
      ``,
      `export const users = pgTable("users", { id: uuid("id").primaryKey() });`,
      ``,
      `// Seule l'API écrit ici.`,
      `export const orders = pgTable("orders", {`,
      `  id: uuid("id").primaryKey(),`,
      `  /** le client qui commande */`,
      `  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),`,
      `  note: text("note"), // libre, jamais lue`,
      `  ref: text("ref"),`,
      `}, (t) => [`,
      `  // une commande par référence et par client`,
      `  uniqueIndex("one").on(t.ref, t.userId),`,
      `]);`,
    ].join("\n"),
  });
  const o = entity(m, "orders");
  assert.equal(o.comment, "Seule l'API écrit ici.");
  assert.equal(entity(m, "users").comment, undefined);
  const f = Object.fromEntries((o.fields ?? []).map((x) => [x.name, x.comment]));
  assert.deepEqual(f, { id: undefined, user_id: "le client qui commande", note: "libre, jamais lue", ref: undefined });
  const fk = o.constraints?.find((c) => c.kind === "foreign");
  assert.equal(fk?.onDelete, "Cascade");
  assert.equal(o.constraints?.find((c) => c.kind === "unique")?.comment, "une commande par référence et par client");
});

test("drizzle Q12 : une suppression de lignes", async () => {
  const m = await mapOf({ ...SERVER,
    "schema.ts": `import { pgTable, text } from "drizzle-orm/pg-core";\nexport const users = pgTable("users", { id: text("id") });\nexport const orders = pgTable("orders", { id: text("id") });\n`,
    "server.ts": [
      `import { drizzle } from "drizzle-orm/node-postgres";`,
      `import { eq } from "drizzle-orm";`,
      `import * as s from "./schema";`,
      `import { orders } from "./schema";`,
      `const db = drizzle(process.env.DATABASE_URL!);`,
      `export const forget = (id: string) => db.delete(s.users).where(eq(s.users.id, id));`,
      `export const purge = () => db.delete(orders);`,
      `export const keep = () => db.update(orders).set({ id: "x" });`,
    ].join("\n"),
  });
  assert.deepEqual(entity(m, "users").deletes?.map((d) => `${d.fn}:${d.proof.line}`), ["forget:6"]);
  assert.deepEqual(entity(m, "orders").deletes?.map((d) => `${d.fn}:${d.proof.line}`), ["purge:7"]);
});
