import { test } from "node:test";
import assert from "node:assert/strict";
import { chainOf, chainRuns, resourceNames, resourceOf } from "../app/src/model/features.js";

const proof = { path: "a.ts", line: 1, source: "syntax" } as never;
const tx = { path: "a.ts", from: 1, to: 9 } as never;

test("la ressource est le premier segment fixe, passé les préfixes d'API", () => {
  assert.equal(resourceOf("POST /api/v1/bookings/:id/cancel"), "bookings");
  assert.equal(resourceOf("GET /health"), "health");
  assert.equal(resourceOf("GET /:slug/items"), "items");
  assert.equal(resourceOf("GET /api"), "api");
  assert.equal(resourceOf("GET /"), "/");
});

test("un espace d'adresses se découpe par son second segment ; une ressource reste entière", () => {
  const n = resourceNames(["GET /admin/services", "POST /admin/services", "GET /admin/barbers", "GET /products", "GET /products/:id", "GET /products/:id/stock", "GET /api/v1/orders", "GET /", "POST /auth/login", "POST /auth/register"]);
  assert.equal(n.get("GET /admin/services"), "/admin/services");
  assert.equal(n.get("GET /admin/barbers"), "/admin/barbers");
  assert.equal(n.get("GET /products/:id/stock"), "/products");
  assert.equal(n.get("GET /api/v1/orders"), "/orders");
  assert.equal(n.get("GET /"), "/");
  assert.equal(n.get("POST /auth/login"), "/auth");
});

test("une réponse d'erreur écrite par le handler compte comme un refus", () => {
  const chain = chainOf([{ kind: "reply", status: "400", depth: 0, proof }, { kind: "reply", status: "200", depth: 0, proof }] as never);
  assert.deepEqual(chain.map((l) => l.kind), ["refuse", "reply"]);
});

test("la chaîne garde l'ordre du code, fond les voisines de même genre, ignore les appels internes", () => {
  const chain = chainOf([
    { kind: "invoke", name: "f", depth: 0, proof },
    { kind: "read", target: { node: "db", entity: "user" }, depth: 0, proof },
    { kind: "refuse", status: "404", depth: 0, proof },
    { kind: "refuse", status: "403", depth: 0, proof },
    { kind: "write", target: { node: "db", entity: "order" }, tx, depth: 0, proof },
    { kind: "write", target: { node: "db", entity: "stock" }, tx, depth: 0, proof },
    { kind: "reply", status: "201", depth: 0, proof },
  ] as never);
  assert.deepEqual(chain.map((l) => [l.kind, l.values.join(",")]), [["read", "user"], ["refuse", "404,403"], ["write", "order,stock"], ["reply", "201"]]);
  assert.deepEqual(chainRuns(chain).map((r) => r.tx), [false, true, false]);
});
