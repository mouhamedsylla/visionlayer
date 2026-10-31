import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import type { ArchModelV2 } from "../vision/arch/types.js";

const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");
const map = (base: FactBase): ArchModelV2 => assemble(base.database(), { name: "atelier-api", packs: [...base.packs] });
const schedules = (m: ArchModelV2) => m.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind === "schedule").map((e) => e.handler?.name).sort();

test("ADR 0019 : charger un pack à chaud donne la carte calculée avec lui ; le retirer donne celle d'avant, à l'identique", async () => {
  const all = await loadPacks();
  const without = all.filter((p) => p.id !== "node-cron");

  const full = new FactBase(ATELIER, all);
  full.refresh();
  const expectedFull = map(full);

  const base = new FactBase(ATELIER, without);
  base.refresh();
  const before = map(base);
  assert.deepEqual(schedules(before), []);

  // Chargé à chaud : seuls les fichiers que le pack concerne sont relus.
  const loaded = base.setPacks(all);
  assert.deepEqual(loaded.added, ["node-cron"]);
  const after = map(base);
  assert.deepEqual(schedules(after), ["expireHolds", "purgeSessions", "sendReminders"]);
  assert.deepEqual(after, expectedFull);

  // Retiré : la carte redevient exactement celle d'avant.
  const removed = base.setPacks(without);
  assert.deepEqual(removed.removed, ["node-cron"]);
  assert.deepEqual(map(base), before);
});
