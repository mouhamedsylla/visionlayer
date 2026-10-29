import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { entryGroups, findEntry, reachOf, refusalsOf } from "../src/domain/features/list";
import { stepView, traceFailures, traceLanes } from "../src/domain/features/trace";
import { sentence } from "../src/domain/text/sentence";
import { FeaturesScreen } from "../src/screens/features/FeaturesScreen";
import { atelierMap } from "./atelier";

describe("Features, sur atelier-api", async () => {
  const map = await atelierMap();
  const { model } = map;
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const pay = findEntry(model, "api:http:POST /payments")!;
  const expire = findEntry(model, "api:schedule:* * * * *")!;
  const project = { name: "atelier-api" };
  afterEach(() => vi.unstubAllGlobals());

  it("range les points d'entrée en regroupements proposés : les routes par ressource, puis ce qui tourne sans clic", () => {
    const groups = entryGroups(model);
    expect(groups.map((g) => `${g.title} ${g.entries.length}`)).toEqual([
      "/webhooks 1", "/auth 3", "/workshops 2", "/bookings 4", "/payments 2", "/reviews 1", "/admin 1", "/healthz 1", "Tâches planifiées 3", "Files écoutées 1",
    ]);
  });

  it("calcule ce qu'un point d'entrée atteint et ses refus, depuis son déroulé", () => {
    expect(reachOf(pay.entry, names)).toEqual({ tables: ["users", "sessions", "bookings", "payments"], topics: [], services: ["Stripe"] });
    expect(refusalsOf(pay.entry)).toEqual(["401 unauthenticated", "404 not_found", "409 not_pending", "410 hold_expired", "502 payment_unavailable"]);
  });

  it("pose les couloirs dans l'ordre où le déroulé touche chaque bloc, et dit chaque étape avec ses faits", () => {
    expect(traceLanes(pay, model, names).map((l) => l.title)).toEqual(["web", "createPayment", "postgres", "Stripe"]);
    const titles = pay.entry.flow!.map((s) => stepView(s, "api", names).title);
    expect(titles.slice(5, 9)).toEqual(["Lit bookings", "Refuse 404 · not_found", "Refuse 409 · not_pending", "Refuse 410 · hold_expired"]);
    expect(titles).toContain("Appelle Stripe · paymentIntents.create");
    expect(stepView(pay.entry.flow!.find((s) => s.onError)!, "api", names).when).toBe("si l'appel juste au-dessus échoue");
  });

  it("dit ce qui se passe si ça rate : refus sur erreur et constats posés sur les lignes du déroulé, rien d'une autre route", () => {
    expect(traceFailures(pay, model).map((f) => f.type)).toEqual(["erreur", "panne"]);
    expect(traceFailures(expire, model).map((f) => f.type)).toEqual(["planifié", "courses", "panne"]);
  });

  it("garde un nom tiré du code tel qu'écrit en tête de phrase", () => {
    expect(sentence("expireHolds lit des lignes")).toBe("expireHolds lit des lignes");
    expect(sentence("la connexion à postgres")).toBe("La connexion à postgres");
  });

  it("liste les points d'entrée, chacun menant à son déroulé", () => {
    render(<FeaturesScreen project={project} map={map} params={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Features" })).toBeTruthy();
    expect(screen.getByText("points d'entrée sans feature")).toBeTruthy();
    const link = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "#/features/api%3Ahttp%3APOST%20%2Fpayments")!;
    expect(within(link).getByText("createPayment")).toBeTruthy();
  });

  it("trace POST /payments en couloirs, et montre le code d'une étape au clic", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ path: "src/payments/create.ts", from: 28, lines: ["  // Un double clic ne doit jamais débiter deux fois (EX-4) :"] })));
    vi.stubGlobal("fetch", fetch);
    render(<FeaturesScreen project={project} map={map} params={["api:http:POST /payments"]} />);
    expect(screen.getByRole("heading", { level: 1, name: "createPayment" })).toBeTruthy();
    expect(screen.getByText(/Appelée par web/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /paymentIntents\.create/ }));
    expect(await screen.findByText("// Un double clic ne doit jamais débiter deux fois (EX-4) :", { exact: false })).toBeTruthy();
    expect(screen.getByText("Si ça rate · 2")).toBeTruthy();
  });
});
