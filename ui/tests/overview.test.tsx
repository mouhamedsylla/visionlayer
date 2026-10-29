import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { miniMap } from "../src/domain/overview/minimap";
import { findingSubject, pointRows } from "../src/domain/overview/points";
import { overviewStats } from "../src/domain/overview/stats";
import { OverviewScreen } from "../src/screens/overview/OverviewScreen";
import { atelierMap } from "./atelier";

describe("Vue d'ensemble, sur atelier-api", async () => {
  const map = await atelierMap();
  const { model, tech } = map;
  const project = { name: "atelier-api", branch: "main", lastChange: { commit: "132ddd9", subject: "un changement" } };

  it("compte les blocs, les points d'entrée, les tables et les technologies sur la carte", () => {
    expect(overviewStats(model, tech).map((s) => `${s.value} ${s.label}`)).toEqual([
      "8 · 9 blocs · liens, chacun à sa ligne",
      "19 points d'entrée · 5 sans clic",
      "14 tables · 1 stockage",
      "11 technologies · 3 services externes",
    ]);
  });

  it("range la carte réduite en trois couloirs, sans répéter un nom dans sa nature", () => {
    const { nodes } = miniMap(model, tech);
    const kind = (id: string) => nodes.find((n) => n.id === id)!.kind;
    expect(kind("api")).toBe("service · 18 entrées");
    expect(kind("postgres")).toBe("14 tables");
    expect(kind("redis")).toBe("file · emails");
    expect(kind("resend")).toBe("externe");
    expect(new Set(nodes.map((n) => n.x)).size).toBe(3);
  });

  it("une ligne par nature de point, les plus nombreuses d'abord", () => {
    const rows = pointRows(model.findings);
    expect(rows[0]!.label).toBe("5 points d'entrée jamais appelés");
    expect(rows.reduce((n, r) => n + r.findings.length, 0)).toBe(model.findings.length);
  });

  it("nomme le sujet d'un constat quand la phrase le cite", () => {
    expect(findingSubject("« POST /auth/reset » : aucun code du dépôt n'appelle cette route")).toBe("POST /auth/reset");
    expect(findingSubject("users.role accepte « admin », que rien n'écrit")).toBe("users.role");
    expect(findingSubject("expireHolds lit des lignes de bookings")).toBe("expireHolds");
    expect(findingSubject("la connexion à postgres n'a aucun délai maximum")).toBeUndefined();
  });

  it("montre le système, le premier point ouvert, et dit ce qui n'est pas relié", () => {
    render(<OverviewScreen project={project} map={map} params={[]} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Le système d'atelier-api,tel qu'il tournesur main.");
    expect(screen.getByText("Aucun outil relié")).toBeTruthy();
    expect(screen.getByText("5 points d'entrée jamais appelés.")).toBeTruthy();
    expect(screen.getByText(/La comparaison commence à la prochaine mise à jour/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /1 lecture puis écriture sans revérifier/ }));
    expect(screen.getByText("1 lecture puis écriture sans revérifier.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rien n'est signalé non lu" }));
    expect(screen.getByText("fichiers de code lus")).toBeTruthy();
  });
});
