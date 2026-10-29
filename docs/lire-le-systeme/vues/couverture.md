# Couverture

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Jusqu'où la représentation est-elle fiable ? | suivi | `coverage` du modèle ; rapport de connaissance ; mesures dérivées sur les points d'entrée, refus et entités | codée (maquette 16) |

## 1. Objet

La mesure de ce que la représentation couvre : fichiers lus sur fichiers présents et raisons des lacunes ; points d'entrée rattachés à une fonctionnalité déclarée ; entités dont les champs sont lus ; refus expliqués par un commentaire d'auteur ou une note ancrée sur leur ligne ; notes à jour. Puis les lacunes, ordonnées par risque.

## 2. Fondement

Toute vue n'est fiable que sur le périmètre lu (voir [principe 3](../principes/03-la-preuve.md)). La couverture rend ce périmètre explicite, et oriente l'effort de documentation vers les lacunes les plus risquées : un point d'entrée qui écrit des données sans fonctionnalité déclarée compte plus qu'une entité dont les champs ne sont pas lus.

## 3. Ce que la vue établit

- Le périmètre lu et les raisons de chaque lacune (langage sans lecteur, technologie sans pack, cible inconnue, chemin dynamique).
- Le degré de documentation du système, par unité.
- Les lacunes classées : note contredite, note à relire, point d'entrée qui écrit sans fonctionnalité, refus inexpliqué, partie non lue, entité aux champs non lus.

## 4. Représentation

Un bandeau de ratios, une table par unité où chaque ratio est une barre (« rien à compter » quand le dénominateur est nul, jamais 0 %), la liste des lacunes avec leurs preuves, et les notes à relire dans le panneau.

## 5. Sources et technologies

La couverture calculée par le moteur, le rapport de connaissance, les déroulés.

**Ce qui dépend de la technologie.** La couverture distingue trois états pour une technologie : sans pack, formes reconnues sans sémantique, sémantique portée.

## 6. Limites

La couverture mesure ce que VisionLayer a lu, pas la qualité du système.

## 7. Relations

Vers [Connaissance](connaissance.md), et vers la fiche de chaque vue pour ses limites propres.
