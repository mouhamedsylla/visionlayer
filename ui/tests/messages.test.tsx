import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findEntry } from "../src/domain/features/list";
import { dayRuns } from "../src/domain/messages/day";
import { backgroundFacts } from "../src/domain/messages/facts";
import { backgroundEntries, branchesOf, doesLabel, envOf, producersOf, whenLabel } from "../src/domain/messages/triggers";
import { MessagesScreen } from "../src/screens/messages/MessagesScreen";
import { atelierMap } from "./atelier";

describe("Messages, sur atelier-api", async () => {
  const map = await atelierMap();
  const { model } = map;
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const hook = findEntry(model, "api:http:POST /webhooks/stripe")!;
  const queue = findEntry(model, "worker:message:emails")!;
  const project = { name: "atelier-api" };
  afterEach(() => vi.unstubAllGlobals());

  it("place une expression cron sur la journée, et ne devine pas celle qu'il ne sait pas lire", () => {
    expect(dayRuns("0 3 * * *")).toEqual({ times: [180], someDays: false });
    expect(dayRuns("* * * * *")).toMatchObject({ every: 1, spans: [[0, 1440]] });
    expect(dayRuns("*/30 9-17 * * 1-5")?.times.slice(0, 3)).toEqual([540, 570, 600]);
    expect(dayRuns("*/30 9-17 * * 1-5")?.someDays).toBe(true);
    expect(dayRuns("@daily")).toBeUndefined();
  });

  it("trouve ce qui tourne sans clic : les tâches planifiées, la file, puis le webhook signé", () => {
    const entries = backgroundEntries(model);
    expect(entries.map((x) => x.entry.handler?.name)).toEqual(["expireHolds", "sendReminders", "purgeSessions", "sendEmail", "stripeWebhook"]);
    expect(entries.map((x) => whenLabel(x.entry, model, names))).toEqual([
      "chaque minute", "chaque jour à 8 h", "chaque jour à 3 h", "un job dans la file emails", "quand Stripe envoie",
    ]);
    expect(doesLabel(entries[0]!.entry, names)).toBe("lit bookings · écrit bookings, slots");
  });

  it("dit dans le bandeau ce qui part deux fois, d'après les exemplaires déclarés au déploiement", () => {
    const facts = backgroundFacts(backgroundEntries(model), model, names);
    expect(facts.map((f) => `${f.question} : ${f.answer}`)).toEqual([
      "Tâches planifiées : 3", "Files écoutées : 1 : emails", "Événements reçus : Stripe · 3 branches",
      "Lancées plusieurs fois : les 3 tâches planifiées", "Ce qu'on ne sait pas : si elles ont tourné",
    ]);
    expect(facts[3]!.detail).toBe("api tourne en 2 exemplaires · fly.toml");
  });

  it("lit autour d'un trajet : les branches telles qu'écrites, qui met en file, les variables par leur nom", () => {
    expect(branchesOf(hook.entry).map((b) => b.name)).toEqual(["confirmBooking", "markPaymentFailed", "markRefunded"]);
    expect(branchesOf(hook.entry)[2]!.when).toBe('event.type === "charge.refunded"');
    expect(envOf(hook).map((v) => v.name)).toContain("STRIPE_WEBHOOK_SECRET");
    expect(envOf(hook).find((v) => v.name === "STRIPE_WEBHOOK_SECRET")!.at.map((p) => p.path)).toEqual(["src/webhooks/stripe.ts"]);
    expect(producersOf(queue.entry, model).flatMap((p) => p.entrypoints)).toContain("api:schedule:0 8 * * *");
  });

  it("montre la journée, les déclencheurs et le panneau du premier", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ path: "src/jobs/index.ts", from: 11, lines: ["  cron.schedule(\"* * * * *\", run(\"expireHolds\", expireHolds));"] }))));
    render(<MessagesScreen project={project} map={map} params={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Ce qui tourne sans que personne clique" })).toBeTruthy();
    expect(screen.getByText("5 déclencheurs")).toBeTruthy();
    expect(screen.getByText("Lancé par chaque exemplaire · ×2")).toBeTruthy();
  });

  it("trace le trajet d'un événement Stripe en couloirs, avec ses branches à côté", () => {
    render(<MessagesScreen project={project} map={map} params={["api:http:POST /webhooks/stripe"]} />);
    expect(screen.getByRole("heading", { level: 2, name: /Le trajet d'un événement Stripe/ })).toBeTruthy();
    const branches = screen.getByRole("button", { name: /Branches lues/ });
    expect(branches.textContent).toBe("Branches lues3");
    expect(screen.getByText("markRefunded()")).toBeTruthy();
  });
});
