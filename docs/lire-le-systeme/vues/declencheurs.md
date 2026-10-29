# Déclencheurs

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Qu'est-ce qui s'exécute sans action d'un utilisateur ? | temps | points d'entrée `schedule`, `message`, `event` ; facette `channel` ; arêtes `message` et `trigger` ; `instances` | codée (maquettes 42 et 28) |

## 1. Objet

Les exécutions qui ne répondent pas à une demande directe : tâches planifiées et leur horaire, consommateurs de files et leurs réglages, gestionnaires d'événements reçus (webhooks, déclencheurs de stockage). Pour chacun, son **trajet** : qui l'émet, son déroulé, ce qu'il lit autour.

## 2. Fondement

Une part importante des changements d'état d'un système se produit hors de toute requête, donc hors du champ de vision de qui teste l'application à la main. Ces exécutions ont des propriétés propres :

- **la multiplicité** : une tâche planifiée sur une unité à plusieurs instances s'exécute autant de fois ;
- **l'asynchronisme** : ce qui est mis en file est traité plus tard, éventuellement plusieurs fois, éventuellement dans le désordre ;
- **la redélivrance** : un événement reçu peut l'être de nouveau, ce qui exige l'idempotence.

## 3. Ce que la vue établit

- Ce qui modifie les données selon un horaire ou à la réception d'un message.
- Les exécutions multipliées par le nombre d'instances.
- Le lien entre producteur et consommateur d'une file.
- La présence ou l'absence de protection contre une redélivrance.

## 4. Représentation

Une journée où les tâches planifiées sont placées à leurs heures, les exécutions déclenchées par une arrivée étant marquées sans horaire ; une table des déclencheurs ; le trajet en séquence, avec la même représentation que le déroulé d'un point d'entrée.

## 5. Sources et technologies

Expressions de planification, consommateurs et producteurs de files, gestionnaires d'événements, nombre minimal d'instances déclaré par le déploiement.

**Ce qui dépend de la technologie.** Les propriétés de chaque déclencheur viennent de sa technologie : un événement géré peut être livré plus d'une fois, avec ou sans nouvelle tentative selon sa configuration ; une file a son propre ordre (garanti ou non), son délai de visibilité, ses messages en échec ; une tâche planifiée confiée à un planificateur géré s'exécute une fois, une tâche écrite dans le code d'un service s'exécute sur chacune de ses instances. La vue qualifie chaque déclencheur par ces propriétés, d'après son pack, et ne déduit jamais une protection d'une autre technologie.

## 6. Limites

L'exécution effective (une tâche a-t-elle tourné) n'est pas connue : il faudrait des traces.

## 7. Relations

Vers [Concurrence](concurrence.md) quand un déclencheur écrit une entité aussi écrite par une requête ; vers [Déploiement](deploiement.md) pour le nombre d'instances ; vers [Données](donnees.md) pour ses écritures.
