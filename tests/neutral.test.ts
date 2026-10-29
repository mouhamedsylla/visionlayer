import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildModel } from "../vision/model/build.js";
import { buildInfraModel } from "../vision/infra/build.js";
import { buildArchModel } from "../vision/arch/build.js";
import { toV2 } from "../vision/arch/neutral.js";
import { checkArchModelV2 } from "../vision/arch/schema.js";
import type { ArchModelV2 } from "../vision/arch/types.js";

const SHOP = join(import.meta.dirname, "arch-fixtures", "shop");
const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");

/** Toutes les clés d'un objet, à toute profondeur : la FORME du modèle, sans ses valeurs. */
function keys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keys(v, out);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.add(k); keys(v, out); }
  return out;
}

/** Un nom de pile ou de produit ne doit jamais être une clé. */
const STACK_WORDS = /firestore|firebase|collection|express|postgres|redis|bullmq|stripe|drizzle|cloud|lambda|kafka|prisma|react|provider/i;

function shop() {
  const model = buildModel(SHOP);
  const v1 = buildArchModel(SHOP, model, buildInfraModel(SHOP));
  return { v1, v2: toV2(v1, { name: "shop", files: model.files.map((f) => f.path) }) };
}

test("modèle neutre : l'oracle d'atelier-api se décrit sans champ propre à une pile", () => {
  const oracle = JSON.parse(readFileSync(join(ATELIER, "expected.arch.json"), "utf8")) as ArchModelV2;
  assert.deepEqual(checkArchModelV2(oracle), []);
  for (const k of keys(oracle)) assert.doesNotMatch(k, STACK_WORDS, `clé propre à une pile : ${k}`);

  // Ce que le doc 07 attend d'une pile qui n'est pas Firebase, dit avec les seules facettes.
  const node = (id: string) => oracle.nodes.find((n) => n.id === id)!;
  assert.equal(node("api").facets.entrypoints!.filter((e) => e.kind === "http").length, 15);
  assert.equal(node("api").facets.entrypoints!.filter((e) => e.kind === "schedule").length, 3);
  assert.equal(node("api").instances?.min, 2);
  assert.equal(node("postgres").facets.data!.entities.length, 14);
  assert.equal(node("redis").facets.channel!.topics[0]!.name, "emails");
  assert.deepEqual(node("emails").facets.contract![0]!.implementations.map((i) => i.name), ["ResendSender", "SmtpSender", "ConsoleSender"]);
  assert.ok(oracle.nodes.flatMap((n) => n.facets.config?.env ?? []).every((e) => !("value" in e)), "jamais la valeur d'une variable");
});

test("modèle neutre : le schéma refuse un champ propre à une pile", () => {
  const oracle = JSON.parse(readFileSync(join(ATELIER, "expected.arch.json"), "utf8")) as ArchModelV2;
  const bad = structuredClone(oracle) as unknown as { nodes: Record<string, unknown>[] };
  bad.nodes[0]!.collections = [];
  assert.match(checkArchModelV2(bad).join("\n"), /collections/);

  const dangling = structuredClone(oracle);
  dangling.edges[0]!.to = "nulle-part";
  assert.match(checkArchModelV2(dangling).join("\n"), /cible inconnue nulle-part/);
});

test("modèle neutre : la carte Firebase actuelle se convertit sans rien perdre", () => {
  const { v1, v2 } = shop();
  assert.deepEqual(checkArchModelV2(v2), []);
  for (const k of keys(v2)) assert.doesNotMatch(k, STACK_WORDS, `clé propre à une pile : ${k}`);

  // Chaque bloc, chaque point d'entrée et chaque avertissement de la v1 a sa place.
  for (const b of v1.blocks) assert.ok(v2.nodes.some((n) => n.id === b.id), b.id);
  const entries = v2.nodes.flatMap((n) => n.facets.entrypoints ?? []);
  assert.equal(entries.length, v1.entries.length);
  assert.equal(v2.findings.length, v1.warnings.length);

  // Les collections deviennent des entités, et leurs lectures et écritures des liens vers l'entité.
  const store = v2.nodes.find((n) => n.facets.data)!;
  const datastore = v1.blocks.find((b) => b.interior?.kind === "datastore")!;
  assert.equal(store.id, datastore.id);
  const collections = datastore.interior!.kind === "datastore" ? datastore.interior!.collections : [];
  assert.deepEqual(store.facets.data!.entities.map((e) => e.name), collections.map((c) => c.path));
  const accesses = collections.reduce((n, c) => n + c.reads.length + c.writes.length, 0);
  const entityEdges = v2.edges.filter((e) => e.to === store.id && e.target?.entity);
  assert.equal(entityEdges.reduce((n, e) => n + e.count, 0), accesses);

  // Les autres liens restent, avec leurs preuves.
  for (const l of v1.links) {
    if ((l.kind === "reads" || l.kind === "writes") && l.to === store.id) continue;
    const e = v2.edges.find((x) => x.id === l.id);
    assert.ok(e, l.id);
    assert.equal(e.occurrences.length, l.evidence.length);
  }
  // Chaque preuve dit d'où elle vient.
  assert.ok(v2.edges.every((e) => e.occurrences.every((o) => o.source === "syntax" || o.source === "manifest")));
});
