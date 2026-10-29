# Concurrence

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelles écritures peuvent se croiser, et qu'est-ce qui les protège ? | lecture transversale | `FieldWrite` d'une même entité par plusieurs points d'entrée ; contraintes ; constats `race_read_then_write`, `write_then_enqueue`, `order_assumption` | maquettée (43) |

## 1. Objet

Les entités écrites par plusieurs exécutions indépendantes, les protections qui s'appliquent à chacune (transaction, verrou explicite, contrainte d'unicité, condition dans l'écriture, clé d'idempotence), et les **fenêtres de course** : une lecture suivie d'une écriture conditionnée par ce qui a été lu, sans protection entre les deux.

## 2. Fondement

Deux exécutions correctes isolément peuvent produire un état incorrect lorsqu'elles s'entrelacent. Le motif le plus fréquent est la **lecture puis écriture** (check-then-act) : une décision prise sur une valeur lue, appliquée alors qu'une autre exécution a changé cette valeur entre-temps. Ces défauts sont intermittents, donc difficiles à reproduire ; ils se repèrent en revanche statiquement, par la structure des accès.

## 3. Ce que la vue établit

- Les entités disputées et leurs écrivains concurrents.
- Pour chaque fenêtre de course : les lignes de lecture et d'écriture de chaque côté, et l'état final possible.
- Les protections existantes et ce qu'elles empêchent.
- Les transactions qui attendent un service externe, et maintiennent ainsi un verrou.

## 4. Représentation

Une frise par fenêtre de course : les deux exécutions de part et d'autre de l'entité, leurs lectures et écritures ordonnées dans le temps, l'état final en conclusion. Puis la table des protections existantes.

## 5. Sources et technologies

Les écritures de champs avec leurs points d'entrée, les conditions des déroulés, les contraintes du schéma, les mécanismes de transaction et de verrou reconnus par les packs.

**Ce qui dépend de la technologie.** Une protection n'a que les garanties de la technologie qui la fournit. Une transaction peut verrouiller ou non selon la bibliothèque, être rejouée automatiquement en cas de conflit (son corps s'exécute alors plusieurs fois, effets externes compris) et exiger ses lectures avant ses écritures ; une contrainte d'unicité n'existe que là où le stockage en offre. La vue nomme chaque protection avec sa technologie et ce qu'elle empêche réellement, et une fenêtre de course est évaluée contre ces garanties-là.

## 6. Limites

Une fenêtre est **possible**, pas observée : la vue ne prouve pas qu'une course se produit. Le niveau d'isolation effectif du stockage n'est connu que s'il est configuré dans le dépôt.

## 7. Relations

Vers [Données](donnees.md) pour l'entité ; vers [Déclencheurs](declencheurs.md) pour une exécution planifiée en cause ; vers [Points d'entrée](points-d-entree.md) pour chaque côté.
