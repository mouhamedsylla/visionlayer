import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapChanges } from "../vision/web/changes.js";
import { MapSource } from "../vision/web/map-source.js";

const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");

const model = (await new MapSource(ATELIER).get()).model;
const copy = (): ArchModelV2 => structuredClone(model);

test("changements : deux cartes identiques n'ont rien de changé", () => {
  assert.deepEqual(mapChanges(model, copy()), []);
});

test("changements : une route ajoutée, une valeur retirée, un constat résolu", () => {
  const after = copy();
  const api = after.nodes.find((n) => n.id === "api")!;
  const route = api.facets.entrypoints!.find((e) => e.key === "POST /bookings")!;
  api.facets.entrypoints!.push({ ...route, id: "api:http:POST /bookings/:id/move", key: "POST /bookings/:id/move" });
  const status = after.nodes.find((n) => n.id === "postgres")!.facets.data!.entities.find((e) => e.name === "bookings")!.fields!.find((f) => f.name === "status")!;
  status.values = status.values!.filter((v) => v !== "on_hold");
  after.findings = after.findings.filter((f) => !f.message.startsWith("bookings.status accepte « on_hold »"));

  const texts = mapChanges(model, after).map((c) => `${c.sign === "added" ? "+" : "-"} ${c.text}`);
  assert.deepEqual(texts, [
    "+ POST /bookings/:id/move dans api",
    "- bookings.status accepte « on_hold »",
    "- bookings.status accepte « on_hold », que rien n'écrit",
  ]);
});

test("changements : une table ajoutée ne liste pas ses champs un par un", () => {
  const after = copy();
  const entities = after.nodes.find((n) => n.id === "postgres")!.facets.data!.entities;
  entities.push({ name: "waitlist", fields: [{ name: "id" }, { name: "status", values: ["open", "closed"] }] });
  assert.deepEqual(mapChanges(model, after).map((c) => [c.sign, c.kind, c.text]), [["added", "entity", "table waitlist"]]);
});
