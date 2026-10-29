# Impact

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Qu'est-ce qui dépend de cet élément ? | lecture transversale | parcours du graphe depuis un élément : écrivains, lecteurs, conditions sur sa valeur, points d'entrée, tests, notes | maquettée (41) |

## 1. Objet

Un élément choisi (champ, entité, composant, fonction) et sa **fermeture de dépendance** : ce qui le produit ou l'appelle en amont, ce qui le lit ou en dépend en aval, les fonctionnalités, tests et notes concernés. Les lectures qui **prennent une décision selon sa valeur** sont distinguées des simples lectures.

## 2. Fondement

Modifier un élément exige de connaître sa portée réelle, que l'arborescence et la recherche textuelle sous-estiment. Une lecture qui branche sur une valeur est le point de rupture typique d'un changement : ajouter une valeur à un champ d'état casse silencieusement chaque endroit qui énumère les valeurs sans cas par défaut. La vue répond à la question qu'on pose avant tout changement, et qu'un agent doit poser avant de toucher un élément.

Pour un **composant**, l'impact est la liste des points d'entrée qui le traversent : c'est la représentation du couplage entre fonctionnalités et capacités partagées. Il n'existe pas de vue de couplage distincte.

## 3. Ce que la vue établit

- Les écrivains et lecteurs de l'élément, avec leurs lignes.
- Les décisions prises sur sa valeur, et celles qui n'ont pas de cas par défaut.
- Les points d'entrée, fonctionnalités et tests qui passent par lui.
- Les notes déclarées à relire en cas de changement.
- Les liens incertains (requête écrite à la main, cible dynamique), marqués à confirmer.

## 4. Représentation

Quatre colonnes de gauche à droite : ce qui produit l'élément, l'élément, ce qui le lit, ce qui en dépend. Une lecture décisionnelle porte une marque distincte. Le panneau simule un changement type (une valeur ajoutée) et liste les endroits à revoir.

## 5. Sources et technologies

Arêtes de lecture et d'écriture, écritures de champs, conditions des déroulés, tests dont les imports atteignent les fichiers concernés, ancrages des notes.

**Ce qui dépend de la technologie.** La portée d'un changement suit les arêtes, quelle que soit leur technologie ; un changement d'une entité sans schéma déclaré se mesure par ses écritures et ses lectures, faute de contrainte qui le signalerait.

## 6. Limites

Les usages hors du dépôt ne sont pas vus. Un lien dynamique est signalé, jamais supposé.

## 7. Relations

Vers [Données › Cycle de vie](donnees.md), [Composant](composant.md), [Revues](revues.md) pour un changement en cours.
