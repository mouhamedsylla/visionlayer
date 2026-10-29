import { render, screen, within } from "@testing-library/react";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KnowledgeSource } from "../../vision/web/knowledge-source";
import { coverageFacts } from "../src/domain/coverage/facts";
import { coverageGaps } from "../src/domain/coverage/gaps";
import { measure, partCovers } from "../src/domain/coverage/measure";
import { CoverageScreen } from "../src/screens/coverage/CoverageScreen";
import { atelierMap } from "./atelier";

describe("Couverture, sur atelier-api (aucune note déclarée)", async () => {
  const map = await atelierMap();
  const payload = new KnowledgeSource(join(import.meta.dirname, "..", "..", "tests", "corpus", "atelier-api")).get(map.model, map.builtAt);
  const m = measure(map.model, payload.report);
  afterEach(() => vi.unstubAllGlobals());

  it("compte ce que la carte permet de rattacher et d'expliquer, sans rien inventer", () => {
    expect(m.claims).toEqual([]);
    expect(m.entries.every((e) => !e.attached)).toBe(true);
    expect(m.refusals.filter((r) => r.explained).length).toBe(4);
    expect(m.tables.every((t) => t.read)).toBe(true);
    const facts = coverageFacts(map.model, m, payload);
    expect(facts.find((f) => f.question === "Notes")).toMatchObject({ answer: "aucune" });
    expect(facts.find((f) => f.question === "Code lu")!.answer).toBe("63 sur 63 fichiers");
  });

  it("range les trous : un point d'entrée qui écrit passe devant un refus muet", () => {
    const gaps = coverageGaps(map.model, m);
    expect(gaps[0]!.tag).toBe("point d'entrée sans feature");
    expect(gaps[0]!.detail).toMatch(/écrit des données/);
    expect(gaps.findIndex((g) => g.tag === "refus sans explication")).toBeGreaterThan(gaps.map((g) => g.risk).lastIndexOf(3));
  });

  it("donne une ligne par partie qui a du code, et dit quand il n'y a rien à compter", () => {
    const api = partCovers(map.model, m).find((p) => p.node.id === "api")!;
    expect(api.notes).toEqual([0, 0]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload))));
    render(<CoverageScreen project={{ name: "atelier-api" }} map={map} params={[]} />);
    return screen.findByRole("region", { name: "Par partie du système" }).then((table) => {
      expect(within(table).getAllByText("rien à compter").length).toBeGreaterThan(0);
      expect(screen.getByRole("complementary", { name: "Couverture" }).textContent).toMatch(/Aucune note déclarée/);
    });
  });
});
