import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { MapSource } from "../vision/web/map-source.js";

const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");

test("contexte : les acteurs viennent des gardes des routes, une phrase par bloc vient de ses faits", async () => {
  const { model } = await new MapSource(ATELIER).refresh();
  const actors = model.nodes.filter((n) => n.role === "actor").map((n) => `${n.name} : ${n.subtitle}`).sort();
  assert.deepEqual(actors, ["Utilisateur avec un rôle : 1 route accessible", "Utilisateur connecté : 7 routes accessibles", "Visiteur : 6 routes ouvertes"]);
  // Un appel signé (le webhook de Stripe) n'est pas une personne : Stripe est déjà sur la carte.
  const toApi = model.edges.filter((e) => e.to === "api" && e.from.startsWith("actor:")).reduce((n, e) => n + e.count, 0);
  assert.equal(toApi, 14, "15 routes, moins le webhook signé");
  assert.ok(model.edges.filter((e) => e.from.startsWith("actor:")).every((e) => e.occurrences.every((o) => !o.entrypoints)), "un acteur n'est pas un effet du code");

  const summary = (name: string) => model.nodes.find((n) => n.name === name)?.summary;
  assert.equal(summary("api"), "expose 15 routes, dont 9 gardées ; lance 3 tâches planifiées ; écrit dans 9 tables et en lit 7 ; publie sur « emails » ; appelle Stripe");
  assert.equal(summary("worker"), "consomme « emails » ; écrit dans 1 table et en lit 4 ; appelle Resend et Serveur SMTP");
  assert.equal(summary("postgres"), "14 tables, écrites par api et worker");
  assert.equal(summary("redis"), "reçoit les messages de api ; réveille worker");
  assert.equal(summary("web"), "appelle api");
});
