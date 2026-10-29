import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataScreen } from "../src/screens/data/DataScreen";
import { atelierMap } from "./atelier";

describe("écran Données", async () => {
  const map = await atelierMap();
  const project = { name: "atelier-api" };
  afterEach(() => vi.unstubAllGlobals());

  it("montre une ligne par table, une colonne par acteur, et ce qu'il faut savoir", () => {
    render(<DataScreen project={project} map={map} params={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "postgres · 14 tables" })).toBeTruthy();
    // 14 tables, 3 sections du schéma, l'en-tête.
    expect(screen.getAllByRole("row")).toHaveLength(18);
    expect(screen.getByText("réservations et paiements · 6")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /cycle/ }).map((a) => a.getAttribute("href"))).toEqual([
      "#/donnees/postgres/bookings/cycle", "#/donnees/postgres/payments/cycle", "#/donnees/postgres/refunds/cycle",
    ]);
    expect(screen.getByRole("columnheader", { name: /expireHolds/ })).toBeTruthy();
    const glance = screen.getByRole("button", { name: /À savoir/ });
    expect(within(glance).getByText("3 à aller voir")).toBeTruthy();
    fireEvent.click(glance);
    const notes = screen.getByRole("dialog", { name: "À savoir" });
    expect(within(notes).getByText("tables sans contrôle").previousElementSibling!.textContent).toBe("10");
    const audit = screen.getByRole("button", { name: "audit_log" }).closest("tr")!;
    expect(within(audit).getByText("écrite par audit_bookings")).toBeTruthy();
    const side = screen.getByRole("complementary", { name: "postgres" });
    expect(within(side).getByText(/la connexion à postgres n'a aucun délai maximum/)).toBeTruthy();
  });

  it("au clic sur une table, montre sa déclaration, ce que la base refuse et qui l'écrit", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      path: "src/db/schema.ts", from: 69, lines: ["", "", "// Seule l'API écrit ici : jamais l'app web, jamais le worker.", "export const payments = pgTable(\"payments\", {"],
    })));
    vi.stubGlobal("fetch", fetch);
    render(<DataScreen project={project} map={map} params={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "payments" }));
    const panel = screen.getByRole("complementary", { name: "payments" });
    expect(within(panel).getByText(/La base refuse deux lignes avec le même intent_id/)).toBeTruthy();
    expect(within(panel).getByText("Lu dans le code : seul api écrit ici.")).toBeTruthy();
    expect(within(panel).getByText("Lue par · 1 · écrite par · 1")).toBeTruthy();
    expect(within(panel).getByText("createPayment")).toBeTruthy();
    expect(await within(panel).findByText("« Seule l'API écrit ici : jamais l'app web, jamais le worker. »")).toBeTruthy();
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain("path=src%2Fdb%2Fschema.ts");
  });

  it("ouvre la table donnée par l'adresse", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    render(<DataScreen project={project} map={map} params={["postgres", "bookings"]} />);
    const panel = screen.getByRole("complementary", { name: "bookings" });
    expect(within(panel).getByText("à chaque mise à jour, écrit audit_log")).toBeTruthy();
  });

  it("le cycle de vie d'une table : ses états, puis chaque écriture avec ce qui la déclenche", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    render(<DataScreen project={project} map={map} params={["postgres", "bookings", "cycle"]} />);
    expect(screen.getByRole("heading", { level: 1, name: "bookings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Cycle de vie/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("déclaré dans le schéma, écrit nulle part")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /écrit status/ })).toHaveLength(6);
    expect(screen.getByRole("button", { name: /expireHolds écrit status cancelled/ })).toBeTruthy();
  });

  it("dit quand la carte n'a aucune donnée", () => {
    const empty = structuredClone(map);
    for (const n of empty.model.nodes) delete n.facets.data;
    render(<DataScreen project={project} map={empty} params={[]} />);
    expect(screen.getByText("Aucune donnée lue")).toBeTruthy();
  });
});
