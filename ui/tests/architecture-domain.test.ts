import { describe, expect, it } from "vitest";
import { columnOf } from "../src/domain/architecture/columns";
import { kindLabel } from "../src/domain/architecture/describe";
import { architectureFacts } from "../src/domain/architecture/facts";
import { groupFindings } from "../src/domain/architecture/findings";
import { implications } from "../src/domain/architecture/implications";
import { NODE_SIZE, layoutMap } from "../src/domain/architecture/layout";
import { linkLabel, mapLinks, mapNodes } from "../src/domain/architecture/links";
import { atelierMap } from "./atelier";

describe("architecture, sur atelier-api", async () => {
  const { model, tech } = await atelierMap();
  const nodes = mapNodes(model);
  const links = mapLinks(model);

  it("montre les blocs, pas les composants qu'ils contiennent", () => {
    expect(nodes.map((n) => n.id).sort()).toEqual(["api", "nodemailer", "postgres", "redis", "resend", "stripe", "web", "worker"]);
  });

  it("range chaque bloc dans son couloir", () => {
    const byColumn = (c: string) => nodes.filter((n) => columnOf(n.role) === c).map((n) => n.id).sort();
    expect(byColumn("opened")).toEqual(["web"]);
    expect(byColumn("server")).toEqual(["api", "worker"]);
  });

  it("regroupe les liens d'une paire et les compte par nature", () => {
    const db = links.find((l) => l.id === "api->postgres")!;
    expect(db.kinds).toEqual({ read: 7, write: 9 });
    expect(linkLabel(db)).toBe("lit 7 · écrit 9");
  });

  it("nomme un bloc par la technologie qui le fait tourner", () => {
    const label = (id: string) => kindLabel(nodes.find((n) => n.id === id)!, tech);
    expect(label("api")).toBe("service · Express");
    expect(label("web")).toBe("app · React");
    expect(label("postgres")).toBe("base · PostgreSQL");
  });

  it("place les blocs sans qu'ils se chevauchent", () => {
    const placed = [...layoutMap(nodes, links).placed.values()];
    for (const a of placed) for (const b of placed) {
      if (a.id === b.id || a.x !== b.x) continue;
      expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(NODE_SIZE.height);
    }
  });

  it("calcule le bandeau à partir de la carte, sans rien inventer", () => {
    const facts = Object.fromEntries(architectureFacts(model, links, tech).map((f) => [f.question, f]));
    expect(facts["Ce qui tourne"]!.answer).toBe("1 app · 1 service · 1 worker");
    expect(facts["Ce qui tourne"]!.detail).toBe("api : 15 routes, 3 tâches planifiées · worker : 1 file écoutée");
    expect(facts["Ce qui tourne"]!.visual).toEqual({ type: "logos", items: [
      { tech: "react", caption: "web" }, { tech: "express", caption: "api ×2" }, { tech: "bullmq", caption: "worker" },
    ] });
    expect(facts["Comment ça communique"]!.visual).toMatchObject({ type: "bar", parts: [{ label: "appels", value: 12 }, { label: "mise en file", value: 1 }, { label: "lectures", value: 11 }, { label: "écritures", value: 10 }] });
    expect(facts["Où sont les données"]!.answer).toBe("1 base · 1 file");
    expect(facts["Où sont les données"]!.detail).toBe("lues ou écrites par api et worker");
    expect(facts["Ce qu'il faut vérifier"]!.answer).toBe(`${model.findings.length} points`);
    expect(facts["Ce qu'on ne sait pas"]!.answer).toBe("rien n'est signalé non lu");
    expect(facts["Ce qu'on ne sait pas"]!.visual).toMatchObject({ type: "meter" });
  });

  it("range les constats par nature, les plus nombreux d'abord", () => {
    const groups = groupFindings(model.findings);
    expect(groups[0]!.label).toBe("5 points d'entrée jamais appelés");
  });
});

describe("implications, sur atelier-api", async () => {
  const { model, tech } = await atelierMap();
  const links = mapLinks(model);

  it("trouve le plus long trajet, la file, la base partagée, les services externes et les tâches doublées", () => {
    const items = implications(model, links, tech, (s, ...p) => `#/${[s, ...p].join("/")}`);
    expect(items.map((i) => i.title)).toEqual([
      "Le plus long trajet traverse 5 blocs.",
      "1 file entre les blocs : emails.",
      "postgres garde 14 tables.",
      "3 services hors du dépôt.",
      "api tourne en 2 exemplaires.",
    ]);
    expect(items[0]!.text).toMatch(/^web → api → redis → worker → /);
  });
});
