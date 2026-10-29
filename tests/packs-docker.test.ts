import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { factsOf, mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/docker.md (D = ce qui est lancé, W = d'où il vient, N = le nom). */
const runs = (m: ArchModelV2) => m.nodes.filter((n) => n.level === "deployable").map((n) => `${n.id} ${n.facets.entrypoints?.find((e) => e.kind === "main")?.key}`).sort();
const JS = `export {};\n`;

test("docker D1 à D6, N1 : commandes, point d'entrée, script du paquet, code compilé, noms", async () => {
  const m = await mapOf({
    "a/Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY . .\nCMD tsx src/server.ts\n`, "a/src/server.ts": JS,
    "a/Dockerfile.worker": `FROM node:20\nWORKDIR /app\nCOPY . .\nCMD ["node", "worker.js"]\n`, "a/worker.js": JS,
    "b/Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY . .\nENTRYPOINT ["node"]\nCMD ["main.js"]\n`, "b/main.js": JS,
    "c/Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY package.json ./\nCOPY src ./src\nCMD ["pnpm", "start"]\n`,
    "c/package.json": `{ "scripts": { "start": "tsx src/index.ts" } }\n`, "c/src/index.ts": JS,
    "d/Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY . .\nRUN pnpm build\ncmd ["node", \\\n  "--enable-source-maps", \\\n  "dist/server.js"]\n`, "d/src/server.ts": JS,
    "e/Dockerfile": `FROM node:20 AS dev\nCOPY . .\nCMD ["node", "dev.js"]\nFROM node:20\nCOPY . .\nCMD ["node", "prod.js"]\n`, "e/dev.js": JS, "e/prod.js": JS,
    "jobs.Dockerfile": `FROM node:20\nCOPY jobs.js /srv/\nWORKDIR /srv\nCMD node jobs.js\n`, "jobs.js": JS,
  });
  assert.deepEqual(runs(m), ["a a/src/server.ts", "b b/main.js", "c c/src/index.ts", "d d/src/server.ts", "e e/prod.js", "jobs jobs.js", "worker a/worker.js"]);
});

test("docker W1 à W6, N2 : variables, étapes, copie depuis une étape, héritage, contexte à la racine", async () => {
  const files = {
    "deploy/billing.Dockerfile": [
      `FROM --platform=linux/amd64 ghcr.io/org/node:20@sha256:abc AS build`,
      `ENV APP_DIR=/srv/app`,
      `WORKDIR $APP_DIR`,
      `COPY --chown=node:node services/billing/ ./billing/`,
      `RUN pnpm build`,
      `FROM node:20-slim`,
      `WORKDIR /app`,
      `COPY --from=build /srv/app/billing/dist ./dist`,
      `CMD ["node", "dist/main.js"]`,
    ].join("\n"),
    "services/billing/src/main.ts": JS,
    "deploy/report.Dockerfile": `FROM node:20 AS app\nWORKDIR /app\nCOPY tools/ ./\nCMD ["node", "report.js"]\nFROM app AS runtime\nENV NODE_ENV=production\n`,
    "tools/report.js": JS,
  };
  assert.deepEqual(runs(await mapOf(files)), ["billing services/billing/src/main.ts", "report tools/report.js"]);
  assert.deepEqual(await factsOf(files, "unit_base"), ["deploy/billing.Dockerfile billing node", "deploy/report.Dockerfile report node"]);
});
