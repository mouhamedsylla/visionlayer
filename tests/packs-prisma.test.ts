import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/prisma.md (S = schéma, C = client). */
const SCHEMA = [
  `datasource db {`,
  `  provider = "postgresql"`,
  `  url      = env("DATABASE_URL")`,
  `}`,
  ``,
  `enum Status {`,
  `  PENDING`,
  `  PAID // payée`,
  `  CANCELED`,
  `}`,
  ``,
  `// ==========`,
  `// COMMANDES`,
  `// ==========`,
  ``,
  `model Order {`,
  `  id     String  @id @default(cuid())`,
  `  ref    String  @unique`,
  `  status Status  @default(PENDING)`,
  `  /// NULL = commande invitée`,
  `  userId String? @map("user_id")`,
  `  total  Int     @default(0) // en XOF`,
  `  tags   String[]`,
  `  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)`,
  `  items  OrderItem[]`,
  `  @@index([userId])`,
  `  @@map("orders")`,
  `}`,
  ``,
  `model OrderItem {`,
  `  orderId String`,
  `  sku     String`,
  `  order   Order @relation(fields: [orderId], references: [id], onDelete: Cascade)`,
  `  @@id([orderId, sku])`,
  `}`,
  ``,
  `model User {`,
  `  id String @id`,
  `}`,
].join("\n");

const BASE = {
  Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n`,
  "server.ts": `import "./orders";\n`,
  "prisma/schema.prisma": SCHEMA,
};

const entity = (m: Awaited<ReturnType<typeof mapOf>>, name: string) => m.nodes.flatMap((n) => n.facets.data?.entities ?? []).find((e) => e.name === name);

test("prisma-schema S1 à S8 : entités, champs, états, défauts, contraintes, relations, commentaires", async () => {
  const m = await mapOf(BASE);
  const store = m.nodes.find((n) => n.facets.data?.entities.some((e) => e.name === "order"));
  assert.equal(store?.tech[0], "postgresql");
  assert.equal(store?.facets.data?.shape, "relational");
  const order = entity(m, "order")!;
  assert.equal(order.proof?.path, "prisma/schema.prisma");
  assert.equal(order.proof?.line, 16);
  assert.equal(order.comment, "COMMANDES");
  assert.deepEqual(order.fields?.map((f) => `${f.name}:${f.type}${f.nullable ? "?" : ""}`), ["id:String", "ref:String", "status:Status", "userId:String?", "total:Int", "tags:String[]"]);
  const status = order.fields!.find((f) => f.name === "status")!;
  assert.deepEqual(status.values, ["PENDING", "PAID", "CANCELED"]);
  assert.equal(status.default, "PENDING");
  assert.equal(order.fields!.find((f) => f.name === "id")!.default, undefined);
  assert.equal(order.fields!.find((f) => f.name === "total")!.default, "0");
  assert.equal(order.fields!.find((f) => f.name === "userId")!.comment, "NULL = commande invitée");
  assert.equal(order.fields!.find((f) => f.name === "total")!.comment, "en XOF");
  assert.deepEqual(order.constraints?.map((c) => `${c.kind} ${c.fields.join(",")}${c.references ? ` → ${c.references}` : ""}${c.onDelete ? ` ${c.onDelete}` : ""}`).sort(),
    ["foreign userId → user SetNull", "index userId", "primary id", "unique ref"]);
  const item = entity(m, "orderItem")!;
  assert.deepEqual(item.constraints?.map((c) => `${c.kind} ${c.fields.join(",")}${c.onDelete ? ` ${c.onDelete}` : ""}`).sort(), ["foreign orderId Cascade", "primary orderId,sku"]);
});

test("prisma C1 à C5 : écritures de champ, valeurs calculées, plusieurs lignes, transactions", async () => {
  const m = await mapOf({ ...BASE,
    "orders.ts": [
      `import { prisma } from "./lib/prisma";`,
      `export async function place(items, status) {`,
      `  return prisma.$transaction(async (tx) => {`,
      `    const o = await tx.order.create({ data: { ref: "SN-1", status: "PENDING", total: 0 } });`,
      `    await tx.orderItem.createMany({ data: items.map((i) => ({ orderId: o.id, sku: i.sku })) });`,
      `    return o;`,
      `  });`,
      `}`,
      `export async function setStatus(id, status) {`,
      `  await prisma.order.update({ where: { id }, data: { status } });`,
      `  await prisma.order.updateMany({ data: { total: { increment: 1 } } });`,
      `  await prisma.$transaction([prisma.order.update({ where: { id }, data: { status: "CANCELED" } })]);`,
      `  await prisma.ghost.update({ data: { status: "X" } });`,
      `}`,
    ].join("\n"),
  });
  const writes = (e: string, f: string) => (entity(m, e)?.fields?.find((x) => x.name === f)?.writes ?? []).map((w) => `${w.value ?? "?"} ${w.fn ?? ""}:${w.proof.line}`);
  assert.deepEqual(writes("order", "status"), ["PENDING place:4", "? setStatus:10", "CANCELED setStatus:12"]);
  assert.deepEqual(writes("order", "total"), ["0 place:4", "? setStatus:11"]);
  assert.deepEqual(writes("orderItem", "sku"), ["? place:5"]);
  assert.equal(entity(m, "ghost"), undefined);
});
