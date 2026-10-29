# Carte du système

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelles unités s'exécutent, et comment communiquent-elles ? | système | nœuds de niveau `deployable` et `system`, arêtes entre eux | codée (maquettes A1 à A3) |

## 1. Objet

Les unités d'exécution (app, service, fonction, worker, tâche, binaire), les ressources qu'elles utilisent (stockages, canaux, services gérés, services externes) et les échanges qui les relient, typés et comptés.

## 2. Fondement

C'est le niveau « conteneurs » d'une description d'architecture : ce qui est déployé séparément et communique à travers une frontière réseau ou un stockage partagé. Les propriétés majeures d'un système se lisent à ce niveau : son **style** (client-serveur, services, serverless), ses **points de couplage** (une ressource partagée par plusieurs unités), ses **contournements** (un client qui écrit directement dans un stockage, hors de tout service).

## 3. Ce que la vue établit

- Le style d'architecture et la répartition des responsabilités entre unités.
- Les ressources partagées, donc les points où une modification se propage.
- Les échanges qui ne passent par aucun service : seule une règle de stockage les contrôle.
- Les cibles inconnues : une communication dont l'adresse est lue dans une variable et n'est pas déclarée.

## 4. Représentation

Trois couloirs ordonnés du déclencheur vers la ressource : *ce que les gens ouvrent*, *ce qui tourne côté serveur*, *ce qu'ils utilisent*. Chaque bloc porte le logo de sa technologie et ses compteurs. Les arêtes apparaissent pour le bloc sélectionné ; leur trait encode leur nature (appel, lecture, écriture, message), leur épaisseur leur nombre d'occurrences. La disposition s'adapte au style d'architecture reconnu.

## 5. Sources et technologies

Les manifestes de déploiement pour les unités ; le code, lu par les packs, pour les échanges ; les arêtes portent leurs occurrences (lignes).

**Ce qui dépend de la technologie.** Le rôle d'une unité et la nature d'un échange viennent de sa technologie : une fonction gérée démarre à la demande et peut tourner en plusieurs exemplaires, un service garde un processus ; un appel direct, une mise en file et un déclencheur de stockage n'ont pas les mêmes garanties de livraison. La carte qualifie chaque arête par la technologie qui la porte et montre, pour un client, s'il atteint un stockage directement (ce que seule une technologie qui l'autorise rend possible).

## 6. Limites

Pas l'intérieur d'une unité ; pas le trafic réel ; une arête existe parce qu'une ligne la produit. Une unité déclarée sans code lisible apparaît avec son langage non lu.

## 7. Relations

Vers l'[Intérieur d'un bloc](interieur-d-un-bloc.md) en entrant ; vers [Données](donnees.md) pour un stockage ; vers [Déploiement](deploiement.md) pour l'hébergement d'une unité ; vers [Défaillances](defaillances.md) pour une dépendance externe.
