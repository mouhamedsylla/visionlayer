import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel } from "../vision/arch/build.js";
import { buildSystemGraph, featureReach, reach, type ReachResult } from "../vision/graph/system.js";
import type { KnowledgeClaim, KnowledgeReport } from "../vision/knowledge/types.js";

const SHOP = join(import.meta.dirname, "arch-fixtures", "shop");
const model = buildModel(SHOP);
const arch = buildArchModel(SHOP, model, buildInfraModel(SHOP));

/** Une affirmation déjà résolue, comme la rend buildKnowledge. */
function claim(id: string, concept: string, path: string, line: number, symbol?: string, marker?: string): KnowledgeClaim {
  const raw = `${path}${symbol ? `#${symbol}` : ""}${marker ? `@${marker}` : ""}`;
  return {
    id, concept, type: "rule", text: id, state: "verified", reference: { uncommitted: true }, tests: [], file: `.vision/knowledge/${concept}.yaml`, line: 1,
    anchors: [{ ref: { raw, path, symbol, marker }, status: "ok", at: { path, line, endLine: line, symbol } }],
  };
}

const knowledge: KnowledgeReport = {
  concepts: [
    {
      id: "order.place", kind: "feature", name: "Passer commande", file: ".vision/knowledge/order.place.yaml",
      entries: [{ name: "placeOrder", found: true }],
      claims: [claim("order.one-transaction", "order.place", "functions/src/index.ts", 9, "placeOrder")],
    },
    {
      id: "ai.summary", kind: "contract", name: "Résumé", file: ".vision/knowledge/ai.summary.yaml", entries: [],
      claims: [claim("ai.summary-short", "ai.summary", "functions/src/ai.ts", 3, "summarize")],
    },
    {
      id: "order.cancel", kind: "feature", name: "Annuler", file: ".vision/knowledge/order.cancel.yaml", entries: [],
      claims: [claim("shop.cancel-order", "order.cancel", "functions/src/index.ts", 34, undefined, "shop.cancel-order")],
    },
  ],
  entriesWithoutFeature: [],
  errors: [],
};
const g = buildSystemGraph(model, arch, knowledge);

const ids = (r: ReachResult) => r.reached.map((x) => x.node.id);
const pathOf = (r: ReachResult, id: string) => r.reached.find((x) => x.node.id === id)?.path.map((e) => `${e.kind}→${e.to}`);

test("reach : depuis un point d'entrée, ses données, ce qu'elles déclenchent, et rien de ses voisins de fichier", () => {
  const r = reach(g, { entry: "placeOrder" });
  assert.deepStrictEqual(r.start.map((n) => n.id), ["entry:placeOrder"]);
  const got = ids(r);
  for (const id of ["collection:orders", "entry:onOrderCreated", "block:queue:cloud-tasks", "block:capability:ai", "file:functions/src/ai.ts", "file:functions/src/db.ts"]) assert.ok(got.includes(id), id);
  assert.deepStrictEqual(pathOf(r, "entry:onOrderCreated"), ["writes→collection:orders", "triggers→entry:onOrderCreated"], "le chemin dit pourquoi");
  assert.ok(got.includes("collection:users/{}/cart"), "ce que fait le déclencheur est atteint aussi");
  assert.ok(!got.includes("symbol:functions/src/index.ts#cancelOrder"), "une fonction voisine dans le même fichier n'est pas exécutée");
  assert.ok(!got.includes("entry:unusedAdmin"));
  assert.ok(!got.includes("entry:service:container-worker:/work"), "la file vise une URL lue dans l'environnement : pas de lien deviné");
});

test("reach : les preuves suivent le chemin", () => {
  const r = reach(g, { entry: "placeOrder" });
  const write = r.reached.find((x) => x.node.id === "collection:orders")!.path[0]!;
  assert.deepStrictEqual(write.at, { path: "functions/src/index.ts", line: 15 });
  for (const x of r.reached) {
    assert.equal(x.path[0]!.from, "entry:placeOrder", `${x.node.id} part du départ`);
    for (let i = 1; i < x.path.length; i++) assert.equal(x.path[i]!.from, x.path[i - 1]!.to, `${x.node.id} : chemin continu`);
    assert.equal(x.path.at(-1)!.to, x.node.id);
    assert.equal(x.depth, x.path.length);
  }
});

test("reach : une feature atteint ses affirmations et celles du code qu'elle exécute, pas celles d'à côté", () => {
  const r = reach(g, { feature: "order.place" });
  const got = ids(r);
  assert.ok(got.includes("claim:order.one-transaction"));
  assert.ok(got.includes("claim:ai.summary-short"), "affirmation ancrée dans un fichier que la feature exécute");
  assert.deepStrictEqual(pathOf(r, "claim:ai.summary-short"), ["covers→entry:placeOrder", "executes→file:functions/src/ai.ts", "defines→symbol:functions/src/ai.ts#summarize", "anchors→claim:ai.summary-short"]);
  assert.ok(!got.includes("claim:shop.cancel-order"), "l'affirmation de cancelOrder, dans le même fichier, n'est pas atteinte");
});

