import { test } from "node:test";
import assert from "node:assert/strict";
import { factsOf } from "./pack-fixture.js";

/** `export default async (job) => { … }` : la fonction sans nom est « default », et l'appel de qui l'importe y mène. */
test("syntaxe : une fonction exportée par défaut sans nom est déclarée, et ses appels sont résolus", async () => {
  const files = {
    "worker.ts": `import sync from "./sync";\nimport named from "./named";\nconst processor = async (job: any) => {\n  switch (job.name) {\n    case "sync": return sync(job);\n    default: return named(job);\n  }\n};\n`,
    "sync.ts": `export default async (job: unknown) => {\n  console.log(job);\n};\n`,
    "named.ts": `export default function (job: unknown) {\n  return job;\n}\n`,
  };
  assert.deepEqual(await factsOf(files, "defines").then((d) => d.filter((x) => x.includes("default"))), ["named.ts default 1", "sync.ts default 1"]);
  const resolved = (await factsOf(files, "resolves")).filter((r) => r.startsWith("worker.ts"));
  assert.ok(resolved.includes("worker.ts sync sync.ts 1"), resolved.join(" | "));
  assert.ok(resolved.includes("worker.ts named named.ts 1"), resolved.join(" | "));
  assert.ok((await factsOf(files, "fn_span")).includes("sync.ts default 1 3"));
});
