# ADR 0002 — Stratégie de parsing

**Statut :** Accepté

## Contexte
Le pipeline VisionLayer (`vision-layer-concept.md` §7) nécessite un parser/AST par langage pour extraire symboles et dépendances. Écrire un parser maison par langage (TS/JS, Python, SQL, IaC...) est un effort considérable et fragile — la question posée en [architecture.md §6](../architecture.md) était : réécrire, ou réutiliser ce qui existe déjà et fonctionne ?

## Décision
**`tree-sitter`** — pas de parsers maison.

## Rationale
- `tree-sitter` fournit des grammaires multi-langages déjà matures et maintenues (utilisé notamment par GitHub, Neovim, Zed), avec parsing incrémental.
- Application directe du principe NIST SSDF (groupe PW) : *réutiliser du logiciel existant et déjà bien sécurisé plutôt que de dupliquer la fonctionnalité soi-même* — voir [architecture.md §4.1](../architecture.md#41-vis-à-vis-de-nist-ssdf).
- Évite à RYPHA de porter la maintenance de parsers dont la correctness est critique (les "faits" de VisionLayer doivent être fiables — cf. gouvernance, distinction faits/interprétations).

## Conséquences
- `vision/parsers/` devient une couche d'adaptation autour des bindings `tree-sitter` (une grammaire par langage supporté), pas une implémentation de parsing.
- Ajouter le support d'un nouveau langage = ajouter une grammaire `tree-sitter` existante + une couche d'extraction, pas écrire un parser.
- Limite acceptée : si un langage n'a pas de grammaire `tree-sitter` mûre, son support est reporté plutôt que de justifier un parser maison.
