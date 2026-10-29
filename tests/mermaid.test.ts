import { test } from "node:test";
import assert from "node:assert/strict";
import { toMermaid } from "../vision/graph/mermaid.js";
import type { SystemModel } from "../vision/model/types.js";

function model(overrides: Partial<SystemModel>): SystemModel {
  return { repository: { root: "/repo" }, files: [], dependencies: [], reExports: [], ...overrides };
}

test("toMermaid: un fichier sans dépendance produit juste un nœud", () => {
  const out = toMermaid(
    model({
      files: [{ path: "a.ts", language: "typescript", symbols: [] }],
    }),
  );
  assert.equal(out, 'flowchart TD\n    n0["a.ts"]\n');
});

test("toMermaid: dépendance interne relie deux nœuds fichiers existants", () => {
  const out = toMermaid(
    model({
      files: [
        { path: "a.ts", language: "typescript", symbols: [] },
        { path: "b.ts", language: "typescript", symbols: [] },
      ],
      dependencies: [{ from: "b.ts", to: "a.ts", raw: "./a", external: false }],
    }),
  );
  assert.match(out, /n0\["a\.ts"\]/);
  assert.match(out, /n1\["b\.ts"\]/);
  assert.match(out, /n1 --> n0/);
});

test("toMermaid: dépendance externe crée un nœud arrondi, une seule fois même si réutilisée", () => {
  const out = toMermaid(
    model({
      files: [
        { path: "a.ts", language: "typescript", symbols: [] },
        { path: "b.ts", language: "typescript", symbols: [] },
      ],
      dependencies: [
        { from: "a.ts", to: "zod", raw: "zod", external: true },
        { from: "b.ts", to: "zod", raw: "zod", external: true },
      ],
    }),
  );
  const occurrences = out.match(/\(\["zod"\]\)/g) ?? [];
  assert.equal(occurrences.length, 1, "le nœud externe 'zod' ne doit être déclaré qu'une fois");
});

test("toMermaid: deux imports distincts vers le même fichier ne dessinent qu'une seule arête", () => {
  // Cas trouvé en scannant examples/reference-project : `import { save }` et
  // `import type { Invitation }` depuis le même fichier produisent deux
  // DependencyFact identiques en from/to — corrects comme faits (deux
  // instructions existent bien), mais l'arête ne doit être dessinée qu'une
  // fois dans le graphe.
  const out = toMermaid(
    model({
      files: [
        { path: "a.ts", language: "typescript", symbols: [] },
        { path: "b.ts", language: "typescript", symbols: [] },
      ],
      dependencies: [
        { from: "a.ts", to: "b.ts", raw: "./b", external: false },
        { from: "a.ts", to: "b.ts", raw: "./b", external: false },
      ],
    }),
  );
  const occurrences = out.match(/n0 --> n1/g) ?? [];
  assert.equal(occurrences.length, 1);
});
