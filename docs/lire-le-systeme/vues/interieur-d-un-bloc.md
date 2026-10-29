# Intérieur d'un bloc

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Comment cette unité est-elle composée ? | déployable | nœuds de niveau `component` dont le parent est le déployable, et leurs arêtes | maquettée (B1, repos et sélection) |

## 1. Objet

La décomposition d'une unité d'exécution en **composants** : des ensembles de fichiers qui s'appellent entre eux et servent les mêmes points d'entrée. Chaque composant est classé (propre, partagé, socle) et porte ce qu'il touche : entités lues et écrites, canaux, services appelés.

## 2. Fondement

Le niveau composant rend visible **où vit chaque responsabilité** à l'intérieur d'une unité. Deux principes d'ingénierie s'y lisent directement :

- **La propriété des données.** Une entité écrite par un seul composant a un propriétaire unique ; ses règles se vérifient à un seul endroit. Une entité écrite par plusieurs composants a ses règles dispersées.
- **Le couplage par capacité partagée.** Un composant servi par de nombreux points d'entrée concentre le risque : sa modification ou sa défaillance touche toutes les fonctionnalités qui le traversent.

Les composants sont calculés depuis l'exécution (voir [principe 2](../principes/02-les-niveaux.md)), parce que c'est la collaboration réelle des fichiers, non leur rangement, qui définit une responsabilité.

## 3. Ce que la vue établit

- La part du code propre à chaque fonctionnalité, partagée entre fonctionnalités, ou servant de socle.
- Le propriétaire de chaque entité écrite, ou l'absence de propriétaire unique.
- Les capacités partagées et le nombre de points d'entrée qui en dépendent.
- Les composants qui ne servent aucun point d'entrée lu.

## 4. Représentation

Au repos : les composants seuls, en trois colonnes lues de gauche à droite (propres, partagés, socle), de sorte que les appels vont toujours vers la droite et ne traversent jamais une colonne. Chaque composant porte son nom, le nombre de points d'entrée qu'il sert, et ses effets comptés (entités écrites, lues) ; un composant propre nomme les entrées dont le code vit chez lui. Le trait distingue l'origine : pointillé pour un composant calculé, plein pour un composant lu dans le code (un contrat). Aucune relation n'est dessinée. Le panneau donne la propriété des données du déployable et ses composants les plus partagés.

À la sélection d'un composant : ses appelants et ses appelés apparaissent avec leur nombre d'appels, les traits d'appel sont dessinés, le reste s'estompe. Le panneau donne les entités qu'il écrit, en précisant s'il en est le seul écrivain, les entrées qu'il sert, et mène à l'intérieur du composant ou à son impact.

## 5. Sources et technologies

Les fonctions du déployable, leurs appels résolus, et la portée fonction par fonction de chaque point d'entrée ; le regroupement et la classification sont calculés par une règle documentée dans [le modèle neutre](../../fonctionnement/05-le-modele-neutre.md).

**Ce qui dépend de la technologie.** Le découpage en composants ne dépend d'aucune technologie : il vient des appels. Ce qu'un composant touche reste qualifié par la technologie de la cible (une écriture dans un stockage documentaire ou relationnel), comme dans les autres vues.

## 6. Limites

Un composant porte le nom de ses fichiers tant qu'aucune connaissance déclarée ne le nomme. La vue montre le découpage réel, non le découpage souhaitable. Un fichier d'un langage non lu n'appartient à aucun composant.

## 7. Relations

Vers [Composant](composant.md) en entrant ; vers [Impact](impact.md) avant de modifier un composant partagé ; vers [Points d'entrée et déroulés](points-d-entree.md), dont les colonnes sont ces composants.
