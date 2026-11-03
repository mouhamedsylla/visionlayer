import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPackText, loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";

/** Les faits qu'écrirait la capture d'un framework d'injection (planche L5), posés ici sans requête : seul compte ce que le cœur en fait. */
const CAPTURE = `id: capture-test
name: capture
languages: [typescript]
provides: [binds, receives]
rules: |
  binds("sql.module.ts", "UserRepository", "SqlUserRepository", 6) :- present("sql.module.ts").
  binds("doc.module.ts", "UserRepository", "DocUserRepository", 6) :- present("doc.module.ts").
  receives("users.service.ts", "UsersService", "UserRepository", 4) :- present("users.service.ts").
`;

test("contrat : une classe abstraite, ce qu'un conteneur y branche, qui la reçoit, et le choix au chargement", async () => {
  const root = mkdtempSync(join(tmpdir(), "vl-inject-"));
  try {
    const w = (f: string, s: string) => { mkdirSync(join(root, f, ".."), { recursive: true }); writeFileSync(join(root, f), s); };
    w("user.repository.ts", "export abstract class UserRepository {\n  abstract findById(id: string): Promise<unknown>;\n}\n");
    w("sql.repository.ts", 'import { UserRepository } from "./user.repository";\nexport class SqlUserRepository implements UserRepository {\n  async findById(id: string) { return id; }\n}\n');
    w("doc.repository.ts", 'import { UserRepository } from "./user.repository";\nexport class DocUserRepository implements UserRepository {\n  async findById(id: string) { return id; }\n}\n');
    w("sql.module.ts", 'import { UserRepository } from "./user.repository";\nimport { SqlUserRepository } from "./sql.repository";\nexport class SqlModule {}\nconst providers = [\n  {\n    provide: UserRepository, useClass: SqlUserRepository,\n  },\n];\n');
    w("doc.module.ts", 'import { UserRepository } from "./user.repository";\nimport { DocUserRepository } from "./doc.repository";\nexport class DocModule {}\nconst providers = [\n  {\n    provide: UserRepository, useClass: DocUserRepository,\n  },\n];\n');
    w("users.module.ts", 'import { SqlModule } from "./sql.module";\nimport { DocModule } from "./doc.module";\nimport { config } from "./config";\nconst persistence = config.isDocumentDatabase ? DocModule : SqlModule;\n');
    w("config.ts", "export const config = { isDocumentDatabase: process.env.DATABASE_TYPE === 'mongodb' };\n");
    w("users.service.ts", 'import { UserRepository } from "./user.repository";\nexport class UsersService {\n  constructor(\n    private readonly users: UserRepository,\n  ) {}\n}\n');
    const packs = [...(await loadPacks()), await loadPackText(CAPTURE, "capture-test.yaml")];
    const base = new FactBase(root, packs);
    base.refresh();
    const model = assemble(base.database(), { name: "inject", packs });
    const c = model.nodes.flatMap((n) => n.facets.contract ?? []).find((x) => x.name === "UserRepository")!;
    assert.ok(c, "la classe abstraite est un contrat");
    assert.deepEqual(c.operations.map((o) => o.name), ["findById"]);
    assert.deepEqual(c.implementations.map((i) => i.name).sort(), ["DocUserRepository", "SqlUserRepository"]);
    assert.deepEqual(c.bindings!.map((b) => `${b.implementation} ${b.proof.path}`).sort(), ["DocUserRepository doc.module.ts", "SqlUserRepository sql.module.ts"]);
    assert.deepEqual(c.consumers!.map((k) => k.name), ["UsersService"]);
    assert.equal(c.selector!.symbol.name, "persistence");
    assert.deepEqual(c.selector!.choices!.map((x) => `${x.when ?? "sinon"} ${x.implementation}`).sort(), ["isDocumentDatabase DocUserRepository", "sinon SqlUserRepository"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
