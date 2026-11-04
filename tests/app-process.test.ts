import { test } from "node:test";
import assert from "node:assert/strict";
import { processes } from "../app/src/model/process.js";

const proof = (line: number) => ({ path: "a.ts", line, source: "syntax" });
const entry = (id: string, flow: unknown[], extra = {}) => ({ id, kind: "http", key: id, proof: proof(1), flow, ...extra });
const write = (line: number) => ({ kind: "write", depth: 1, target: { node: "db", entity: "orders" }, proof: proof(line) });

function payload() {
  const create = entry("POST /orders", [write(10), { kind: "reply", status: "201", depth: 0, proof: proof(11) }]);
  const hook = entry("POST /webhooks/pay", [
    { kind: "refuse", status: "400", depth: 0, proof: proof(19) },
    { kind: "invoke", name: "markPaid", depth: 0, proof: proof(20) }, write(30),
    { kind: "invoke", name: "markFailed", depth: 0, proof: proof(21) }, write(40), { kind: "read", depth: 1, target: { node: "db", entity: "users" }, proof: proof(41) },
  ]);
  const cancel = entry("POST /orders/:id/cancel", [{ kind: "refuse", status: "409", when: 'order.status !== "paid"', depth: 0, proof: proof(49) }, write(50)]);
  const list = entry("GET /orders", [{ kind: "read", depth: 0, target: { node: "db", entity: "orders" }, proof: proof(60) }]);
  const all = [create, hook, cancel, list].map((e) => e.id);
  const writes = [
    { value: "new", fn: "createOrder", node: "api", entrypoints: all, proof: proof(10) },
    { value: "paid", fn: "markPaid", node: "api", entrypoints: all, proof: proof(30) },
    { value: "failed", fn: "markFailed", node: "api", entrypoints: all, proof: proof(40) },
    { value: "cancelled", fn: "cancel", node: "api", entrypoints: all, proof: proof(50) },
    { value: "ghost", node: undefined, proof: proof(70) },
  ];
  return { tech: {}, model: { findings: [], edges: [], system: { name: "x" }, nodes: [
    { id: "api", name: "api", level: "deployable", role: "service", facets: { entrypoints: [create, hook, cancel, list] } },
    { id: "db", name: "db", level: "deployable", role: "store", facets: { data: { entities: [{ name: "orders", fields: [{ name: "status", values: ["new", "paid", "failed", "cancelled", "refunded"], default: "new", writes }] }] } } },
  ] } } as never;
}

test("un parcours relie les points d'entrée à l'état qu'ils écrivent, sans ceux qui ne l'écrivent pas", () => {
  const [p] = processes(payload());
  assert.equal(p!.name, "orders");
  assert.deepEqual(p!.stages.map((s) => s.label), ["new", "paid", "failed", "cancelled"]);
  assert.deepEqual(p!.stages.map((s) => s.steps.map((x) => x.entry?.key)), [["POST /orders"], ["POST /webhooks/pay"], ["POST /webhooks/pay"], ["POST /orders/:id/cancel"]]);
  assert.deepEqual(p!.never, ["refunded"]);
});

test("une adresse de webhook vient de l'extérieur ; un webhook qui aiguille ne montre que la branche de sa fonction", () => {
  const [p] = processes(payload());
  const paid = p!.stages.find((s) => s.label === "paid")!.steps[0]!;
  assert.equal(paid.trigger.kind, "external");
  assert.deepEqual(paid.chain.map((l) => [l.kind, l.values.join()]), [["write", "orders"]]);
  const failed = p!.stages.find((s) => s.label === "failed")!.steps[0]!;
  assert.deepEqual(failed.chain.map((l) => l.kind), ["write", "read"]);
});

test("une condition de refus qui parle de l'état est gardée telle qu'elle est écrite", () => {
  const [p] = processes(payload());
  const c = p!.stages.find((s) => s.label === "cancelled")!.steps[0]!;
  assert.deepEqual(c.guards.map((g) => [g.when, g.status]), [['order.status !== "paid"', "409"]]);
});

test("sans champ d'état ni file, aucun parcours n'est inventé", () => {
  assert.deepEqual(processes({ tech: {}, model: { findings: [], edges: [], system: { name: "x" }, nodes: [] } } as never), []);
});
