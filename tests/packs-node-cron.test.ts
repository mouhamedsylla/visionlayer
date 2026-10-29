import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/node-cron.md (T = planifier, H = le code de la tâche). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n` };
const tasks = (m: ArchModelV2) => (m.nodes.find((n) => n.id === "image")?.facets.entrypoints ?? []).filter((e) => e.kind === "schedule").map((e) => `${e.key} ${e.handler?.path}:${e.handler?.line}`).sort();

test("node-cron T1 T2 T3 T4 T5 : imports, createTask, expression en constante", async () => {
  const m = await mapOf({ ...SERVER,
    "schedules.ts": `export const NIGHTLY = "0 3 * * *";\n`,
    "jobs.ts": `export async function purge() {}\nexport async function backup() {}\nexport async function report() {}\nexport async function digest() {}\nexport async function sync() {}\n`,
    "a.ts": `import cron from "node-cron";\nimport { purge } from "./jobs";\ncron.schedule("* * * * *", purge);\n`,
    "b.ts": `import * as nc from "node-cron";\nimport { backup } from "./jobs";\nimport { NIGHTLY } from "./schedules";\nnc.schedule(NIGHTLY, backup);\n`,
    "c.ts": `const cron = require("node-cron");\nconst { report } = require("./jobs");\ncron.schedule("0 8 * * 1", report);\n`,
    "d.ts": `import { schedule, validate } from "node-cron";\nimport { digest } from "./jobs";\nconst WEEKLY = "0 9 * * 0";\nvalidate("0 9 * * 0");\nschedule(WEEKLY, digest);\n`,
    "e.ts": `import cron from "node-cron";\nimport { sync } from "./jobs";\nconst task = cron.createTask("*/5 * * * *", sync);\ntask.start();\n`,
    "f.ts": `import { schedule } from "./my-scheduler";\nschedule("0 0 * * *", () => {});\n`,
    "main.ts": `import "./a";\nimport "./b";\nimport "./c";\nimport "./d";\nimport "./e";\nimport "./f";\n`,
  });
  assert.deepEqual(tasks(m), [
    "* * * * * jobs.ts:1",
    "*/5 * * * * jobs.ts:5",
    "0 3 * * * jobs.ts:2",
    "0 8 * * 1 jobs.ts:3",
    "0 9 * * 0 jobs.ts:4",
  ]);
});

test("node-cron T6 T7 H1 H2 H3 H4 : arrière-plan, options, formes du code", async () => {
  const m = await mapOf({ ...SERVER,
    "tasks/backup.ts": `export default async function () {}\n`,
    "jobs/index.ts": `export const jobs = { clean: async () => {} };\nexport async function remind() {}\n`,
    "main.ts": [
      `import cron from "node-cron";`,
      `import path from "node:path";`,
      `import { jobs, remind } from "./jobs/index";`,
      `const safe = (name: string, fn: () => Promise<void>) => () => { fn().catch(() => {}); };`,
      `cron.schedule("0 1 * * *", path.join(__dirname, "tasks/backup.js"));`,
      `cron.schedule("0 2 * * *", async () => {`,
      `  await Promise.resolve();`,
      `});`,
      `cron.schedule("0 4 * * *", jobs.clean);`,
      `cron.schedule("0 5 * * *", safe("remind", remind), { timezone: "Europe/Paris" });`,
    ].join("\n"),
  });
  assert.deepEqual(tasks(m), [
    "0 1 * * * tasks/backup.ts:1",
    "0 2 * * * main.ts:6",
    "0 4 * * * jobs/index.ts:1",
    "0 5 * * * jobs/index.ts:2",
  ]);
  // Le fichier de la tâche en arrière-plan fait partie du déployable.
  assert.ok(m.nodes.find((n) => n.id === "image")?.files?.includes("tasks/backup.ts"));
});

test("node-cron : une expression calculée à l'exécution est un trou de couverture, pas une tâche qui disparaît", async () => {
  const m = await mapOf({ ...SERVER,
    "main.ts": `import cron from "node-cron";\nimport { EVERY } from "./missing";\ncron.schedule(process.env.CRON ?? "0 0 * * *", () => {});\ncron.schedule(EVERY, () => {});\n`,
  });
  assert.deepEqual(tasks(m), []);
  const gap = m.coverage.flatMap((c) => c.gaps).find((g) => g.kind === "target_unknown");
  assert.equal(gap?.count, 2);
  assert.equal(gap?.proof?.path, "main.ts");
});
