import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel, parseRules, aiLayerDirs } from "../vision/arch/build.js";
import { buildFlow, type FlowStep } from "../vision/arch/flow.js";
import { formatArchModel, formatFlow } from "../vision/arch/format.js";
import { createAliasResolver } from "../vision/model/aliases.js";

const SHOP = join(import.meta.dirname, "arch-fixtures", "shop");

function build() {
  const model = buildModel(SHOP);
  const arch = buildArchModel(SHOP, model, buildInfraModel(SHOP));
  return { model, arch };
}

function flat(steps: FlowStep[]): FlowStep[] {
  return steps.flatMap((s) => [s, ...flat(s.children ?? [])]);
}

test("modèle : alias tsconfig et import() dynamique sont des dépendances internes", () => {
  const { model } = build();
  const has = (from: string, to: string) => model.dependencies.some((d) => d.from === from && d.to === to && !d.external);
  assert.ok(has("src/main.tsx", "src/services/cart.ts"), "alias @/src/… résolu");
  assert.ok(has("src/main.tsx", "src/pages/Checkout.tsx"), "lazy(() => import('@/…')) compté");
  const resolve = createAliasResolver(SHOP, new Set(model.files.map((f) => f.path)));
  assert.equal(resolve("src/main.tsx", "@/src/services/orders"), "src/services/orders.ts");
  assert.equal(resolve("src/main.tsx", "react"), undefined);
});

test("architecture : blocs qui s'exécutent, pas des dossiers", () => {
  const { arch } = build();
  const ids = arch.blocks.map((b) => b.id).sort();
  assert.deepStrictEqual(ids, ["capability:ai", "client:shop", "datastore:firestore", "queue:cloud-tasks", "service:container-worker", "service:firebase-functions-default"]);
  const fns = arch.blocks.find((b) => b.id === "service:firebase-functions-default")!;
  assert.deepStrictEqual(arch.entries.filter((e) => e.block === fns.id).map((e) => `${e.kind}:${e.name}`).sort(), ["callable:placeOrder", "callable:unusedAdmin", "trigger:onOrderCreated"]);
  const worker = arch.blocks.find((b) => b.id === "service:container-worker")!;
  assert.equal(worker.origin.path, "worker/Dockerfile");
  assert.ok(arch.entries.some((e) => e.block === worker.id && e.kind === "http" && e.name === "/work"));
});

test("architecture : chaque lien est prouvé par une ligne de code", () => {
  const { arch } = build();
  const link = (from: string, to: string, kind: string) => arch.links.find((l) => l.from === from && l.to === to && l.kind === kind);
  const calls = link("client:shop", "service:firebase-functions-default", "calls");
  assert.ok(calls, "l'app appelle la fonction (page chargée en import() dynamique, via alias)");
  assert.deepStrictEqual(calls!.targets, ["entry:placeOrder"]);
  assert.ok(calls!.evidence.every((e) => e.target === "entry:placeOrder"), "chaque ligne d'appel porte la fonction qu'elle vise");
  assert.equal(calls!.evidence[0]!.path, "src/services/orders.ts");
  assert.ok(link("datastore:firestore", "service:firebase-functions-default", "triggers"));
  assert.ok(link("service:firebase-functions-default", "queue:cloud-tasks", "enqueues"));
  assert.ok(link("service:firebase-functions-default", "capability:ai", "uses"));
  assert.ok(link("service:container-worker", "datastore:firestore", "writes"));
  for (const l of arch.links) for (const e of l.evidence) assert.ok(e.path && e.line > 0 && e.text.length > 0, `preuve complète pour ${l.id}`);
});

test("intérieur de Firestore : collections, qui lit / écrit, déclencheurs, règles", () => {
  const { arch } = build();
  const fs = arch.blocks.find((b) => b.id === "datastore:firestore")!;
  assert.equal(fs.interior?.kind, "datastore");
  const cols = fs.interior!.kind === "datastore" ? fs.interior!.collections : [];
  const orders = cols.find((c) => c.path === "orders")!;
  assert.ok(orders.writes.some((w) => w.block === "service:firebase-functions-default" && w.entries.includes("entry:placeOrder")), "écriture via ordersCol().doc() puis tx.set(ref, …)");
  assert.ok(orders.writes.some((w) => w.block === "service:container-worker"));
  assert.deepStrictEqual(orders.triggers, ["entry:onOrderCreated"]);
  assert.equal(orders.rules?.line, 4);
  const cart = cols.find((c) => c.path === "users/{}/cart")!;
  assert.ok(cart.reads.some((r) => r.block === "client:shop"));
  assert.ok(cart.writes.some((w) => w.entries.includes("entry:onOrderCreated")));
  assert.equal(cart.rules?.line, 9);
  // unusedAdmin n'atteint rien : une fonction définie dans un fichier qui importe tout ne « lit » pas tout.
  assert.ok(!cols.some((c) => [...c.reads, ...c.writes].some((a) => a.entries.includes("entry:unusedAdmin"))));
});

