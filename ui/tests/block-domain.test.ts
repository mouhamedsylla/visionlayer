import { describe, expect, it } from "vitest";
import { effectChips, effectsOf } from "../src/domain/block/effects";
import { blockEntries, entryCounters, entryNature, isUncalled, triggeredBy } from "../src/domain/block/entries";
import { apiResources, guardLabel, splitRoute } from "../src/domain/block/resources";
import { cronLabel } from "../src/domain/text/cron";
import { atelierMap } from "./atelier";

describe("bloc, sur atelier-api", async () => {
  const { model } = await atelierMap();
  const api = model.nodes.find((n) => n.id === "api")!;
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const entry = (key: string) => blockEntries(api).find((e) => e.key === key)!;

  it("laisse le démarrage hors du tableau, garde les routes et les tâches", () => {
    const entries = blockEntries(api);
    expect(entries.some((e) => e.kind === "main")).toBe(false);
    expect(entries).toHaveLength(18);
  });

  it("compte par nature, puis ce qui n'est jamais appelé", () => {
    expect(entryCounters(api, model)).toEqual([
      { value: 1, label: "webhook" },
      { value: 14, label: "routes" },
      { value: 3, label: "tâches planifiées" },
      { value: 5, label: "jamais appelés", attention: true },
    ]);
  });

  it("dit qui déclenche : un bloc, un horaire, ou rien", () => {
    expect(entryNature(entry("POST /webhooks/stripe"))).toBe("webhook");
    expect(triggeredBy(entry("POST /webhooks/stripe"), names, model)).toEqual(["Stripe"]);
    expect(triggeredBy(entry("0 8 * * *"), names, model)).toEqual(["chaque jour à 8 h"]);
    const emails = model.nodes.find((n) => n.id === "worker")!.facets.entrypoints!.find((e) => e.kind === "message")!;
    expect(triggeredBy(emails, names, model)).toEqual(["redis"]);
    expect(isUncalled(entry("GET /admin/export"), model)).toBe(true);
    expect(isUncalled(entry("POST /payments"), model)).toBe(false);
  });

  it("donne les effets d'un point d'entrée, en pastilles", () => {
    const effects = effectsOf(entry("POST /payments").id, model);
    expect(effectChips(effects, names).map((c) => c.label)).toEqual(["lit", "écrit", "appelle Stripe"]);
    expect(effectChips(effects, names).find((c) => c.label === "écrit")!.detail).toBe("payments");
  });

  it("dit un horaire cron en mots, ou le laisse tel qu'écrit", () => {
    expect(cronLabel("* * * * *")).toBe("chaque minute");
    expect(cronLabel("*/5 * * * *")).toBe("toutes les 5 minutes");
    expect(cronLabel("30 3 * * 1")).toBe("chaque lundi à 3 h 30");
    expect(cronLabel("0 0 1 * *")).toBe("0 0 1 * *");
  });
});

describe("API rangée par ressource, sur atelier-api", async () => {
  const { model } = await atelierMap();
  const api = model.nodes.find((n) => n.id === "api")!;
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));

  it("découpe une route en méthode et segments, paramètres repérés", () => {
    expect(splitRoute("POST /bookings/:id/transfer")).toEqual({ method: "POST", segments: [
      { text: "bookings", param: false }, { text: ":id", param: true }, { text: "transfer", param: false },
    ] });
  });

  it("range les 15 routes en ressources, avec ce que chacune touche", () => {
    const resources = apiResources(blockEntries(api), model, names);
    expect(resources.map((r) => `${r.path} ${r.entries.length}`)).toEqual([
      "/webhooks 1", "/auth 3", "/workshops 2", "/bookings 4", "/payments 2", "/reviews 1", "/admin 1", "/healthz 1",
    ]);
    const payments = resources.find((r) => r.path === "/payments")!;
    expect(payments.writes).toEqual(["bookings", "payments", "refunds"]);
    expect(payments.calls).toEqual(["Stripe"]);
    expect(resources.find((r) => r.path === "/healthz")!.reads).toEqual([]);
  });

  it("ne dit une garde que si le code la montre", () => {
    const entries = blockEntries(api);
    expect(guardLabel(entries.find((e) => e.key === "POST /webhooks/stripe")!)).toBe("signature");
    expect(guardLabel(entries.find((e) => e.key === "GET /workshops")!)).toBe("publique");
    expect(guardLabel(entries.find((e) => e.key === "POST /bookings")!)).toBe("connexion");
    expect(guardLabel(entries.find((e) => e.key === "POST /payments/:id/refund")!)).toBe("rôle");
    // Une entrée qu'aucun pack ne sait garder ne se dit pas publique.
    expect(guardLabel(entries.find((e) => e.kind === "schedule")!)).toBeUndefined();
  });
});
