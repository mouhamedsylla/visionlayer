import { describe, expect, it } from "vitest";
import type { ArchModelV2 } from "../src/api/types";
import { lexiconOf, techPieces } from "../src/domain/text/techMarks";

const marks = (text: string, lex?: Map<string, never>) => techPieces(text, lex).filter((p) => p.kind).map((p) => `${p.kind}:${p.text}`);

describe("Marquer les termes techniques d'une phrase, par leur forme", () => {
  it("une route, avec ou sans guillemets, et ses codes de réponse", () => {
    expect(marks("« DELETE /orders/{id} » : gardée par une connexion (401), sans rôle (403)")).toEqual(["route:DELETE /orders/{id}", "status:401", "status:403"]);
    expect(marks("appelle GET /health, puis s'arrête")).toEqual(["route:GET /health"]);
  });

  it("les noms de code, les variables, les fichiers et les valeurs citées", () => {
    expect(marks("`sync` lit orders.state puis appelle sendMail() ; « draft » n'est jamais écrit")).toEqual(["code:sync", "code:orders.state", "code:sendMail()", "value:draft"]);
    expect(marks("lit DATABASE_URL dans src/config/env.py:12")).toEqual(["env:DATABASE_URL", "file:src/config/env.py:12"]);
  });

  it("garde le texte courant intact, mot pour mot", () => {
    const text = "la connexion à la base n'a aucun délai maximum : les requêtes attendent sans fin";
    expect(techPieces(text)).toEqual([{ text }]);
  });

  it("reconnaît les noms du modèle, quel que soit le projet", () => {
    const model = {
      version: 2, system: { name: "s" }, edges: [], findings: [], coverage: [],
      nodes: [
        { id: "a", name: "billing", level: "deployable", role: "service", status: "read", proof: [], facets: { config: { env: [{ name: "STRIPE_KEY", readAt: [] }] } } },
        { id: "b", name: "mongo", level: "deployable", role: "store", status: "read", proof: [], facets: { data: { shape: "document", entities: [{ name: "invoices" }] } } },
        { id: "c", name: "jobs", level: "deployable", role: "channel", status: "read", proof: [], facets: { channel: { shape: "queue", topics: [{ name: "invoice-ready", proof: { path: "q.ts", line: 1 } }] } } },
      ],
    } as unknown as ArchModelV2;
    const lex = lexiconOf(model) as Map<string, never>;
    expect(marks("billing écrit dans invoices puis publie « invoice-ready » sur jobs", lex)).toEqual(["block:billing", "table:invoices", "queue:invoice-ready", "block:jobs"]);
  });
});
