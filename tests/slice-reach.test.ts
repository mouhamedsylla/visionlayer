import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MapSource } from "../vision/web/map-source.js";
import { MapIndex } from "../vision/slice/index.js";
import { buildReach, changedLines, formatReach } from "../vision/slice/reach.js";

/** Une copie d'atelier-api sous git, puis la modification qu'un agent ferait pour rendre le téléphone obligatoire. */
function editedCopy() {
  const root = mkdtempSync(join(tmpdir(), "vision-reach-"));
  cpSync(join(import.meta.dirname, "corpus", "atelier-api"), root, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
  const edit = (path: string, from: string, to: string) => {
    const text = readFileSync(join(root, path), "utf8");
    assert.ok(text.includes(from), `${path} ne contient plus « ${from} »`);
    writeFileSync(join(root, path), text.replace(from, to));
  };
  edit("src/auth/signup.ts", "phone: z.string().optional(),", "phone: z.string().min(1),");
  edit("src/db/schema.ts", 'phone: text("phone"),', 'phone: text("phone").notNull(),');
  writeFileSync(join(root, "drizzle", "0002_phone.sql"), "ALTER TABLE users ALTER COLUMN phone SET NOT NULL;\n");
  return root;
}

test("portée : une modification hors fonction et un champ rendent la route, ses lecteurs et leurs constats", async () => {
  const root = editedCopy();
  try {
    const index = new MapIndex((await new MapSource(root).get()).model);
    const reach = buildReach(index, changedLines(root));
    const text = formatReach(reach);
    assert.ok(reach.handles.includes("POST /auth/signup"), text);
    assert.ok(reach.handles.includes("postgres/users"), text);
    assert.ok(text.includes("champ users.phone"), text);
    assert.ok(text.includes("drizzle/0002_phone.sql"), text);
    // Le corps de l'inscription, téléphone compris, part dans le journal ; l'export renvoie les utilisateurs à toute personne connectée.
    assert.ok(text.includes("personal_data_logged"), text);
    assert.ok(text.includes("unguarded_route"), text);
    // Le champ role n'est pas touché : son constat ne concerne pas cette modification.
    assert.ok(!text.includes("unused_value"), text);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("portée : sans modification, elle le dit", () => {
  assert.match(formatReach({ touched: [], handles: [], slice: { items: [], unknown: [] } }), /Aucune ligne changée/);
});
