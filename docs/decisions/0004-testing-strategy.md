# ADR 0004 — Stratégie de test de VisionLayer

**Statut :** Accepté

## Contexte
VisionLayer produit des "faits" censés être déterministes et fiables (`vision-layer-concept.md` §6 — faits vs interprétations ; principe "Deterministic-first" et "Evidence-first", §35). Si les faits extraits sont faux, tout ce qui en dépend (contexte agent, diff d'architecture, rapport de changement) devient trompeur. La question posée en [architecture.md §6](../architecture.md) était : comment garantir que VisionLayer est testé sérieusement, pas juste "ça compile".

## Décision
**Corpus de repositories de test dédiés**, chacun construit autour de cas particuliers réels que VisionLayer doit gérer correctement, avec un résultat attendu (golden file) que l'extraction doit reproduire exactement.

## Rationale
- Un test unitaire classique sur des fonctions isolées ne suffit pas à valider un extracteur de faits structurels — il faut des repositories entiers, même petits, représentant des cas réels (dépendances circulaires, ré-exports, imports dynamiques, monorepo avec plusieurs packages, code mort, mélange de langages).
- Le principe "il faut mettre le paquet" se traduit concrètement par : chaque cas difficile identifié en usage réel sur un projet réel devient un nouveau repository de test permanent, jamais supprimé — le corpus grossit avec le temps, il ne se limite pas à un jeu initial figé.
- Aligné avec NIST SSDF PW.8 (tester le code exécutable pour identifier les défauts) et avec le test comparatif prévu en `vision-layer-concept.md` §39.

## Conséquences
- `workflow/tests/fixtures/<cas>/` contient un mini-repository + un fichier `expected.json` (le System Model attendu). Le test échoue si l'extraction réelle diverge du golden file.
- Premiers cas à couvrir dès le MVP0 : dépendance simple, dépendance circulaire, symbole non référencé, fichier avec syntaxe invalide (doit échouer proprement, pas planter).
- Toute divergence trouvée en usage réel sur un projet réel (un fait mal extrait) doit systématiquement produire un nouveau cas de test avant d'être corrigée — pas seulement un correctif silencieux.

## Application réelle — premier cas trouvé pendant le MVP0

En scannant VisionLayer avec lui-même (`pnpm run scan -- .`) dès la première implémentation, un cas réel est apparu avant même d'atteindre un projet réel : les imports internes écrits selon la convention TypeScript NodeNext/ESM (`import "./a.js"` alors que le fichier réel est `a.ts`) n'étaient pas résolus. Conformément à la règle ci-dessus, ce cas a été ajouté comme cinquième fixture (`tests/fixtures/esm-extension-resolution/`) **avant** de corriger l'extracteur, pas après. Preuve que le corpus grossit dès le premier contact avec du vrai code, sans attendre Nafar.

## Deuxième cas trouvé — dogfooding sur `examples/reference-project`

En scannant le projet de référence (plus réaliste que les fixtures minimales — plusieurs dossiers imbriqués, imports croisés), `import { save } from "./repository"` et `import type { Thing } from "./repository"` dans le même fichier ont produit deux `DependencyFact` identiques, donc une arête dupliquée dans le graphe Mermaid. Les deux faits sont corrects individuellement (deux instructions d'import existent bien) — le problème était au rendu, pas à l'extraction. Ajouté comme fixture `tests/fixtures/duplicate-import-statements/`, puis corrigé dans `vision/graph/mermaid.ts` (dédoublonnage des arêtes au rendu uniquement, le modèle sous-jacent garde les deux faits).
