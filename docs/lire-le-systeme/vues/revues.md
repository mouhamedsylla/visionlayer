# Revues

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Que change réellement cette modification ? | suivi | différence entre le modèle de la branche de base et celui de la branche proposée ; notes dont l'ancrage est touché | maquettée (15) |

## 1. Objet

Une demande de modification lue comme une **différence de modèle**, non comme une différence de texte : unités, points d'entrée, entités, champs, valeurs, liens et constats ajoutés ou retirés ; éléments dont le comportement change ; notes déclarées dont le code ancré est modifié.

## 2. Fondement

Un diff textuel montre des lignes ; il ne montre pas qu'une route a perdu sa garde, qu'une entité a gagné un écrivain, ou qu'une règle documentée est touchée. Avec du code produit rapidement, la relecture ligne à ligne ne tient plus : la revue doit porter sur les **changements de comportement** et leur portée.

## 3. Ce que la vue établit

- Les changements de structure et de comportement introduits.
- Leur portée, via l'impact de chaque élément modifié.
- Les notes à relire, et les constats apparus ou disparus.

## 4. Représentation

Les changements regroupés par nature, chacun avec sa preuve des deux côtés ; une colonne d'impact ; la liste des notes touchées.

## 5. Sources et technologies

Deux modèles calculés sur deux révisions ; la connaissance déclarée.

**Ce qui dépend de la technologie.** Une différence de modèle garde la qualification de ses faits : changer une protection ou une garde change aussi ce que sa technologie garantit.

## 6. Limites

VisionLayer montre ; il n'approuve jamais une modification.

## 7. Relations

Vers [Impact](impact.md), [Connaissance](connaissance.md), [Agents](agents.md) quand la modification vient d'un agent.
