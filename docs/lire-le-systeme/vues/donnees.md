# Données

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Qui accède à cette donnée, sous quelle garde, et comment son état évolue-t-il ? | données | facette `data` : `Entity`, `Field`, `FieldWrite`, `Constraint` ; arêtes `read` et `write` qui ciblent une entité | codée (maquettes 05 et 30) |

## 1. Objet

**Un stockage** et ses entités (tables, collections), avec pour chacune les acteurs qui la lisent et l'écrivent.

**Une entité ouverte**, sous trois représentations :

- **Cycle de vie** : les valeurs d'un champ d'état et, pour chacune, chaque écriture qui la produit, depuis le point d'entrée qui la déclenche ;
- **Forme** : les champs, leurs types et valeurs permises, les contraintes (clé primaire, unicité, clé étrangère, vérification, index partiel), la règle d'accès écrite au niveau du stockage, les déclencheurs de stockage ;
- **Accès** : chaque ligne qui lit ou écrit l'entité, le point d'entrée qui l'atteint, et la garde de ce point d'entrée.

## 2. Fondement

Les données sont l'état durable du système ; la plupart des défauts persistants se manifestent comme une donnée dans un état inattendu. Trois questions d'ingénierie structurent la vue :

- **Le contrôle d'accès** : qui peut écrire, sous quelle garde. Un accès sans garde vers une entité sensible est un défaut de sécurité.
- **Le lieu des invariants** : une règle tenue par une contrainte du stockage vaut pour tous les écrivains ; une règle tenue par une condition dans le code ne vaut que pour le code qui la contient.
- **La machine à états** : un champ d'état est une machine dont les transitions sont les écritures. Une valeur jamais écrite, ou écrite par un acteur inattendu, révèle une transition manquante ou illégitime.

## 3. Ce que la vue établit

- Pour chaque écriture : sa ligne, le point d'entrée qui l'atteint, la garde qui le protège.
- Les invariants portés par le stockage et ceux portés seulement par le code.
- Les valeurs d'état déclarées mais jamais écrites, et les écrivains de chaque valeur.
- Les écritures qui contournent tout service (depuis un client).

## 4. Représentation

Le stockage en grille : une ligne par entité, une colonne par acteur, une marque par accès (lecture, écriture). L'entité en onglets ; le cycle de vie comme une suite d'états reliés par les écritures qui les produisent.

## 5. Sources et technologies

Schémas et migrations, code d'accès aux données et règles de sécurité, lus par les packs de chaque technologie de stockage.

**Ce qui dépend de la technologie.** La vue change de contenu selon la nature du stockage, que son pack décrit. Un schéma relationnel donne des champs déclarés et des contraintes tenues pour tous les écrivains ; un stockage documentaire donne des champs déduits des écritures, des sous-collections, et aucune contrainte en dehors de l'identifiant du document : ses invariants ne peuvent être tenus que par le code, et la vue le dit. Une règle d'accès est qualifiée par sa portée réelle : des règles de sécurité qui ne s'appliquent qu'aux clients et que le code serveur privilégié contourne, ou des droits qui s'appliquent à tous. La section Forme ne montre que ce que le stockage peut porter ; une section absente pour une technologie n'est pas une case vide.

## 6. Limites

Le contenu réel des données n'est jamais lu. Une requête dont la cible est construite à l'exécution est signalée comme non résolue. Un accès par un autre système que le dépôt est hors périmètre.

## 7. Relations

Vers [Impact](impact.md) avant de modifier un champ ; vers [Concurrence](concurrence.md) pour une entité écrite par plusieurs acteurs ; vers [Points d'entrée](points-d-entree.md) pour l'écrivain ; vers [Données personnelles](donnees-personnelles.md) pour un champ personnel.
