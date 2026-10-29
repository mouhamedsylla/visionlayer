import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeploySource } from "../../vision/web/deploy-source";
import { jobColumns } from "../src/domain/deploy/chain";
import { deployFacts } from "../src/domain/deploy/facts";
import { deployParts } from "../src/domain/deploy/parts";
import { DeployScreen } from "../src/screens/deploy/DeployScreen";
import { atelierMap } from "./atelier";

describe("Déploiement, sur atelier-api", async () => {
  const map = await atelierMap();
  const payload = await new DeploySource(join(import.meta.dirname, "..", "..", "tests", "corpus", "atelier-api")).get(map.builtAt);
  const parts = deployParts(map.model, payload);
  const part = (id: string) => parts.find((p) => p.node.id === id)!;
  afterEach(() => vi.unstubAllGlobals());

  it("dit de chaque partie quel manifeste la déclare, combien et où, sans compter une page web comme hébergement", () => {
    expect(part("api").declared.map((d) => `${d.name} ${d.proof.path}:${d.proof.line}`)).toEqual(["Fly.io fly.toml:7", "Docker Compose docker-compose.yml:13"]);
    expect(part("api").node.instances?.min).toBe(2);
    expect(part("worker").node.attributes?.map((a) => `${a.key}=${a.value}`)).toEqual(["region=cdg"]);
    expect(part("web").declared).toEqual([]);
    expect(part("web").seenIn.map((d) => d.proof.path)).toEqual(["web/index.html"]);
  });

  it("lit la chaîne de livraison telle qu'écrite : le workflow teste, aucune étape ne déploie", () => {
    const ci = payload.deploy.pipelines[0]!;
    expect(jobColumns(ci).map((c) => c.map((j) => j.id))).toEqual([["test"]]);
    expect(part("api").shippedBy).toEqual([]);
    const facts = deployFacts(parts, payload);
    expect(facts.find((f) => f.question === "Chaîne de livraison")).toMatchObject({ answer: "1 workflow · 0 déploiement", attention: true });
    expect(facts.find((f) => f.question === "Environnements")!.answer).toBe("aucun nommé");
  });

  it("ouvre d'abord la partie dont aucun fichier ne dit où elle tourne", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload))));
    render(<DeployScreen project={{ name: "atelier-api" }} map={map} params={[]} />);
    const panel = await screen.findByRole("complementary", { name: "Déploiement de web" });
    expect(within(panel).getByText(/VisionLayer n'invente pas de réponse/)).toBeTruthy();
    expect(screen.getByRole("article", { name: "job test" })).toBeTruthy();
  });
});
