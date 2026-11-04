import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { MapSource } from "../vision/web/map-source.js";
import type { ArchNode } from "../vision/arch/types.js";
import type { MapPayload } from "../vision/web/types.js";
import { actors } from "../app/src/model/access.js";
import { stores } from "../app/src/model/data.js";
import { findingPlace } from "../app/src/model/destinations.js";
import { mechanismsOf } from "../app/src/model/mechanisms.js";
import { blockQuestions, type Question } from "../app/src/model/questions.js";
import { triggers } from "../app/src/model/tasks.js";

const CORPUS = join(import.meta.dirname, "corpus");
const projects = readdirSync(CORPUS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

/** Ce que l'écran ouvert par une question montre pour ce bloc. */
function shows(map: MapPayload, node: ArchNode, q: Question): number {
  if (q.off || q.screen === "packs") return 1;
  if (q.screen === "bloc") return map.model.nodes.filter((n) => n.parent === node.id).length + (node.facets.entrypoints?.length ?? 0);
  if (q.screen === "acces") return actors(map, node).rows.length;
  if (q.screen === "donnees") return stores(map, node).length;
  if (q.screen === "taches") return triggers(map, node).length;
  if (q.screen === "mecanismes") { const m = mechanismsOf(map, node); return m.contracts.length + m.queues.length + m.outages.length; }
  return 1;
}

for (const name of projects) test(`Carte, panneau d'un bloc, ${name} : aucune question ne mène à un écran vide, aucun constat n'est perdu`, async () => {
  const map = await new MapSource(join(CORPUS, name)).refresh();
  for (const node of map.model.nodes.filter((n) => n.level !== "component")) {
    const { questions, others } = blockQuestions(map, undefined, node);
    for (const q of questions) assert.ok(shows(map, node, q) > 0, `${node.name}, « ${q.text} » mène à ${q.screen} sans rien à montrer`);
    for (const f of map.model.findings.filter((x) => x.nodes?.includes(node.id))) {
      const s = findingPlace(map, f).screen;
      const key = s === "table" ? "donnees" : s === "carte" ? "bloc" : s;
      assert.ok(others.includes(f) || questions.some((q) => q.screen === key && q.mark), `${node.name} : « ${f.message} » n'apparaît nulle part`);
    }
  }
});

test("Carte, panneau d'un bloc : le bloc suivi limite chaque écran à ce qui le concerne", async () => {
  const map = await new MapSource(join(CORPUS, "atelier-api")).refresh();
  const api = map.model.nodes.find((n) => n.name === "api")!, worker = map.model.nodes.find((n) => n.name === "worker")!;
  const total = actors(map).total;
  assert.equal(actors(map, api).total, total, "toutes les routes de ce projet sont à l'API");
  assert.equal(actors(map, worker).total, 0);
  assert.ok(triggers(map, api).every((t) => t.node.id === api.id));
  assert.ok(triggers(map, worker).every((t) => t.node.id === worker.id));
  assert.ok(triggers(map, api).length > 0 && triggers(map, worker).length > 0);
  const ids = blockQuestions(map, undefined, worker).questions.map((q) => q.id);
  assert.ok(!ids.includes("access"), "un worker sans route n'a pas de porte");
  assert.ok(ids.includes("tasks"));
});

test("Carte : une app seule, sans serveur, est dessinée", async () => {
  const { mapGrid } = await import("../app/src/model/map.js");
  const grid = mapGrid({ model: { system: { name: "x" }, nodes: [{ id: "a", name: "a", level: "deployable", role: "app", status: "live", proof: [], facets: {} }], edges: [], findings: [], coverage: [] }, tech: {} } as unknown as MapPayload);
  assert.deepEqual(grid.middle.map((m) => m.node.name), ["a"]);
});
