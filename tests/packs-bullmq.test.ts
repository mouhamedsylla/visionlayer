import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/bullmq.md (P = producteur, C = consommateur). */
const SERVER = { Dockerfile: `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n` };
const sent = (m: ArchModelV2) => m.edges.filter((e) => e.kind === "message").map((e) => e.target?.topic).sort();
const consumers = (m: ArchModelV2) => (m.nodes.find((n) => n.id === "image")?.facets.entrypoints ?? []).filter((e) => e.kind === "message").map((e) => `${e.key} ${e.handler?.path}:${e.handler?.line}`).sort();
const triggers = (m: ArchModelV2) => m.edges.filter((e) => e.kind === "trigger").map((e) => e.target?.entrypoint?.split(":").pop()).sort();

test("bullmq P1 P2 P3 P4 P5 C1 C2 : files, mises en file, constantes, alias, travailleurs", async () => {
  const m = await mapOf({ ...SERVER,
    "names.ts": `export const EMAIL_QUEUE = "emails";\nexport const PDF_QUEUE = "pdf";\n`,
    "queues.ts": [
      `import { Queue } from "bullmq";`,
      `import { EMAIL_QUEUE } from "./names";`,
      `const connection = { host: "redis" };`,
      `export const emails = new Queue(EMAIL_QUEUE, { connection });`,
      `export const invoices = new Queue("invoices", { connection });`,
    ].join("\n"),
    "index.ts": `export * from "./queues";\n`,
    "send.ts": `export async function sendEmail() {}\n`,
    "main.ts": [
      `import { Worker } from "bullmq";`,
      `import { emails as mailQueue, invoices } from "./index";`,
      `import { PDF_QUEUE } from "./names";`,
      `import { sendEmail } from "./send";`,
      `export const a = () => mailQueue.add("welcome", {});`,
      `export const b = () => invoices.addBulk([{ name: "i", data: {} }]);`,
      `new Worker("emails", sendEmail);`,
      `new Worker(PDF_QUEUE, async (job) => {});`,
      `const cache = new Map(); cache.add?.("x");`,
    ].join("\n"),
  });
  assert.deepEqual(sent(m), ["emails", "invoices"]);
  assert.deepEqual(consumers(m), ["emails send.ts:1", "pdf main.ts:8"]);
  assert.deepEqual(triggers(m), ["emails", "pdf"]);
});

test("bullmq P6 P7 P8 C3 : tâche répétée, planificateur, flux, processeur isolé", async () => {
  const m = await mapOf({ ...SERVER,
    "processors/report.ts": `export default async function (job: unknown) { return job; }\n`,
    "main.ts": [
      `import { Queue, Worker, FlowProducer } from "bullmq";`,
      `import path from "node:path";`,
      `const digest = new Queue("digest");`,
      `const cleanup = new Queue("cleanup");`,
      `digest.add("daily", {}, { repeat: { pattern: "0 8 * * *" } });`,
      `cleanup.upsertJobScheduler("nightly", { every: 86400000 }, { name: "run" });`,
      `const flow = new FlowProducer();`,
      `flow.add({ name: "order", queueName: "orders", children: [{ name: "mail", queueName: "mails" }] });`,
      `new Worker("reports", path.join(__dirname, "processors/report.js"));`,
    ].join("\n"),
  });
  assert.deepEqual(sent(m), ["cleanup", "digest", "mails", "orders"]);
  assert.deepEqual(consumers(m), ["reports processors/report.ts:1"]);
  // Le fichier du processeur fait partie du déployable.
  assert.ok(m.nodes.find((n) => n.id === "image")?.files?.includes("processors/report.ts"));
});
