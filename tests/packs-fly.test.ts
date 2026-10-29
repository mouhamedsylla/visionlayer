import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { factsOf, mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/fly.md (A = l'app, P = ce qu'elle lance, M = combien, T = TOML). */
const runs = (m: ArchModelV2) => m.nodes.filter((n) => n.level === "deployable")
  .map((n) => `${n.id} ${n.facets.entrypoints?.find((e) => e.kind === "main")?.key}${n.instances ? ` x${n.instances.min}` : ""}`).sort();
const JS = `export {};\n`;

test("fly A1 A2 P1 M1 M2 R1 T1 : app sans groupe, Dockerfile nommé, minimum de machines, variables, région", async () => {
  const files = {
    "fly.toml": [
      `app = "shop-api"   # le nom de l'app`,
      `primary_region = "cdg"`,
      ``,
      `[build]`,
      `  dockerfile = "docker/api.Dockerfile"`,
      ``,
      `[env]`,
      `  NODE_ENV = "production"`,
      `  'LOG_LEVEL' = "info"`,
      ``,
      `[http_service]`,
      `  internal_port = 3000`,
      `  min_machines_running = 1`,
    ].join("\n"),
    "docker/api.Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY . .\nCMD ["node", "dist/server.js"]\n`,
    "src/server.ts": JS,
  };
  const m = await mapOf(files);
  assert.deepEqual(runs(m), ["shop-api src/server.ts x1"]);
  assert.deepEqual(m.nodes.find((n) => n.id === "shop-api")?.attributes?.map((a) => `${a.key}=${a.value} ${a.proof.path}:${a.proof.line}`), ["region=cdg fly.toml:2"]);
  assert.deepEqual(await factsOf(files, "unit_env_name"), ["fly.toml shop-api LOG_LEVEL", "fly.toml shop-api NODE_ENV"]);
});

test("fly P2 M1 T1 T2 : groupes de processus, services, tableau sur plusieurs lignes", async () => {
  const m = await mapOf({
    "worker/fly.toml": [
      `app = "shop-jobs"`,
      `[processes]`,
      `  web = "node server.js"`,
      `  "worker" = 'node dist/jobs.js'  # les tâches`,
      `[[services]]`,
      `  processes = [`,
      `    "web",`,
      `  ]`,
      `  min_machines_running = 2`,
    ].join("\n"),
    "worker/Dockerfile": `FROM node:20\nWORKDIR /app\nCOPY . .\nCMD ["node", "server.js"]\n`,
    "worker/server.js": JS, "worker/src/jobs.ts": JS,
  });
  assert.deepEqual(runs(m), ["web worker/server.js x2", "worker worker/src/jobs.ts"]);
});
