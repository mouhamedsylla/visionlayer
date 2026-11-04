import { test } from "node:test";
import assert from "node:assert/strict";
import { mapOf } from "./pack-fixture.js";

const pkg = (name: string, start: string, deps = "{}") => `{ "name": "${name}", "scripts": { "start": "tsx ${start}" }, "dependencies": ${deps} }\n`;

test("un paquet partagé : une route écrite dans une fonction exportée n'est qu'aux programmes qui emploient cette fonction", async () => {
  const m = await mapOf({
    "package.json": `{ "name": "mono", "private": true, "workspaces": ["apps/*", "packages/*"] }\n`,
    "pnpm-workspace.yaml": `packages:\n  - apps/*\n  - packages/*\n`,
    "packages/sdk/package.json": `{ "name": "sdk", "main": "src/index.ts", "dependencies": { "express": "4" } }\n`,
    "packages/sdk/src/index.ts": `export { createServer } from "./server";\nexport { createWorker } from "./worker";\n`,
    "packages/sdk/src/server.ts": [`import express from "express";`, `export function createServer() {`, `  const app = express();`, `  app.post("/webhooks", (_q, r) => r.send("ok"));`, `  return app;`, `}`].join("\n"),
    "packages/sdk/src/worker.ts": `export function createWorker() { return { start() {} }; }\n`,
    "apps/server/package.json": pkg("server", "src/main.ts", `{ "sdk": "workspace:*" }`),
    "apps/server/src/main.ts": `import { createServer } from "sdk";\ncreateServer().listen(3000);\n`,
    "apps/worker/package.json": pkg("worker", "src/main.ts", `{ "sdk": "workspace:*" }`),
    "apps/worker/src/main.ts": `import { createWorker } from "sdk";\ncreateWorker().start();\n`,
  });
  const routes = (name: string) => (m.nodes.find((n) => n.name === name)?.facets.entrypoints ?? []).filter((e) => e.kind === "http").map((e) => e.key);
  assert.deepEqual(routes("server"), ["POST /webhooks"]);
  assert.deepEqual(routes("worker"), []);
});

test("un paquet d'exemple ne fait pas partie du système ; une page s'appelle comme son paquet", async () => {
  const m = await mapOf({
    "package.json": `{ "name": "ma-boutique", "scripts": { "build": "vite build" } }\n`,
    "index.html": `<html><body><script type="module" src="/src/main.ts"></script></body></html>\n`,
    "src/main.ts": `console.log(1);\n`,
    "examples/demo/package.json": pkg("demo", "main.ts"),
    "examples/demo/main.ts": `console.log(2);\n`,
  });
  assert.deepEqual(m.nodes.filter((n) => n.level === "deployable").map((n) => n.name), ["ma-boutique"]);
});

test("constats : une connexion ouverte dans un test n'est pas celle du système", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCMD ["node", "main.ts"]\n`, "main.ts": `console.log(1);\n`,
    "package.json": `{ "name": "x", "dependencies": { "ioredis": "5" } }\n`,
    "test/a.test.ts": `import IORedis from "ioredis";\nexport const c = new IORedis({ maxRetriesPerRequest: null });\n`,
  });
  assert.equal(m.findings.filter((f) => f.code === "missing_timeout").length, 0);
});

test("déroulé : une route écrite en ligne a son déroulé, enveloppée ou non", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCMD ["node", "main.ts"]\n`,
    "package.json": `{ "name": "x", "dependencies": { "express": "4" } }\n`,
    "main.ts": [
      `import express from "express";`,
      `import { wrap } from "./wrap";`,
      `const app = express();`,
      `app.get("/a", async (req, res) => {`,
      `  if (!req.query.q) { throw new HttpError(400, "bad"); }`,
      `  res.status(200).json({ ok: true });`,
      `});`,
      `app.post("/b", wrap(async (req, res) => {`,
      `  res.status(201).json({ ok: true });`,
      `}));`,
      `app.route("/c").get(async (req, res) => { res.status(204).end(); });`,
      `app.listen(3000);`,
    ].join("\n"),
    "wrap.ts": `export const wrap = (f: any) => f;\n`,
  });
  const flow = (k: string) => m.nodes.flatMap((n) => n.facets.entrypoints ?? []).find((e) => e.key === k)?.flow?.map((s) => `${s.kind} ${s.status ?? ""}`.trim());
  assert.deepEqual(flow("GET /a"), ["refuse 400", "reply 200"]);
  assert.deepEqual(flow("POST /b"), ["reply 201"]);
  assert.ok(flow("GET /c")?.includes("reply 204"), String(flow("GET /c")));
});

test("contrat d'une route : la chaîne dans l'ordre, sans les paquets, le schéma d'entrée, les réponses des intermédiaires", async () => {
  const m = await mapOf({
    Dockerfile: `FROM node:20\nCMD ["node", "main.ts"]\n`,
    "package.json": `{ "name": "x", "dependencies": { "express": "4", "zod": "3", "helmet": "7" } }\n`,
    "main.ts": [
      `import express from "express";`,
      `import helmet from "helmet";`,
      `import { z } from "zod";`,
      `import routes from "./routes";`,
      `import { csrf } from "./guards";`,
      `const app = express();`,
      `app.use(helmet());`,
      `app.use(csrf);`,
      `app.use("/api", routes);`,
      `app.listen(3000);`,
    ].join("\n"),
    "guards.ts": [
      `export function csrf(req, res, next) { if (!req.headers.x) return res.status(403).end(); next(); }`,
      `export function auth(req, res, next) { if (!req.user) return res.status(401).end(); next(); }`,
      `export function validate(s) { return (req, res, next) => { if (!s.safeParse(req.body).success) return res.status(400).end(); next(); }; }`,
    ].join("\n"),
    "routes.ts": [
      `import { Router } from "express";`,
      `import { z } from "zod";`,
      `import { auth, validate } from "./guards";`,
      `const r = Router();`,
      `const schema = z.object({ name: z.string().min(1), tags: z.array(z.string()).optional(), on: z.boolean().default(true) });`,
      `r.use(auth);`,
      `r.post("/items", validate(schema), async (req, res) => { res.status(201).json({}); });`,
      `r.patch("/items", validate(schema.partial()), async (req, res) => { res.json({}); });`,
      `r.put("/items", async (req, res) => { const b = schema.parse(req.body); res.json(b); });`,
      `export default r;`,
    ].join("\n"),
  });
  const e = (k: string) => m.nodes.flatMap((n) => n.facets.entrypoints ?? []).find((x) => x.key === k)!;
  const post = e("POST /api/items").contract!;
  assert.deepEqual(post.chain.map((c) => c.name), ["csrf", "auth", "validate"]);
  assert.deepEqual(post.chain.map((c) => c.statuses.map((s) => s.code).join()), ["403", "401", "400"]);
  assert.deepEqual(post.input?.fields.map((f) => `${f.name}|${f.type}|${f.required}`), ["name|string, min 1|true", "tags|string[]|false", "on|boolean, défaut true|false"]);
  assert.ok(e("PATCH /api/items").contract!.input!.fields.every((f) => !f.required), "partial : rien n'est requis");
  assert.equal(e("PUT /api/items").contract!.input?.schema, "schema", "schéma appliqué dans le handler");
});
