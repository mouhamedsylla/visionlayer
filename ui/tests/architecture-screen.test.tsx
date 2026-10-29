import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchitectureScreen } from "../src/screens/architecture/ArchitectureScreen";
import { atelierMap } from "./atelier";

describe("écran Architecture", async () => {
  const map = await atelierMap();
  const project = { name: "atelier-api", branch: "main", commit: "a41c9e2" };

  it("montre le bandeau, la carte et ce qu'il faut vérifier", () => {
    render(<ArchitectureScreen project={project} map={map} params={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Architecture" })).toBeTruthy();
    expect(screen.getByText("1 app · 1 service · 1 worker")).toBeTruthy();
    expect(screen.getByRole("button", { name: /api/ })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "Express" }).length).toBeGreaterThan(0);
    const reach = screen.getByRole("region", { name: "Comment ça communique" });
    expect(within(reach).getByText("3 services externes : Serveur SMTP, Resend et Stripe")).toBeTruthy();
    const side = screen.getByRole("complementary", { name: "Ce que cette architecture implique" });
    expect(within(side).getByText("Le plus long trajet traverse 5 blocs.")).toBeTruthy();
    expect(within(side).getByText("1 file entre les blocs : emails.")).toBeTruthy();
    expect(within(side).getByText("points d'entrée jamais appelés")).toBeTruthy();
    expect(within(side).getByRole("link", { name: /voir qui lit et écrit chaque table/ }).getAttribute("href")).toBe("#/donnees/postgres");
  });

  it("au clic sur un bloc, dit à qui il parle et ce qu'il faut y vérifier", () => {
    render(<ArchitectureScreen project={project} map={map} params={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /service · Express\s*api/ }));
    const panel = screen.getByRole("complementary", { name: "api" });
    expect(within(panel).getByText("Il va vers · 3")).toBeTruthy();
    expect(within(panel).getByText("lit 7")).toBeTruthy();
    expect(within(panel).getByText("écrit 9")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "← Tout le système" }));
    expect(screen.getByRole("complementary", { name: "Ce que cette architecture implique" })).toBeTruthy();
  });
});
