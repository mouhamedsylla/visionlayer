import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { MapSource } from "../vision/web/map-source.js";
import { mapGrid, tableGroups } from "../app/src/model/map.js";
import { coverage, overviewHero, overviewStats, sidebarCounts } from "../app/src/model/overview.js";

const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");

test("interface, Carte : la grille de la planche 03 se déduit des rôles et du sens des liens", async () => {
  const map = await new MapSource(ATELIER).refresh();
  const grid = mapGrid(map);
  // Ce qui tourne, de haut en bas : le service, la file où il dépose, le worker qui la consomme, les extérieurs qu'il appelle seul.
  assert.deepEqual(grid.middle.map((m) => m.node.name), ["api", "redis", "worker", "Serveur SMTP", "Resend"]);
  // Ce qui appelle l'API : l'app web, et Stripe par son webhook, avec le retour vers Stripe.
  const api = grid.middle[0]!;
  assert.deepEqual(api.rows.map((r) => `${r.left?.name} ${r.leftArrows.map((a) => `${a.back ? "<" : ">"}${a.label}`).join(" ")}`), ["web >8 calls", "Stripe >1 call <5 calls"]);
  assert.equal(api.down?.label, "6 enqueues");
  assert.deepEqual(grid.right.map((n) => n.name), ["postgres"]);
  // Postgres montre les tables du point de vue du bloc choisi.
  const groups = tableGroups(grid.right[0]!, api.node, grid.links);
  assert.deepEqual(groups.map((g) => `${g.label} ${g.tables.length}`), ["Written by api 9", "Read by api 7"]);
});

test("interface, Overview : chaque nombre vient de la carte", async () => {
  const map = await new MapSource(ATELIER).refresh();
  const stats = overviewStats(map, { total: 0, contradicted: 0 });
  assert.deepEqual(stats.map((s) => `${s.label} ${s.value}${s.unit ? ` ${s.unit}` : ""}`), ["Deployables 5", "Entry points 15 routes", "Tables 14", "Scheduled tasks 3 × 2", "Declared rules 0"]);
  assert.equal(stats[3]!.note, "Each runs 2 times");
  const grid = coverage(map);
  assert.equal(grid.total, 67);
  assert.ok(grid.folders.some((f) => f.name === "auth") && grid.folders.some((f) => f.name === "bookings"), grid.folders.map((f) => f.name).join(", "));
  // Sans technologie non lue, la carte noire porte le constat le plus grave.
  assert.equal(overviewHero(map)?.lead, "GET /admin/export");
  assert.equal(sidebarCounts(map).acces?.n, 1);
});
