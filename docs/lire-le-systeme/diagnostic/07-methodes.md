# 7. Méthodes de diagnostic

Un diagnostic part d'un **symptôme**, formule des **hypothèses**, et les confronte aux faits. Chaque méthode ci-dessous indique, pour une classe de symptômes, les hypothèses à examiner, les vues qui les tranchent et ce qu'il faut y vérifier. Les vues se consultent dans l'ordre indiqué : chacune restreint l'espace de recherche de la suivante.

## M1. Une demande est refusée ou produit un résultat incorrect

| Hypothèse | Vue | Vérification |
|---|---|---|
| un refus explicite du code | [Points d'entrée](../vues/points-d-entree.md), *si ça rate* | le code renvoyé correspond-il à un refus ? quelle condition le précède ? |
| la garde d'accès | [Accès](../vues/acces.md) | le niveau de garde de l'entrée, les rôles exigés |
| une donnée lue dans un état inattendu | [Données](../vues/donnees.md), Cycle de vie | quels écrivains produisent cet état ? |
| un composant partagé qui refuse | [Composant](../vues/composant.md) | les refus de ses fonctions offertes et leurs conditions |
| une implémentation différente selon l'environnement | [Contrats](../vues/contrats.md) | la configuration qui choisit l'implémentation |

**Conclusion possible :** la ligne exacte du refus ou de l'écriture fautive, dans [Code](../vues/code.md).

## M2. Une donnée est dans un état incohérent

| Hypothèse | Vue | Vérification |
|---|---|---|
| un écrivain inattendu | [Données](../vues/donnees.md), Accès | toutes les lignes qui écrivent l'entité et les entrées qui les atteignent |
| une transition illégitime | [Données](../vues/donnees.md), Cycle de vie | la valeur est-elle produite par un écrivain qui ne devrait pas ? |
| une écriture sans requête | [Déclencheurs](../vues/declencheurs.md) | une tâche ou un événement écrit-il l'entité ? |
| deux écritures entrelacées | [Concurrence](../vues/concurrence.md) | une fenêtre lecture-puis-écriture sans protection |
| un effet partiel après échec | [Défaillances](../vues/defaillances.md) | une compensation manque-t-elle après une écriture ? |

## M3. Un acteur accède à ce qu'il ne devrait pas

| Hypothèse | Vue | Vérification |
|---|---|---|
| une entrée sans garde | [Accès](../vues/acces.md) | les entrées publiques et ce qu'elles écrivent |
| une garde insuffisante | [Données](../vues/donnees.md), Accès | la garde de chaque entrée qui atteint l'entité |
| un accès qui contourne le serveur | [Carte](../vues/carte.md), [Données](../vues/donnees.md) | les écritures depuis un client, et la règle de stockage qui les contrôle |

## M4. Une règle métier n'est pas appliquée

Ce symptôme ne se diagnostique pas avec les seuls faits : il exige la règle attendue (voir [principe 4](../principes/04-faits-et-connaissance.md)).

| Hypothèse | Vue | Vérification |
|---|---|---|
| la règle est déclarée, son code a changé | [Connaissance](../vues/connaissance.md) | l'état de la note : à relire, contredite, introuvable |
| la règle est implémentée à un seul endroit sur plusieurs | [Intérieur d'un bloc](../vues/interieur-d-un-bloc.md), [Données](../vues/donnees.md) | l'entité a-t-elle plusieurs écrivains, dont un sans la condition ? |
| la règle n'est implémentée nulle part | [Points d'entrée](../vues/points-d-entree.md) | existe-t-il un refus portant la condition de la règle ? |
| la règle repose sur le code et non sur le stockage | [Données](../vues/donnees.md), Forme | une contrainte du stockage la garantit-elle ? |

## M5. Un comportement intermittent

| Hypothèse | Vue | Vérification |
|---|---|---|
| une course | [Concurrence](../vues/concurrence.md) | les fenêtres sur les entités concernées |
| une exécution multipliée | [Déclencheurs](../vues/declencheurs.md), [Déploiement](../vues/deploiement.md) | une tâche planifiée sur plusieurs exemplaires |
| une redélivrance | [Déclencheurs](../vues/declencheurs.md) | la protection contre un message reçu deux fois |
| une dépendance lente | [Défaillances](../vues/defaillances.md) | les appels sans délai d'attente |

## M6. Un écart entre environnements

| Hypothèse | Vue | Vérification |
|---|---|---|
| une configuration différente | [Contrats](../vues/contrats.md), [Technologies](../vues/technologies.md) | les variables lues et ce qu'elles choisissent |
| un placement différent | [Déploiement](../vues/deploiement.md) | les manifestes, exemplaires, régions |
| une version différente | [Technologies](../vues/technologies.md) | versions déclarées et installées, divergences |

## M7. Évaluer un changement avant de le faire

1. [Impact](../vues/impact.md) sur chaque élément modifié : écrivains, lecteurs, décisions sur sa valeur, tests.
2. [Composant](../vues/composant.md) pour un composant partagé : les entrées qui le traversent.
3. [Connaissance](../vues/connaissance.md) : les notes ancrées sur le code modifié.
4. [Revues](../vues/revues.md), une fois la modification proposée : la différence de modèle.

## Règle générale

À chaque étape, vérifier la [couverture](../vues/couverture.md) du périmètre examiné : une conclusion d'absence (« aucun écrivain ne produit cet état ») ne vaut que sur un périmètre lu.
