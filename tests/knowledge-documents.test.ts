import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesOf } from "../vision/knowledge/documents.js";

test("règles d'un document : les puces d'une section Règles, Rules ou Invariants, telles qu'écrites", () => {
  const md = [
    "# Projet", "", "- pas une règle", "",
    "## Règles métier", "", "- Une réservation non payée est libérée après **15 minutes**.", "* Un client n'a qu'une `réservation` active.", "",
    "### Détail", "- une sous-section reste dans la section", "",
    "```", "- dans un bloc de code", "```",
    "## Déploiement", "- pas une règle non plus",
    "## Business rules", "- Refunds go back to the [card](x.md).",
  ].join("\n");
  assert.deepEqual(rulesOf("README.md", md).map((r) => `${r.line} ${r.section}: ${r.text}`), [
    "7 Règles métier: Une réservation non payée est libérée après 15 minutes.",
    "8 Règles métier: Un client n'a qu'une réservation active.",
    "11 Règles métier: une sous-section reste dans la section",
    "19 Business rules: Refunds go back to the card.",
  ]);
});
