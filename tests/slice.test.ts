import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { MapSource } from "../vision/web/map-source.js";
import { MapIndex } from "../vision/slice/index.js";
import { buildSummary } from "../vision/slice/summary.js";
import { buildSlice, formatSlice } from "../vision/slice/build.js";
import { TASKS } from "./slice-tasks.js";

const index = new MapIndex((await new MapSource(join(import.meta.dirname, "corpus", "atelier-api")).get()).model);

/** Toutes les adresses qu'une tranche donne à lire, y compris celles citées dans le texte (le code d'un point d'entrée). */
const addresses = (text: string) => new Set([...text.matchAll(/([\w./-]+\.(?:ts|tsx|js|toml|sql)):(\d+)/g)].map((m) => `${m[1]}:${m[2]}`));


for (const t of TASKS) {
  test(`tranche : ${t.task}`, () => {
    const text = formatSlice(buildSlice(index, t.choose), t.choose);
    const got = addresses(text);
    const missing = Object.entries(t.must).filter(([a]) => !got.has(a)).map(([a, why]) => `${a} (${why})`);
    assert.deepEqual(missing, [], text);
    assert.ok(buildSlice(index, t.choose).items.every((i) => i.dist <= 2), "rien au-delà de la distance 2");
  });
}

test("tranche : un nom inconnu est dit, pas ignoré", () => {
  const s = buildSlice(index, ["expireHolds", "nimporte"]);
  assert.deepEqual(s.unknown, ["nimporte"]);
  assert.ok(formatSlice(s, ["expireHolds", "nimporte"]).includes("Introuvable sur la carte : nimporte"));
});

test("sommaire : chaque nom de la première colonne se retrouve sur la carte", () => {
  const text = buildSummary(index);
  const section = (title: string) => text.split(`\n${title}\n`)[1]!.split("\n\n")[0]!.split("\n");
  const names = [
    ...section("POINTS D'ENTRÉE").map((l) => l.trim().split(/\s{2,}/)[0]!),
    ...section("DONNÉES").map((l) => l.trim().split(/\s{2,}/)[0]!),
    ...section("CONSTATS").map((l) => l.trim().split(/\s{2,}/)[0]!),
  ];
  assert.ok(names.length > 30);
  assert.deepEqual(names.filter((n) => !buildSlice(index, [n]).items.length), []);
  assert.ok(text.length < 7000, `sommaire trop long : ${text.length}`);
});