test("reach : depuis des lignes modifiées, le symbole touché, ses données et l'affirmation marquée", () => {
  const r = reach(g, { range: { path: "functions/src/index.ts", from: 34, to: 35 } });
  assert.deepStrictEqual(r.start.map((n) => n.id), ["symbol:functions/src/index.ts#cancelOrder"]);
  const got = ids(r);
  assert.ok(got.includes("collection:orders"));
  assert.ok(got.includes("claim:shop.cancel-order"));
  assert.ok(got.includes("entry:onOrderCreated"), "l'écriture dans orders déclenche onOrderCreated");
  assert.ok(!got.includes("claim:order.one-transaction"));
});

test("reach : en remontant, ce qui exécute un symbole partagé", () => {
  const r = reach(g, { symbol: "functions/src/db.ts#ordersCol" }, { direction: "up" });
  const got = ids(r);
  for (const id of ["entry:placeOrder", "entry:onOrderCreated", "entry:service:container-worker:/work", "concept:order.place"]) assert.ok(got.includes(id), id);
  assert.ok(!got.includes("entry:unusedAdmin"));
});

test("reach : en remontant depuis un fichier, les points d'entrée qui n'exécutent que ses propres lignes", () => {
  const got = ids(reach(g, { file: "functions/src/index.ts" }, { direction: "up" }));
  for (const id of ["entry:placeOrder", "entry:onOrderCreated", "entry:unusedAdmin", "concept:order.place"]) assert.ok(got.includes(id), id);
});

test("reach : une collection, qui l'écrit et ce qu'elle déclenche", () => {
  const up = ids(reach(g, { collection: "orders" }, { direction: "up", maxDepth: 1 }));
  for (const id of ["entry:placeOrder", "symbol:functions/src/index.ts#cancelOrder", "entry:service:container-worker:/work"]) assert.ok(up.includes(id), id);
  assert.deepStrictEqual(ids(reach(g, { collection: "orders" }, { maxDepth: 1 })), ["entry:onOrderCreated"]);
});

test("écran Feature : une collection lue et écrite garde les deux", () => {
  const extra = { ...arch, blocks: arch.blocks.map((b) => b.interior?.kind !== "datastore" ? b : { ...b, interior: { ...b.interior, collections: b.interior.collections.map((c) => c.path !== "orders" ? c : { ...c, reads: [{ block: "service:firebase-functions-default", op: "read", path: "functions/src/index.ts", line: 14, text: "ordersCol().doc()", entries: ["entry:placeOrder"] }] }) } }) };
  const f = featureReach(buildSystemGraph(model, extra, knowledge), { entry: "entry:placeOrder" });
  assert.deepStrictEqual(f.collections.find((c) => c.name === "orders")!.ops, ["reads", "writes"]);
});

test("reach : un départ inconnu n'atteint rien", () => {
  const r = reach(g, { file: "nulle/part.ts" });
  assert.deepStrictEqual(r, { start: [], reached: [] });
});

test("écran Feature : la sélection affichée, calculée par reach", () => {
  // Couvert par une feature : on part de la feature ; ses affirmations, puis celles du code qu'elle exécute.
  const f = featureReach(g, { entry: "entry:placeOrder" });
  assert.deepStrictEqual(f.start, ["concept:order.place"]);
  assert.deepStrictEqual(f.claims.map((c) => `${c.via}:${c.id}`), ["feature:order.one-transaction", "code:ai.summary-short"]);
  assert.deepStrictEqual(f.collections.map((c) => `${c.ops.join("+")}:${c.name}`).sort(), ["writes:orders", "writes:users/{}/cart"]);
  assert.deepStrictEqual(f.entries.map((e) => e.id), ["entry:onOrderCreated"]);

  // Sans feature : les affirmations ancrées dans le symbole affiché sont « ici ».
  const s = featureReach(g, { symbol: "functions/src/index.ts#cancelOrder" });
  assert.deepStrictEqual(s.claims.map((c) => `${c.via}:${c.id}`), ["here:shop.cancel-order"]);
  const e = featureReach(buildSystemGraph(model, arch, { ...knowledge, concepts: knowledge.concepts.filter((c) => c.id !== "order.place").concat({ ...knowledge.concepts[0]!, id: "loose", entries: [] }) }), { entry: "entry:placeOrder" });
  assert.deepStrictEqual(e.start, ["entry:placeOrder"]);
  assert.ok(e.claims.some((c) => c.id === "order.one-transaction" && c.via === "here"), "sans feature, l'affirmation de sa propre fonction est « ici »");
  assert.ok(e.claims.some((c) => c.id === "ai.summary-short" && c.via === "code"));
});
