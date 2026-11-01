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

## Le niveau composant : les modules

Les unités d'exécution sont déclarées (un manifeste les nomme) ; les points d'entrée et les fonctions sont écrits dans le code. Le niveau composant est le **module** : le dossier où l'équipe a rangé une fonctionnalité ou une couche (`bookings`, `payments`, `services`), ou un fichier posé à la racine du code (`db`, `logger`). C'est ce qu'un ingénieur cherche en premier.

Chaque module dit combien de points d'entrée l'utilisent (« utilisé par 10 points d'entrée sur 15 »), et chaque fichier sa **couche**, lue dans les faits : entrée (une route, un consommateur), logique, accès aux données, client d'un service extérieur. La règle complète est décrite dans [le modèle neutre](../../fonctionnement/05-le-modele-neutre.md). Un composant défini par une interface lue dans le code (un contrat) garde cette définition.

Le regroupement est calculé : un module porte le statut `proposed`. Un nom métier différent du dossier ne peut venir que d'une connaissance déclarée (voir [4](04-faits-et-connaissance.md)).

## Les lectures transversales

Certaines propriétés d'un système n'appartiennent à aucun élément isolé : elles naissent de la rencontre de plusieurs exécutions. Deux écritures qui se croisent, une dépendance qui échoue, une donnée personnelle qui sort du système, la portée d'un changement. Ces propriétés ne se voient à aucun niveau du zoom.

VisionLayer leur consacre des **lectures transversales** ([Concurrence](../vues/concurrence.md), [Défaillances](../vues/defaillances.md), [Données personnelles](../vues/donnees-personnelles.md), [Impact](../vues/impact.md)) : elles traversent les niveaux pour rassembler les éléments qui produisent la propriété.
