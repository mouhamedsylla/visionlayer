import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";

/** Constat read_outside_tx : lire une table avant la transaction, puis l'écrire dedans. Montré ici avec Drizzle. */
const FILES = (lock: string) => ({
  Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n`,
  "server.ts": `import "./order";\n`,
  "schema.ts": `import { pgTable, text, integer } from "drizzle-orm/pg-core";\nexport const products = pgTable("products", { id: text("id"), stock: integer("stock") });\n`,
  "order.ts": [
    `import { db } from "./db";`, `import { eq } from "drizzle-orm";`,
    `import { products } from "./schema";`,
    `export async function place(id) {`,
    `  const [p] = await db.select().from(products).where(eq(products.id, id))${lock};`,
    `  if (p.stock < 1) throw new Error("stock");`,
    `  await db.transaction(async (tx) => {`,
    `    await tx.update(products).set({ stock: p.stock - 1 });`,
    `  });`,
    `}`,
  ].join("\n"),
});

test("read_outside_tx : lu avant la transaction, écrit dedans ; un verrou le fait taire", async () => {
  const m = await mapOf(FILES(""));
  const f = m.findings.filter((x) => x.code === "read_outside_tx");
  assert.deepEqual(f.map((x) => `${x.message} ${x.proof.map((p) => `${p.path}:${p.line}`).join(" ")}`),
    ["`place` lit products avant sa transaction, puis l'écrit dedans : ce qu'elle a décidé d'après cette lecture n'est pas protégé, une autre exécution peut la changer entre-temps order.ts:5 order.ts:8"]);
  const steps = m.nodes.flatMap((n) => n.facets.entrypoints ?? []).flatMap((e) => e.flow ?? []);
  assert.ok(steps.every((s) => (s.proof.line === 8) === !!s.tx));
  const locked = await mapOf(FILES(`.for("update")`));
  assert.equal(locked.findings.filter((x) => x.code === "read_outside_tx").length, 0);
});
