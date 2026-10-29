# 2. Les niveaux de lecture

## Le principe du zoom

Un système complexe ne se lit pas sur un seul plan. VisionLayer le décompose en niveaux emboîtés ; chaque niveau a **sa propre question et sa propre représentation**, et l'on passe d'un niveau au suivant en entrant dans un élément.

| Niveau | Unité | Question | Vue principale |
|---|---|---|---|
| **Système** | le dépôt entier | Quelles unités s'exécutent, et comment communiquent-elles ? | [Carte](../vues/carte.md) |
| **Déployable** | une unité d'exécution | Comment cette unité est-elle composée ? | [Intérieur d'un bloc](../vues/interieur-d-un-bloc.md) |
| **Composant** | un groupe de fichiers qui collaborent | Quelle responsabilité porte-t-il, et pour qui ? | [Composant](../vues/composant.md) |
| **Point d'entrée** | une porte d'exécution | Que produit son exécution ? | [Points d'entrée et déroulés](../vues/points-d-entree.md) |
| **Code** | une fonction, une ligne | Quelle ligne établit ce fait ? | [Code](../vues/code.md) |

Ce découpage suit la pratique de description d'architecture par zooms successifs (système, conteneurs, composants, code), adaptée à ce que l'analyse statique peut établir.

## Les invariants entre niveaux

1. **Une question par niveau.** Un niveau ne répond pas à la question d'un autre. La carte ne montre pas l'intérieur d'un bloc ; l'intérieur d'un bloc ne montre pas les étapes d'un déroulé.
2. **Entrer, c'est descendre d'un niveau.** Le fil d'Ariane reflète toujours la position dans cette hiérarchie.
3. **L'identité est stable.** Un élément garde le même nom, la même forme et la même place relative dans toutes les vues où il apparaît. Un composant dessiné dans l'intérieur d'un bloc est le même objet qu'une colonne du déroulé d'une entrée.
4. **Chaque niveau se résout en preuves.** Quel que soit le niveau, tout fait mène à des lignes de code.

## Le niveau composant

Les unités d'exécution sont déclarées (un manifeste les nomme) ; les points d'entrée et les fonctions sont écrits dans le code. Le niveau composant, lui, **n'est déclaré nulle part** : il est calculé. Un composant est un ensemble de fichiers d'un même déployable qui s'appellent entre eux et servent exactement les mêmes points d'entrée, la portée de chaque point d'entrée étant suivie d'appel en appel. Il est classé selon les points d'entrée qu'il sert :

- **propre** : il ne sert qu'un groupe d'entrée, c'est-à-dire des points d'entrée dont le code d'entrée vit dans un même composant ;
- **partagé** : il sert plusieurs groupes d'entrée ;
- **socle** : il sert au moins les trois quarts des points d'entrée du déployable.

Les seuils sont relatifs au déployable et la règle complète est décrite dans [le modèle neutre](../../fonctionnement/05-le-modele-neutre.md). Un composant défini par une interface lue dans le code (un contrat) garde cette définition.

Parce qu'il est calculé, un composant porte le statut `proposed` et le nom de ses fichiers. Un nom métier ne peut venir que d'une connaissance déclarée (voir [4](04-faits-et-connaissance.md)).

## Les lectures transversales

Certaines propriétés d'un système n'appartiennent à aucun élément isolé : elles naissent de la rencontre de plusieurs exécutions. Deux écritures qui se croisent, une dépendance qui échoue, une donnée personnelle qui sort du système, la portée d'un changement. Ces propriétés ne se voient à aucun niveau du zoom.

VisionLayer leur consacre des **lectures transversales** ([Concurrence](../vues/concurrence.md), [Défaillances](../vues/defaillances.md), [Données personnelles](../vues/donnees-personnelles.md), [Impact](../vues/impact.md)) : elles traversent les niveaux pour rassembler les éléments qui produisent la propriété.
