import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/better-auth.md. Le schéma est Prisma ; Better Auth écrit ses tables. */
const SCHEMA = [
  `datasource db {`, `  provider = "postgresql"`, `}`,
  `model User {`, `  id String @id`, `  name String`, `  email String @unique`, `  emailVerified Boolean @default(false)`, `  role String?`, `  phone String?`, `  banned Boolean?`, `}`,
  `model Session {`, `  id String @id`, `  token String @unique`, `  userId String`, `  expiresAt DateTime`, `}`,
  `model Verification {`, `  id String @id`, `  identifier String`, `  value String`, `}`,
  `model Order {`, `  id String @id`, `}`,
].join("\n");

const FILES = {
  "package.json": JSON.stringify({ name: "t", dependencies: { "better-auth": "1.2.0", next: "15.0.0", "@prisma/client": "6.0.0" } }),
  "prisma/schema.prisma": SCHEMA,
  "src/lib/auth.ts": [
    `import { betterAuth } from "better-auth";`,
    `import { admin } from "better-auth/plugins";`,
    `export const auth = betterAuth({`,
    `  plugins: [admin({ defaultRole: "CUSTOMER" })],`,
    `  user: { additionalFields: { phone: { type: "string", required: false } } },`,
    `});`,
  ].join("\n"),
  "src/app/api/auth/[...all]/route.ts": [
    `import { auth } from "@/lib/auth";`,
    `import { toNextJsHandler } from "better-auth/next-js";`,
    `export const { GET, POST } = toNextJsHandler(auth);`,
  ].join("\n"),
  "src/app/api/orders/route.ts": [
    `import { auth } from "@/lib/auth";`,
    `export async function GET(req: Request) {`,
    `  const session = await auth.api.getSession({ headers: req.headers });`,
    `  return Response.json(session);`,
    `}`,
  ].join("\n"),
  "tsconfig.json": JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
};

const entity = (m: Awaited<ReturnType<typeof mapOf>>, name: string) => m.nodes.flatMap((n) => n.facets.data?.entities ?? []).find((e) => e.name === name);

test("better-auth B1 à B6 : le gestionnaire monté écrit ses tables, getSession les lit", async () => {
  const m = await mapOf(FILES);
  const w = (e: string, f: string) => (entity(m, e)?.fields?.find((x) => x.name === f)?.writes ?? []).map((x) => `${x.value ?? "?"} ${x.proof.path}:${x.proof.line}`);
  const H = "src/app/api/auth/[...all]/route.ts:3";
  assert.deepEqual(w("user", "email"), [`? ${H}`]);
  assert.deepEqual(w("user", "role"), [`CUSTOMER ${H}`]);
  assert.deepEqual(w("user", "phone"), [`? ${H}`]);
  assert.deepEqual(w("user", "banned"), [`? ${H}`]);
  assert.deepEqual(w("session", "token"), [`? ${H}`]);
  assert.deepEqual(w("order", "id"), []);
  assert.deepEqual(entity(m, "session")?.deletes?.map((d) => `${d.proof.path}:${d.proof.line}`), [H]);
  assert.deepEqual(entity(m, "user")?.deletes?.map((d) => `${d.proof.path}:${d.proof.line}`), [H]);
  assert.equal(entity(m, "order")?.deletes, undefined);
  const r = (e: string) => (entity(m, e)?.fields?.find((x) => x.name === "id")?.reads ?? []).map((x) => `${x.whole ? "*" : ""}${x.proof.path}:${x.proof.line}`);
  assert.deepEqual(r("user"), ["*src/app/api/orders/route.ts:3"]);
  assert.deepEqual(r("verification"), []);
});
