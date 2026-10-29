import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../src/db";

// Applique les fichiers de drizzle/ dans l'ordre. Pas de table de suivi : base de développement seulement.
const dir = join(import.meta.dirname, "..", "drizzle");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await pool.query(readFileSync(join(dir, file), "utf8"));
  console.log("appliqué", file);
}
await pool.end();
