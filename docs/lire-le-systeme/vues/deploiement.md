# Déploiement

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Où le système s'exécute-t-il, et comment y est-il livré ? | socle | preuves de manifeste des unités (packs qui déploient), `instances`, attributs (région) ; chaînes de livraison (`Pipeline`, `PipelineJob`, `PipelineStep`) | codée (maquette 09) |

## 1. Objet

**La chaîne de livraison** : chaque workflow, ses déclencheurs, ses jobs ordonnés par leurs dépendances, leurs environnements nommés, leurs conditions, et leurs étapes classées par fonction (récupération, préparation, installation, vérification, construction, image, déploiement vers une plateforme), les secrets n'étant connus que par leur nom.

**Le placement** : pour chaque unité, les manifestes de déploiement qui la déclarent, son nombre minimal d'exemplaires et ses attributs (région).

## 2. Fondement

Le comportement en production dépend de propriétés qui ne sont pas dans le code applicatif : le nombre d'exemplaires (qui multiplie les tâches planifiées), la plateforme (qui impose ses limites), la chaîne de livraison (qui détermine ce qui est vérifié avant la mise en service). L'écart entre « ça marche en local » et « ça échoue en production » se loge souvent ici.

## 3. Ce que la vue établit

- Le chemin du commit à la production, ou l'absence de déploiement écrit dans le dépôt.
- Les vérifications exécutées avant livraison.
- Les unités placées par un manifeste, et celles qu'aucun manifeste de déploiement ne place.
- Le nombre minimal d'exemplaires de chaque unité.

## 4. Représentation

Chaque workflow en flux horizontal : déclencheurs, puis jobs en colonnes selon leurs dépendances, chacun avec ses étapes. Puis une ligne par unité avec ses déclarations, exemplaires et attributs ; une unité non placée est en pointillés.

## 5. Sources et technologies

Les manifestes lus par les packs qui déploient, les workflows du dépôt. Aujourd'hui GitHub Actions ; les autres chaînes ne sont pas encore lues.

**Ce qui dépend de la technologie.** Chaque chaîne et chaque cible ont leur sémantique : ce que déclare un fichier d'hébergement géré n'est pas ce que déclare une image de conteneur ou un fichier de composition (mise à l'échelle, région, exemplaires minimaux). La vue les montre dans leurs propres termes, sans les aligner sur une forme commune qui en effacerait les différences.

## 6. Limites

Les règles d'approbation d'un environnement sont configurées chez l'hébergeur du dépôt et ne sont pas visibles. L'état des machines n'est pas connu : VisionLayer ne contacte aucun hébergeur.

## 7. Relations

Vers [Technologies](technologies.md), [Déclencheurs](declencheurs.md) pour une tâche sur plusieurs exemplaires, [Carte](carte.md).
