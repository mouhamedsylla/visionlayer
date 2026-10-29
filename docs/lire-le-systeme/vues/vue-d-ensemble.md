# Vue d'ensemble

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quel est l'état du système, et qu'est-ce qui demande attention ? | système | le modèle entier, ses constats, sa couverture, la différence entre deux analyses | codée (maquette 01) |

## 1. Objet

Une synthèse du modèle à un instant donné : les unités d'exécution et leurs technologies, les constats classés par urgence, ce qui a changé depuis l'analyse précédente, ce qui n'a pas été lu, et l'activité en cours (revues, tâches d'agents).

## 2. Fondement

Un système se comprend d'abord par son **état présent** et ses **écarts** : ce qui a bougé, ce qui est fragile, ce qui échappe à la lecture. Cette vue est un point d'orientation, non un lieu d'analyse : chacun de ses éléments renvoie à la vue qui l'explique. Elle répond au besoin de reprendre le contrôle d'un système qui évolue plus vite qu'on ne le relit.

## 3. Ce que la vue établit

- La forme générale du système : nombre et nature des unités d'exécution, données, dépendances externes.
- Les fenêtres de risque détectées, ordonnées par urgence, chacune avec ses preuves.
- Les ajouts et retraits d'éléments entre deux analyses (unités, points d'entrée, entités, champs, valeurs, liens, constats).
- Le périmètre non lu, qui borne la confiance à accorder au reste.

## 4. Représentation

Un bandeau de synthèse, puis trois sections : *À savoir* (constats), *Ce qui a changé* (différences, présentes à partir de la deuxième analyse), *Non lu*. La section des changements est une liste signée (ajout, retrait), chaque ligne portant sa preuve.

## 5. Sources et technologies

Le modèle neutre complet, ses `findings` et sa `coverage` ; la différence entre deux modèles calculée en mémoire par le serveur local.

**Ce qui dépend de la technologie.** Les technologies y figurent par leur logo et leur couverture ; la vue renvoie aux vues qui les qualifient.

## 6. Limites

Elle ne dit pas si le système fonctionne en production. Un constat n'est pas un incident. Les changements sont ceux entre deux analyses, pas entre deux déploiements.

## 7. Relations

Vers la [Carte](carte.md) pour la structure ; vers la vue nommée par chaque constat ; vers [Couverture](couverture.md) pour le périmètre non lu ; vers [Revues](revues.md) pour un changement en cours.
