import { test } from "node:test";
import assert from "node:assert/strict";
import { factsOf, mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/node-package.md (S = ce que lance un script). */
const code = "export const x = 1;\n";
/** Les fichiers présents que lance un script : `script → fichier`. */
async function launched(files: Record<string, string>, pkg = "package.json"): Promise<string[]> {
  const present = new Set(Object.keys(files));
  return (await factsOf(files, "pkg_script")).map((l) => l.split(" ")).filter(([k, , f]) => k === pkg && present.has(f!)).map(([, s, f]) => `${s} → ${f}`);
}

test("node-package S1 S2 : un fichier de code, derrière des préfixes d'environnement ; le compilé mène à sa source", async () => {
  assert.deepEqual(await launched({
    "package.json": JSON.stringify({ scripts: {
      a: "node dist/server.js",
      b: "cross-env NODE_ENV=production tsx src/worker.ts",
      c: "dotenv -- node --max-old-space-size=2048 src/jobs.ts",
      d: "node app/dist/index.js",
    } }),
    "src/server.ts": code, "src/worker.ts": code, "src/jobs.ts": code, "app/index.ts": code,
  }), ["a → src/server.ts", "b → src/worker.ts", "c → src/jobs.ts", "d → app/index.ts"]);
});

test("node-package S3 S4 : un script qui en appelle d'autres, seul, en chaîne ou en parallèle", async () => {
  assert.deepEqual(await launched({
    "package.json": JSON.stringify({ scripts: {
      api: "node src/api.ts", worker: "tsx src/worker.ts",
      n: "npm run api", m: "npm start", p: "pnpm worker", q: "pnpm run api", y: "yarn worker", b: "bun run api",
      chain: "npm run build && npm run api",
      both: 'concurrently --names a,b "pnpm api" "pnpm run worker"',
      rp: "run-p api worker",
      all: "npm-run-all --parallel api worker",
      start: "node src/api.ts",
      loop: "npm run loop",
    } }),
    "src/api.ts": code, "src/worker.ts": code,
  }), [
    "all → src/api.ts", "all → src/worker.ts", "api → src/api.ts", "b → src/api.ts",
    "both → src/api.ts", "both → src/worker.ts", "chain → src/api.ts", "m → src/api.ts", "n → src/api.ts",
    "p → src/worker.ts", "q → src/api.ts", "rp → src/api.ts", "rp → src/worker.ts", "start → src/api.ts",
    "worker → src/worker.ts", "y → src/worker.ts",
  ]);
});

test("node-package S5 S6 : le script d'un autre paquet, par son nom ou son dossier", async () => {
  const files = {
    "package.json": JSON.stringify({ scripts: {
      byName: "pnpm --filter @app/web start", short: "pnpm -F @app/web start", yarnWs: "yarn workspace @app/web start",
      npmWs: "npm run start -w @app/web", byDir: "pnpm --filter ./apps/web start", npmDir: "npm run start --workspace=apps/web",
    } }),
    "apps/web/package.json": JSON.stringify({ name: "@app/web", scripts: { start: "node dist/main.js" } }),
    "apps/web/src/main.ts": code,
  };
  assert.deepEqual(await launched(files), [
    "byDir → apps/web/src/main.ts", "byName → apps/web/src/main.ts", "npmDir → apps/web/src/main.ts",
    "npmWs → apps/web/src/main.ts", "short → apps/web/src/main.ts", "yarnWs → apps/web/src/main.ts",
  ]);
});

test("node-package S7 : plusieurs paquets à la fois, par motif de dossier ou de nom, -r, et les exclusions", async () => {
  const files = {
    "package.json": JSON.stringify({ scripts: {
      dirGlob: 'dotenv -- pnpm --filter "./packages/*" --parallel start',
      nameGlob: 'pnpm --filter "@oa/*" start',
      deep: 'pnpm --filter "./packages/**" start',
      braces: 'pnpm --filter "{./packages/*}" start',
      rec: "pnpm -r start",
      except: 'pnpm --filter "./packages/*" --filter "!./packages/enterprise" start',
      exceptName: 'pnpm --filter "!@oa/enterprise" start',
      two: 'pnpm --filter @oa/backend --filter "./apps/*" start',
      both: 'concurrently "pnpm --filter \'!./packages/enterprise\' -r start" "pnpm --filter ./packages/enterprise start"',
      graph: "pnpm --filter @oa/backend... start",
    } }),
    "packages/backend/package.json": JSON.stringify({ name: "@oa/backend", scripts: { start: "node dist/index.js" } }),
    "packages/backend/src/index.ts": code,
    "packages/enterprise/package.json": JSON.stringify({ name: "@oa/enterprise", scripts: { start: "node dist/ee.js" } }),
    "packages/enterprise/src/ee.ts": code,
    "apps/web/package.json": JSON.stringify({ name: "web", scripts: { start: "node dist/web.js" } }),
    "apps/web/src/web.ts": code,
  };
  const be = "packages/backend/src/index.ts", ee = "packages/enterprise/src/ee.ts", web = "apps/web/src/web.ts";
  const got = await launched(files);
  const want = [
    ...[be, ee].map((f) => `dirGlob → ${f}`), ...[be, ee].map((f) => `nameGlob → ${f}`), ...[be, ee].map((f) => `deep → ${f}`),
    ...[be, ee].map((f) => `braces → ${f}`), ...[be, ee, web].map((f) => `rec → ${f}`), `except → ${be}`, ...[be, web].map((f) => `exceptName → ${f}`),
    ...[be, web].map((f) => `two → ${f}`), ...[be, web, ee].map((f) => `both → ${f}`),
  ];
  assert.deepEqual(got.sort(), want.sort());
});

test("node-package : une image qui lance un script qui en lance d'autres a ses points d'entrée", async () => {
  const m = await mapOf({
    "apps/app/Dockerfile": `FROM node:22\nWORKDIR /app\nCOPY . .\nCMD ["pnpm", "docker-start"]\n`,
    "package.json": JSON.stringify({ scripts: { "docker-start": 'concurrently "pnpm start:workers" "pnpm start:app"', "start:workers": "node packages/back/dist/worker.js", "start:app": "node apps/app/dist/index.js" } }),
    "apps/app/src/index.ts": `import express from "express";\nconst app = express();\napp.get("/health", (_req, res) => res.send("ok"));\napp.listen(3000);\n`,
    "packages/back/src/worker.ts": code,
  });
  const entries = m.nodes.flatMap((n) => n.facets.entrypoints ?? []).map((e) => `${e.kind} ${e.key}`).sort();
  assert.ok(entries.includes("http GET /health"), entries.join(", "));
});

test("node-package P1 : un script de lancement déclare le programme ; un outil, non ; un manifeste du même fichier s'y fond", async () => {
  const pkg = JSON.stringify({ name: "shop", scripts: { dev: "tsx watch --env-file .env src/server.ts", test: "vitest run", seed: "tsx src/seed.ts", "db:migrate": "tsx src/migrate.ts" } });
  const files = { "package.json": pkg, "src/server.ts": "export {};\n", "src/seed.ts": "export {};\n", "src/migrate.ts": "export {};\n" };
  const alone = await mapOf(files);
  assert.deepEqual(alone.nodes.filter((n) => n.level === "deployable").map((n) => n.id), ["shop"]);
  const both = await mapOf({ ...files, Dockerfile: `FROM node:20\nCOPY . .\nCMD ["tsx", "src/server.ts"]\n` });
  const deployables = both.nodes.filter((n) => n.level === "deployable").map((n) => n.id);
  assert.equal(deployables.length, 1);
  assert.notEqual(deployables[0], "shop");
  const none = await mapOf({ "package.json": JSON.stringify({ name: "lib", main: "index.js", scripts: { test: "vitest" } }), "index.js": "export {};\n" });
  assert.deepEqual(none.nodes.filter((n) => n.level === "deployable").map((n) => n.id), []);
});