test("couche IA, file et points d'attention : ce que le code ne dit pas reste signalé", () => {
  const { arch } = build();
  const ai = arch.blocks.find((b) => b.id === "capability:ai")!;
  assert.equal(ai.interior?.kind, "ai");
  if (ai.interior?.kind === "ai") {
    assert.deepStrictEqual(ai.interior.providers.map((p) => p.tech), ["gemini"]);
    assert.deepStrictEqual(ai.interior.models.map((m) => m.name), ["gemini-3.5-flash"]);
    assert.deepStrictEqual(ai.interior.dirs, [], "functions/src est un dossier partagé, pas un module IA");
  }
  const codes = arch.warnings.map((w) => w.code).sort();
  assert.ok(codes.includes("uncalled_entry") && arch.warnings.some((w) => w.message.includes("unusedAdmin")));
  assert.ok(arch.warnings.some((w) => w.code === "unresolved_target" && w.message.includes("WORKER_URL")));
  assert.match(formatArchModel(arch), /Cloud Functions —appelle ×1→ Cloud Functions|App shop —appelle ×1→ Cloud Functions/);
});

test("parcours d'une feature : l'algorithme dans l'ordre du code, effets en profondeur, suite", () => {
  const { model, arch } = build();
  const flow = buildFlow(SHOP, model, arch, { entry: "entry:placeOrder" })!;
  assert.ok(flow);
  assert.deepStrictEqual(flow.callers.map((c) => `${c.via} ← ${c.usedBy.join(",")}`), ["placeOrder ← src/pages/Checkout.tsx"]);
  const steps = flat(flow.steps);
  assert.equal(flow.steps[0]!.kind, "guard");
  assert.match(flow.steps[0]!.label, /^si !request\.auth\?\.uid → refuse : new HttpsError\("unauthenticated"/);
  assert.equal(flow.steps[1]!.kind, "guard");
  assert.ok(steps.some((s) => s.kind === "callback" && s.label === "dans une transaction" && s.children?.some((c) => c.kind === "write" && c.label === "écrit orders")));
  const summarize = steps.find((s) => s.kind === "call" && s.target?.name === "summarize")!;
  assert.deepStrictEqual(summarize.effects, ["IA"]);
  assert.deepStrictEqual(steps.find((s) => s.kind === "call" && s.target?.name === "ordersCol")!.effects, [], "un utilitaire qui renvoie un chemin n'est pas « IA »");
  assert.ok(steps.some((s) => s.kind === "enqueue" && s.label.includes("WORKER_URL")));
  assert.equal(flow.steps[flow.steps.length - 1]!.kind, "return");
  assert.ok(flow.next.some((n) => n.entry === "entry:onOrderCreated"), "l'écriture dans orders déclenche onOrderCreated");
  assert.match(formatFlow(flow, arch), /ENSUITE/);
});

test("passages d'un déroulé : un commentaire du développeur ouvre un passage, pas un commentaire en fin de ligne ni un marqueur @k", () => {
  const { model, arch } = build();
  const symbol = model.files.flatMap((f) => f.symbols).find((s) => s.name === "cancelOrder")!;
  const flow = buildFlow(SHOP, model, arch, { symbol: symbol.id })!;
  const start = symbol.location.startLine;
  assert.deepStrictEqual(
    flow.chapters.map((c) => [c.line - start, c.comment?.text ?? null, c.steps.map((s) => s.kind)]),
    [
      [1, null, ["guard", "call"]],
      // Le marqueur de connaissance `// @k shop.cancel-order` qui suit est transparent : le titre reste celui du développeur.
      [4, "Annulation : l'ordre est d'abord marqué, puis le client prévenu. Jamais l'inverse.", ["write"]],
      // Un commentaire en tête du bloc d'un `if` de premier niveau ouvre aussi un passage.
      [9, "Résumé pour le client, par le modèle.", ["branch", "return"]],
    ],
  );
});

test("règles Firestore : chemins imbriqués, accolades dans les chemins", () => {
  const rules = parseRules("service cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} { allow read: if false; }\n    match /users/{userId} {\n      function f() { return true; }\n      match /wallet/{docId} {\n      }\n    }\n    match /videoJobs/{jobId} {\n    }\n  }\n}\n");
  assert.deepStrictEqual(rules.map((r) => `${r.path}:${r.line}`), ["users:4", "users/{}/wallet:6", "videoJobs:9"]);
});

test("module IA : dossier dédié seulement", () => {
  assert.deepStrictEqual(aiLayerDirs(["f/ai/gemini.ts", "f/ai/claude.ts"], ["f/ai/gemini.ts", "f/ai/claude.ts", "f/ai/index.ts", "f/ai/types.ts", "f/ai/tools.ts"]), ["f/ai"]);
  assert.deepStrictEqual(aiLayerDirs(["f/src/ai.ts"], ["f/src/ai.ts", "f/src/db.ts", "f/src/index.ts"]), []);
});

test("un import relatif non résolu n'est jamais compté comme un fichier d'un bloc ou d'une feature", () => {
  const model = buildModel(SHOP);
  model.dependencies.push({ from: "functions/src/index.ts", to: "./_shared/absent", raw: "./_shared/absent", external: false });
  const arch = buildArchModel(SHOP, model, buildInfraModel(SHOP));
  const all = [...arch.blocks.flatMap((b) => b.files), ...arch.entries.flatMap((e) => e.files ?? [])];
  assert.ok(all.length > 0);
  assert.ok(!all.includes("./_shared/absent"));
});
