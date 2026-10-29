# Défaillances

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Que devient le système quand une dépendance échoue ? | lecture transversale | arêtes `request`, `call`, `read`, `write` vers les nœuds `external`, `store`, `channel` ; étapes de refus en rattrapage (`onError`) ; constat `missing_timeout` | maquettée (44) |

## 1. Objet

Pour chaque dépendance (service externe, stockage, canal) : les points d'entrée qui en dépendent, le comportement de leur code quand l'appel échoue (refus, nouvelle tentative, compensation, poursuite silencieuse), les délais d'attente déclarés ou absents, et les effets déjà produits au moment de l'échec.

## 2. Fondement

Dans un système distribué, la défaillance d'une dépendance est un cas nominal, non une exception. La résilience se juge à trois propriétés :

- **la propagation** : quelles fonctionnalités s'arrêtent quand une dépendance tombe ;
- **la compensation** : ce qui a été fait avant l'échec est-il défait (remboursement, libération d'une réservation) ;
- **le délai** : un appel sans délai d'attente peut bloquer une exécution, et avec elle les ressources qu'elle tient.

## 3. Ce que la vue établit

- Le rayon d'impact de chaque dépendance, en points d'entrée.
- Pour chaque appel : le traitement de son échec et les effets laissés en place.
- Les appels sans délai d'attente.
- Les compensations présentes, et les états partiels possibles en leur absence.

## 4. Représentation

Une dépendance au centre, les points d'entrée qui en dépendent autour ; pour chacun, le chemin d'échec issu de son déroulé et l'état laissé.

## 5. Sources et technologies

Les arêtes de la carte, les étapes de refus en rattrapage dans les déroulés, les options de délai reconnues par les packs des clients réseau.

**Ce qui dépend de la technologie.** Les comportements d'échec dépendent de la plateforme et des clients employés : nouvelles tentatives automatiques d'un client ou d'une plateforme, délai maximal d'une fonction gérée qui interrompt l'exécution, erreurs propres à chaque fournisseur. La vue montre ces comportements qualifiés, à côté de ce que le code écrit lui-même.

## 6. Limites

La disponibilité réelle des dépendances n'est pas connue. Une reprise configurée hors du dépôt (chez l'hébergeur, dans un proxy) n'est pas vue.

## 7. Relations

Vers [Points d'entrée](points-d-entree.md) pour un chemin d'échec ; vers [Contrats](contrats.md) quand la dépendance est derrière une interface ; vers [Carte](carte.md).
