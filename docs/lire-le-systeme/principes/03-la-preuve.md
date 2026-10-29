# 3. La preuve et l'incertitude

## Un fait est une affirmation et sa preuve

Toute information affichée par VisionLayer est un **fait** : une affirmation sur le système accompagnée de sa **preuve**, c'est-à-dire le fichier et la ligne qui l'établissent, et la **source** qui l'a produit. Aucune phrase n'est écrite sans preuve ; aucun récit n'est rédigé par l'extracteur. Une explication en langage naturel ne peut venir que d'une connaissance déclarée.

## Les sources

| Source | Ce qui a produit le fait |
|---|---|
| `syntax` | la lecture de l'arbre syntaxique d'un fichier |
| `symbols` | la résolution des noms entre fichiers (qui appelle quoi) |
| `manifest` | un fichier de déploiement ou de configuration |
| `pack` | un pack de technologie, qui sait reconnaître une forme (une route, une requête) |
| `declared` | un humain ou un agent, dans `.vision/` |
| `runtime` | prévue, pas encore lue : des traces d'exécution |

La source dit **quel degré de confiance** accorder au fait : une forme reconnue par un pack suit la spécification documentée d'une technologie ; une déclaration engage son auteur.

## Les statuts d'un élément

| Statut | Signification |
|---|---|
| `extracted` | lu directement dans un fichier |
| `proposed` | calculé par une règle à partir de faits lus (un composant, une course possible) |
| `declared` | écrit par un humain ou un agent |

Un élément `proposed` est le résultat d'une règle documentée, jamais d'une estimation. La règle est accessible depuis la vue.

## Trois états de connaissance

VisionLayer distingue rigoureusement trois situations, que les vues encodent différemment :

1. **Établi** : le fait est lu, avec sa preuve. Exemple : cette fonction écrit cette table.
2. **Établi comme absent** : la lecture a couvert le périmètre et n'a rien trouvé. Exemple : aucune ligne lue n'écrit cette valeur.
3. **Non lu** : le périmètre n'a pas été couvert (langage sans lecteur, technologie sans pack, chemin calculé à l'exécution). Rien ne peut en être conclu.

Confondre (2) et (3) est l'erreur que VisionLayer s'interdit : une absence n'est affirmée que sur un périmètre lu, et le périmètre non lu est toujours signalé. La vue [Couverture](../vues/couverture.md) mesure ce périmètre.

## Constats et fenêtres de risque

Un **constat** est un motif reconnu dans les faits qui signale un risque : une route sans garde, une lecture suivie d'une écriture sans protection, une tâche planifiée sur un service à plusieurs instances. Un constat **n'affirme pas un défaut** : il désigne une fenêtre où un défaut est possible, avec les lignes qui la forment. Sa confirmation ou son rejet appartient à un humain.
