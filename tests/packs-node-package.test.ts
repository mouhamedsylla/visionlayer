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

test("node-package S5 S6 S7 : le script d'un autre paquet, par son nom ou son dossier ; pas un motif", async () => {
  const files = {
    "package.json": JSON.stringify({ scripts: {
      byName: "pnpm --filter @app/web start", short: "pnpm -F @app/web start", yarnWs: "yarn workspace @app/web start",
      npmWs: "npm run start -w @app/web", byDir: "pnpm --filter ./apps/web start", npmDir: "npm run start --workspace=apps/web",
      glob: 'pnpm --filter "./apps/*" start',
    } }),
    "apps/web/package.json": JSON.stringify({ name: "@app/web", scripts: { start: "node dist/main.js" } }),
    "apps/web/src/main.ts": code,
  };
  assert.deepEqual(await launched(files), [
    "byDir → apps/web/src/main.ts", "byName → apps/web/src/main.ts", "npmDir → apps/web/src/main.ts",
    "npmWs → apps/web/src/main.ts", "short → apps/web/src/main.ts", "yarnWs → apps/web/src/main.ts",
  ]);
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
