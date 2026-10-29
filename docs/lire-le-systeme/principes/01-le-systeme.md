# 1. Le système comme objet de lecture

## Ce que VisionLayer appelle un système

Pour VisionLayer, un système est **ce qui s'exécute**, pas la façon dont son code est rangé. Il est décrit par cinq dimensions, que toutes les vues réutilisent :

| Dimension | Ce qu'elle décrit | Dans le modèle neutre |
|---|---|---|
| **Unités d'exécution** | Ce qui est déployé et lancé : app, service, fonction, worker, tâche, binaire | nœuds de niveau `deployable` et leurs rôles |
| **Échanges** | Ce qu'une unité fait à une autre : appeler, lire, écrire, publier un message, déclencher | arêtes typées (`call`, `read`, `write`, `message`, `request`, `trigger`) avec leurs occurrences |
| **Données** | Ce qui est conservé : tables, collections, files, fichiers, avec leur forme et leurs règles | facette `data`, facette `channel` |
| **Frontières** | Où le système s'ouvre ou se délègue : points d'entrée, gardes d'accès, interfaces à plusieurs implémentations, services externes | facettes `entrypoints`, `trust`, `contract` ; nœuds `external` |
| **Temps** | Ce qui se produit sans action d'un utilisateur : planification, files, événements | points d'entrée `schedule`, `message`, `event` |

Une vue est une **coupe** de ce modèle : elle retient certaines dimensions, à un certain niveau, pour répondre à une question.

## Pourquoi l'exécution et non l'arborescence

L'arborescence d'un dépôt reflète des conventions d'équipe, pas le comportement du système. Deux fichiers rangés côte à côte peuvent ne jamais s'appeler ; un fichier d'un dossier utilitaire peut porter la règle la plus critique du système. Une question de comportement (pourquoi cette donnée est dans cet état, qui peut écrire ici, que se passe-t-il si ce service tombe) se résout en suivant des exécutions, pas des dossiers.

VisionLayer relie donc chaque élément représenté à ce qui l'exécute : un point d'entrée à son code, une écriture à l'entrée qui l'atteint, un composant aux entrées qu'il sert. Un dossier ne sert jamais à regrouper ; il peut servir à nommer un groupe dont tous les fichiers s'y trouvent.

## Neutralité entre projets, fidélité à chaque technologie

Deux exigences distinctes s'appliquent, et l'une ne doit pas être prise pour l'autre.

### La neutralité vaut entre projets

VisionLayer n'est conçu pour aucun projet. Les niveaux de lecture, les questions des vues, la grammaire visuelle et les catégories de faits (point d'entrée, écriture, entité, garde, canal) sont les mêmes pour tout dépôt. Un projet inconnu se lit avec les mêmes repères qu'un projet déjà vu, et aucune règle du moteur ni d'une vue ne nomme un projet.

### Les technologies ne sont pas interchangeables

Ranger deux éléments dans la même catégorie permet de les trouver au même endroit ; cela ne les rend pas équivalents. Une collection d'un stockage documentaire et une table relationnelle sont toutes deux des entités, mais elles diffèrent sur ce qui compte pour comprendre le système :

- **ce que le stockage garantit** : un schéma déclaré et des contraintes tenues pour tous les écrivains, ou des champs déduits des écritures et des invariants tenus seulement par le code ;
- **la façon dont l'accès est contrôlé** : des règles de sécurité qui s'appliquent aux clients mais que le code serveur privilégié contourne, ou des droits de base de données qui s'appliquent à tous ;
- **la sémantique de ses mécanismes** : une transaction n'offre pas les mêmes garanties d'une technologie à l'autre (verrouillage ou non, corps rejoué automatiquement en cas de conflit, lectures obligatoirement avant les écritures) ;
- **ses modes d'échec**.

De même, une fonction appelable et une route HTTP sont deux points d'entrée, mais la première reçoit de sa plateforme une identité déjà vérifiée, que le code doit encore exiger, tandis que la seconde n'en a qu'à travers un middleware écrit dans le code. Un déclencheur d'événement géré peut être livré plus d'une fois ; une tâche planifiée écrite dans le code d'un service s'exécute sur chacune de ses instances, une tâche confiée à un planificateur géré une seule fois.

### Le rôle des packs

Un pack encode la spécification d'une technologie présente dans la pile détectée. Il a deux rôles :

1. **reconnaître ses formes** (la déclaration d'une route, d'une collection, d'une tâche) et les ranger dans les catégories communes ;
2. **porter sa sémantique** : ce que la technologie garantit, ce qu'elle laisse à la charge du code, les propriétés de ses mécanismes et ses modes d'échec, établis d'après sa documentation.

Un fait produit par un pack garde donc sa technologie : non comme un logo, mais comme une qualification qui change sa lecture.

### Conséquences pour la lecture

1. **Une vue garde la même structure d'un projet à l'autre** : sa question, sa disposition, sa grammaire.
2. **Une vue montre ce qui diffère selon la technologie** : une section qui n'existe que pour elle (les règles de sécurité d'un stockage accessible depuis les clients, les contraintes d'un schéma relationnel), un fait qualifié par sa technologie (une transaction nommée avec la technologie qui la fournit et ce qu'elle implique), une conséquence qui n'a de sens que pour elle (un invariant qu'aucune contrainte du stockage ne peut tenir).
3. **Deux faits de technologies différentes ne sont jamais présentés comme équivalents** parce qu'ils partagent une catégorie. Quand une vue les rapproche, elle nomme leurs différences.
4. **Une technologie sans pack n'est pas lue, et c'est dit.** Elle apparaît comme une lacune de couverture, jamais comme une absence. Une technologie dont le pack reconnaît les formes sans en porter encore la sémantique est signalée de même : ses faits sont classés, pas qualifiés.

Aujourd'hui, les packs portent surtout la reconnaissance des formes. Leur sémantique n'est portée qu'en partie (forme du stockage, règles d'accès, contraintes, attributs littéraux) ; la porter entièrement est un travail en cours (voir [principe 5](05-les-limites.md)).

## Le rôle de VisionLayer

VisionLayer **montre** le système ; il ne décide pas à sa place. Il n'approuve pas un changement, ne lance pas d'agent, n'écrit pas dans le code. Ses vues donnent à un humain ou à un agent les éléments pour décider, avec leurs preuves. Cette position ([ADR 0013](../../decisions/0013-visionlayer-control-tower-and-agent-integration.md)) explique qu'aucune vue ne contienne de verdict : une vue établit des faits et signale des fenêtres de risque.
