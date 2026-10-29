import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdentityScreen } from "../src/screens/identity/IdentityScreen";
import { atelierMap } from "./atelier";

describe("Écran Identité, sur atelier-api", async () => {
  const map = await atelierMap();
  afterEach(() => vi.unstubAllGlobals());
  const source = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ path: "src/auth/session.ts", from: 1, lines: ["export async function requireUser() {}"] }))));

  it("range les routes par garde, et ouvre la garde la plus employée", async () => {
    source();
    render(<IdentityScreen project={{ name: "atelier-api" }} map={map} params={[]} />);
    for (const level of ["Ouvert à tous", "Signé par un service", "Connecté", "Rôle exigé"]) expect(screen.getByRole("region", { name: level })).toBeTruthy();
    const role = screen.getByRole("region", { name: "Rôle exigé" });
    expect(within(role).getByText("requireAdmin()")).toBeTruthy();
    expect(within(role).getByText("403 · forbidden")).toBeTruthy();
    expect(await screen.findByRole("complementary", { name: "requireUser" })).toBeTruthy();
  });

  it("montre où l'on obtient sa preuve, puis comment chaque appel est reconnu", () => {
    source();
    render(<IdentityScreen project={{ name: "atelier-api" }} map={map} params={[]} />);
    expect(screen.getByRole("region", { name: "Où l'on obtient sa preuve d'identité" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Comment requireUser reconnaît l'appelant" })).toBeTruthy();
    const proof = screen.getByRole("region", { name: "La preuve d'identité" });
    expect(within(proof).getByText("purgeSessions()")).toBeTruthy();
  });

  it("ouvre une route : sa garde et ce qu'elle vérifie elle-même", async () => {
    source();
    render(<IdentityScreen project={{ name: "atelier-api" }} map={map} params={["api:http:GET /bookings/:id"]} />);
    const panel = await screen.findByRole("complementary", { name: "GET /bookings/:id" });
    expect(within(panel).getByText("404 · not_found")).toBeTruthy();
  });
});
