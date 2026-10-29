import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/sql-migrations.md (T = déclencheur). */
const SCHEMA = {
  Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n`,
  "server.ts": `import { db } from "./schema";\n`,
  "schema.ts": [
    `import { pgTable, text } from "drizzle-orm/pg-core";`,
    `export const db = 1;`,
    `export const orders = pgTable("orders", { id: text("id") });`,
    `export const audit = pgTable("audit_log", { id: text("id") });`,
    `export const stock = pgTable("stock", { id: text("id") });`,
  ].join("\n"),
};

test("sql-migrations T1 T2 T3 : déclencheur, sa fonction, ce qu'elle écrit ; corps écrit sur place", async () => {
  const m = await mapOf({ ...SCHEMA,
    "drizzle/0001_audit.sql": [
      `-- Chaque changement de commande est copié. CREATE TRIGGER fake AFTER DELETE ON stock`,
      `CREATE OR REPLACE FUNCTION audit_orders() RETURNS trigger AS $$`,
      `BEGIN`,
      `  INSERT INTO audit_log (id) VALUES (NEW.id);`,
      `  RETURN NEW;`,
      `END;`,
      `$$ LANGUAGE plpgsql;`,
      ``,
      `CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION audit_orders();`,
      `CREATE TRIGGER stock_down AFTER INSERT ON orders FOR EACH ROW UPDATE stock SET n = n - 1;`,
    ].join("\n"),
  });
  const ents = m.nodes.flatMap((n) => n.facets.data?.entities ?? []);
  const triggers = (name: string) => (ents.find((e) => e.name === name)?.triggers ?? []).map((t) => `${t.name} ${t.on.join("+")} → ${(t.writes ?? []).join(",")} ${t.proof.path}:${t.proof.line}`);
  assert.deepEqual(triggers("orders"), [
    "audit_orders insert+update → audit_log drizzle/0001_audit.sql:9",
    "stock_down insert → stock drizzle/0001_audit.sql:10",
  ]);
  // Un déclencheur dans un commentaire n'existe pas.
  assert.deepEqual(triggers("stock"), []);
});
