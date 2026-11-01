# ADR 0001 — Langage d'implémentation de VisionLayer

**Statut :** Accepté

## Contexte
VisionLayer (scanner, parser/extracteur, modèle, CLI) doit être écrit dans un langage cohérent avec le reste de nos projets, et avec un bon écosystème pour l'analyse de code multi-langage.

## Décision
**TypeScript.**

## Rationale
- Cohérence avec la stack produit existante.
- Écosystème mature pour consommer des bindings `tree-sitter` (voir [ADR 0002](./0002-parsing-strategy.md)) et pour exposer une CLI (`cli/`) ou un serveur MCP (`integrations/agents/`).
- Typage statique utile pour les schémas du System Model (`schemas/`) — les types TypeScript peuvent servir de base ou d'équivalent direct au JSON Schema.

## Conséquences
- Le scanner, l'extracteur, le CLI et les intégrations (`vision/`, `cli/`, `integrations/`) sont tous en TypeScript.
- Les schémas de données (`schemas/`) doivent rester exprimables à la fois en JSON Schema (contrat externe, agent-agnostic) et en types TypeScript (usage interne) — pas de divergence entre les deux.
