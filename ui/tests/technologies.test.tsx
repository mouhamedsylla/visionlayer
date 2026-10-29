import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StackSource } from "../../vision/web/stack-source";
import { techDetail } from "../src/domain/technologies/detail";
import { techFacts } from "../src/domain/technologies/facts";
import { techGroups } from "../src/domain/technologies/groups";
import { TechnologiesScreen } from "../src/screens/technologies/TechnologiesScreen";
import { atelierMap } from "./atelier";

describe("Technologies, sur atelier-api", async () => {
  const map = await atelierMap();
  const payload = new StackSource(join(import.meta.dirname, "..", "..", "tests", "corpus", "atelier-api")).get(map.builtAt);
  const { stack } = payload;
  const stripe = stack.technologies.find((t) => t.id === "stripe")!;
  afterEach(() => vi.unstubAllGlobals());

  it("range par famille, les services externes à part, d'après les blocs externes de la carte", () => {
    const groups = techGroups(stack, map.model);
    const ext = groups.find((g) => g.title === "Services externes")!;
    expect(ext.tiles.map((t) => t.name)).toEqual(["Nodemailer", "Resend", "Stripe"]);
    expect(groups.find((g) => g.title === "Serveur et API")!.tiles.map((t) => t.name)).not.toContain("Stripe");
    expect(groups.find((g) => g.title === "Langages et exécution")!.tiles.find((t) => t.id === "typescript")!.where).toBe("60 fichiers .ts .tsx");
  });

  it("dit d'un service externe où il est appelé, par quel bloc, et les variables lues là, noms seulement", () => {
    const d = techDetail(stripe, map.model);
    expect(d.blocks.map((b) => b.name)).toEqual(["api"]);
    expect(d.calls.length).toBe(5);
    expect(d.declared[0]).toMatchObject({ where: "package.json:29", proof: { path: "package.json", line: 29 } });
    expect(d.vars.map((v) => v.name).sort()).toEqual(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "VITE_STRIPE_PUBLISHABLE_KEY"]);
  });

  it("compte au bandeau ce qui est lu, sans rien inventer", () => {
    const facts = techFacts(stack, map.model);
    expect(facts[1]!.answer).toBe("3 : Nodemailer, Resend et Stripe");
    expect(facts[1]!.detail).toBe("appelés par api et worker");
  });

  it("ouvre une technologie : ses tuiles par famille, son panneau avec la ligne qui la déclare", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload))));
    render(<TechnologiesScreen project={{ name: "atelier-api" }} map={map} params={["stripe"]} />);
    const tile = await screen.findByRole("link", { current: true });
    expect(tile.getAttribute("href")).toBe("#/technologies/stripe");
    const panel = screen.getByRole("complementary", { name: "Stripe" });
    expect(within(panel).getByText("service externe")).toBeTruthy();
    expect(within(panel).getAllByText("package.json:29").length).toBeGreaterThan(0);
  });
});
