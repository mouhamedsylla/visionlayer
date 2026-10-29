import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callerGroups, entryOf, findFunction, fnCounts, functionTree } from "../src/domain/code/functions";
import { fnLead } from "../src/domain/code/lead";
import { CodeScreen } from "../src/screens/code/CodeScreen";
import { atelierMap } from "./atelier";

describe("Code, sur atelier-api", async () => {
  const map = await atelierMap();
  const { model } = map;
  const project = { name: "atelier-api" };
  const guard = findFunction(model, "src/auth/session.ts:21")!;
  const create = findFunction(model, "src/bookings/create.ts:14")!;
  afterEach(() => vi.unstubAllGlobals());

  it("range les fonctions par bloc puis par fichier, dans l'ordre de la carte", () => {
    const tree = functionTree(model);
    expect(tree.map((b) => b.node.name)).toEqual(["worker", "api", "web"]);
    expect(tree[0]!.files.map((f) => f.path)).toEqual(["src/email/index.ts", "src/email/retry.ts", "src/email/worker.ts"]);
  });

  it("dit d'une fonction ce qu'elle est, qui la lance, et ses chiffres lus dans son propre code", () => {
    expect(fnCounts(guard.fn)).toEqual({ steps: 4, refusals: 2, callers: 8 });
    expect(fnLead(guard, entryOf(guard), fnCounts(guard.fn))).toBe("Fonction exportée, pas un point d'entrée : appelée par 8 lignes du dépôt. Son déroulé se lit comme celui d'un point d'entrée, en 4 étapes.");
    expect(entryOf(create)?.key).toBe("POST /bookings");
    expect(callerGroups(guard.fn).map((g) => g.name)).toContain("createBooking");
  });

  it("ouvre une fonction : ses étapes numérotées, la fonction qu'elle exécute à ouvrir, qui l'appelle", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ path: "src/bookings/create.ts", from: 14, lines: ["export async function createBooking() {"] }))));
    render(<CodeScreen project={project} map={map} params={["src/bookings/create.ts:14"]} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("createBooking");
    expect(screen.getByRole("link", { name: "ouvrir requireUser() →" }).getAttribute("href")).toBe("#/code/src%2Fauth%2Fsession.ts%3A21");
    const steps = screen.getAllByRole("button", { pressed: true });
    expect(steps[0]!.textContent).toContain("Refuse 404");
    fireEvent.click(screen.getByRole("button", { name: /Écrit bookings/ }));
    expect(screen.getByRole("button", { name: /Écrit bookings/ }).getAttribute("aria-pressed")).toBe("true");
    const panel = screen.getByRole("complementary", { name: "Autour de createBooking" });
    expect(within(panel).getByText("POST")).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "requireUser()" })).toBeTruthy();
  });

  it("liste les fonctions avec la route qu'elles portent et ce qu'elles touchent", () => {
    render(<CodeScreen project={project} map={map} params={[]} />);
    // deux createBooking : celle de l'API porte la route, celle du web l'appelle
    const row = screen.getAllByRole("link", { name: /createBooking\(\)/ }).find((a) => a.getAttribute("href")?.includes("create.ts"))!;
    expect(within(row).getByText("POST")).toBeTruthy();
    expect(within(row).getByText("bookings")).toBeTruthy();
  });
});
