import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchitectureScreen } from "../src/screens/architecture/ArchitectureScreen";
import { atelierMap } from "./atelier";

describe("écran Bloc", async () => {
  const map = await atelierMap();
  const project = { name: "atelier-api" };

  it("montre le bandeau du bloc, ses points d'entrée et ce qui l'entoure", () => {
    render(<ArchitectureScreen project={project} map={map} params={["api"]} />);
    expect(screen.getByRole("heading", { level: 1, name: "api" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Architecture" }).getAttribute("href")).toBe("#/architecture");
    expect(screen.getByText("API · 15 routes en 8 ressources")).toBeTruthy();
    const bookings = screen.getByRole("region", { name: "/bookings" });
    expect(within(bookings).getByText("4 routes")).toBeTruthy();
    expect(within(bookings).getByText("createBooking")).toBeTruthy();
    expect(screen.getByText("Tourne sans clic · 3")).toBeTruthy();
    expect(screen.getByText("chaque jour à 8 h")).toBeTruthy();
    const side = screen.getByRole("complementary", { name: "Le bloc api" });
    expect(within(side).getByText("Il va vers · 3")).toBeTruthy();
  });

  it("au clic sur un point d'entrée, montre chaque effet et sa ligne", () => {
    render(<ArchitectureScreen project={project} map={map} params={["api"]} />);
    fireEvent.click(screen.getByRole("button", { name: "POST /payments" }));
    const panel = screen.getByRole("complementary", { name: "POST /payments" });
    expect(within(panel).getByText("écrit payments")).toBeTruthy();
    expect(within(panel).getByText("createPayment")).toBeTruthy();
  });

  it("dit qu'un point d'entrée n'est pas relié à sa fonction, au lieu d'une case vide", () => {
    const unlinked = structuredClone(map);
    for (const e of unlinked.model.nodes.find((n) => n.id === "worker")!.facets.entrypoints!) delete e.handler;
    render(<ArchitectureScreen project={project} map={unlinked} params={["worker"]} />);
    expect(screen.getByText("fonction non reliée")).toBeTruthy();
  });

  it("dit quand le bloc demandé n'existe pas", () => {
    render(<ArchitectureScreen project={project} map={map} params={["inconnu"]} />);
    expect(screen.getByText("Ce bloc n'est pas sur la carte")).toBeTruthy();
  });
});
