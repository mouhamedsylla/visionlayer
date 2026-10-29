import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { factsOf, mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/compose.md (C = services, L = ce qui est lancé, R = combien). */
const runs = (m: ArchModelV2) => m.nodes.filter((n) => n.level === "deployable" && n.role !== "store" && n.role !== "channel")
  .map((n) => `${n.id} ${n.facets.entrypoints?.find((e) => e.kind === "main")?.key}${n.instances ? ` x${n.instances.min}` : ""}`).sort();
const stores = (m: ArchModelV2) => m.nodes.filter((n) => n.role === "store" || n.role === "channel").flatMap((n) => n.tech ?? []).sort();
const JS = `export {};\n`;

test("compose C2 C3 C4 C5 L1 L2 L4 R1 R3 : images, builds, Dockerfile nommé, commande, copies, fragments", async () => {
  const m = await mapOf({
    "compose.yaml": [
      `x-node: &node`,
      `  build:`,
      `    context: .`,
      `    dockerfile: docker/app.Dockerfile`,
      `  environment:`,
      `    NODE_ENV: production`,
      `services:`,
      `  api:`,
      `    <<: *node`,
      `    image: org/api:1`,
      `    deploy:`,
      `      replicas: 2`,
      `  worker:`,
      `    <<: *node`,
      `    command: ["pnpm", "exec", "tsx", "src/worker.ts"]`,
      `  db:`,
      `    image: postgres:16-alpine`,
      `  cache:`,
      `    image: docker.io/bitnami/redis:7.2@sha256:abc`,
      `  web:`,
      `    build: ./web`,
    ].join("\n"),
    "docker/app.Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY . .\nCMD ["node", "dist/server.js"]\n`,
    "src/server.ts": JS, "src/worker.ts": JS,
    "web/Dockerfile": `FROM node:20\nCOPY . .\nCMD node main.js\n`, "web/main.js": JS,
  });
  assert.deepEqual(runs(m), ["api src/server.ts x2", "web web/main.js", "worker src/worker.ts"]);
  assert.deepEqual(stores(m), ["postgresql", "redis"]);
});

test("compose C1 L3 R1 R2 : fichier d'environnement de production, point d'entrée, scale, variables en liste", async () => {
  const files = {
    "docker-compose.prod.yml": [
      `services:`,
      `  jobs:`,
      `    build:`,
      `      context: services/jobs`,
      `    entrypoint: node`,
      `    command: run.js`,
      `    scale: 3`,
      `    environment:`,
      `      - LOG_LEVEL=info`,
    ].join("\n"),
    "services/jobs/Dockerfile": `FROM node:20\nWORKDIR /srv\nCOPY . .\nCMD ["node", "index.js"]\n`,
    "services/jobs/index.js": JS, "services/jobs/run.js": JS,
  };
  assert.deepEqual(runs(await mapOf(files)), ["jobs services/jobs/run.js x3"]);
  assert.deepEqual(await factsOf(files, "unit_env_name"), ["docker-compose.prod.yml jobs LOG_LEVEL"]);
});
