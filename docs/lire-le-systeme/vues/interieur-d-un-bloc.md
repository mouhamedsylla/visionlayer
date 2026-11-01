# Intérieur d'un bloc

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Comment cette unité est-elle composée ? | déployable | nœuds de niveau `component` (modules) dont le parent est le déployable, et leurs arêtes | maquettée (B1) ; modules par dossier depuis le 01/11 |

## 1. Objet

La décomposition d'une unité d'exécution en **modules** : les dossiers où l'équipe a rangé son code, ou les fichiers posés à la racine. Chaque module dit combien de points d'entrée l'utilisent, ce qu'il touche (entités lues et écrites, canaux, services appelés), et la couche de chacun de ses fichiers : entrée, logique, accès aux données, client externe.

## 2. Fondement

C'est le niveau « composants » de C4, et la vue des briques d'arc42. Deux principes d'ingénierie s'y lisent directement :

- **La propriété des données.** Une entité écrite par un seul module a un propriétaire unique ; ses règles se vérifient à un seul endroit. Une entité écrite par plusieurs modules a ses règles dispersées.
- **Le couplage par capacité partagée.** Un module utilisé par la plupart des points d'entrée concentre le risque : sa modification ou sa défaillance touche toutes les fonctionnalités qui le traversent.

## 3. Ce que la vue établit

- Où vit chaque fonctionnalité, et ce qui est commun à toutes.
- Le propriétaire de chaque entité écrite, ou l'absence de propriétaire unique.
- Les modules dont dépendent le plus de points d'entrée.
- La couche de chaque fichier : où sont les routes, la logique, l'accès à la base, les clients externes.

## 4. Représentation

Au repos : les modules, rangés de gauche à droite par usage, ceux d'une seule fonctionnalité d'abord, les communs ensuite, pour que les appels aillent vers la droite. Chaque module porte son nom, « utilisé par N points d'entrée sur M », la petite barre de ses couches et ses effets comptés. Le trait distingue l'origine : pointillé pour un module calculé, plein pour un composant lu dans le code (un contrat).

À la sélection d'un module : ses appelants et ses appelés apparaissent avec leur nombre d'appels, le reste s'estompe. Le panneau donne les entités qu'il écrit, en précisant s'il en est le seul écrivain, ses fichiers avec leur couche, les entrées qu'il sert, et mène à l'intérieur du module ou à son impact.

## 5. Sources et technologies

Les fonctions du déployable, leurs appels résolus, et la portée fonction par fonction de chaque point d'entrée ; le regroupement et la classification sont calculés par une règle documentée dans [le modèle neutre](../../fonctionnement/05-le-modele-neutre.md).

**Ce qui dépend de la technologie.** Le découpage en composants ne dépend d'aucune technologie : il vient des appels. Ce qu'un composant touche reste qualifié par la technologie de la cible (une écriture dans un stockage documentaire ou relationnel), comme dans les autres vues.

## 6. Limites

Un module porte le nom de son dossier tant qu'aucune connaissance déclarée ne le nomme. La vue montre le rangement réel, non le découpage souhaitable. Un fichier d'un langage non lu n'appartient à aucun module.

## 7. Relations

Vers [Composant](composant.md) en entrant ; vers [Impact](impact.md) avant de modifier un composant partagé ; vers [Points d'entrée et déroulés](points-d-entree.md), dont les colonnes sont ces composants.
