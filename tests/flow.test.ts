import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import type { FlowStep } from "../vision/arch/types.js";
import { flowFacts } from "../vision/facts/syntax-flow.js";
import { parse } from "../vision/parsers/parser.js";
import { MapSource } from "../vision/web/map-source.js";

const facts = (source: string) =>
  flowFacts("a.ts", parse(source, "typescript").rootNode, (rel, args, line) => ({ rel, args, proof: { path: "a.ts", line, source: "syntax" } }))
    .map((f) => `${f.rel}(${f.args.map((a) => JSON.stringify(a)).join(", ")})`);

test("déroulé, syntaxe : un refus garde sa condition, son code et son texte ; dans un .catch il arrive sur erreur", () => {
  const out = facts([
    "export async function pay(req, res) {",
    "  if (order.status !== \"open\") throw new HttpError(409, \"not_open\");",
    "  // la clé est la commande",
    "  const r = await psp.create(order).catch(() => {",
    "    throw new HttpError(502, \"down\");",
    "  });",
    "  if (r.cached) return res.status(200).json(r);",
    "  res.json(r);",
    "}",
  ].join("\n"));
  assert.ok(out.includes('throws("a.ts", 1, 2, "HttpError", "409", "not_open", "order.status !== \\"open\\"", "if")'));
  assert.ok(out.includes('throws("a.ts", 1, 5, "HttpError", "502", "down", "", "catch")'));
  assert.ok(out.includes('note("a.ts", 1, 4, 6, "la clé est la commande")'));
  assert.ok(out.includes('returns_early("a.ts", 1, 7, "r.cached")'));
  assert.ok(out.includes('param_call("a.ts", 1, 1, "status.json", "200", 7)'));
  assert.ok(out.includes('param_call("a.ts", 1, 1, "json", "", 8)'));
});

test("déroulé, syntaxe : un appel dans un case dit sa branche ; un return de case n'est pas un retour anticipé", () => {
  const out = facts([
    "function handle(event) {",
    "  switch (event.type) {",
    "    case \"paid\": return confirm(event);",
    "  }",
    "}",
  ].join("\n"));
  assert.ok(out.includes('fn_calls("a.ts", 1, "confirm", 3, "event.type === \\"paid\\"")'));
  assert.ok(!out.some((f) => f.startsWith("returns_early")));
});

const model = (await new MapSource(join(import.meta.dirname, "corpus", "atelier-api")).get()).model;
const flowOf = (key: string) => model.nodes.flatMap((n) => n.facets.entrypoints ?? []).find((e) => e.key === key)!.flow!;
const line = (st: FlowStep) => [
  "  ".repeat(st.depth) + st.kind, st.target ? [st.target.node, st.target.entity ?? st.target.topic].filter(Boolean).join("/") : st.name, st.status,
].filter(Boolean).join(" ");

test("déroulé de POST /payments : la garde dépliée, les refus, Stripe, l'écriture, la réponse, dans l'ordre", () => {
  assert.deepEqual(flowOf("POST /payments").map(line), [
    "invoke requireUser", "  refuse HttpError 401", "  read postgres/users", "  read postgres/sessions", "  refuse HttpError 401",
    "read postgres/bookings", "refuse HttpError 404", "refuse HttpError 409", "refuse HttpError 410", "read postgres/payments",
    "request stripe", "reply json", "request stripe", "refuse HttpError 502", "write postgres/payments", "reply json",
  ]);
  const create = flowOf("POST /payments").find((s) => s.name === "paymentIntents.create")!;
  assert.match(create.why!.text, /^Un double clic ne doit jamais débiter deux fois/);
});

test("déroulé du webhook Stripe : chaque branche dit son type d'événement, et l'appel entrant n'est pas une étape", () => {
  const flow = flowOf("POST /webhooks/stripe");
  assert.ok(!flow.some((s) => s.target?.node === "api"));
  assert.equal(flow.find((s) => s.name === "confirmBooking")!.when, 'event.type === "payment_intent.succeeded"');
  assert.deepEqual(flow.filter((s) => s.kind === "message").map((s) => s.depth), [2, 2, 2]);
});
