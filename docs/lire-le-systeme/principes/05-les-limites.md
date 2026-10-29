# 5. Les limites de la lecture statique

VisionLayer lit le dépôt sans l'exécuter. Ce choix garantit une analyse **déterministe** (deux analyses du même commit donnent le même modèle), **sans accès** aux environnements ni aux secrets, et **reproductible** par n'importe qui. Il a des limites structurelles, que chaque vue respecte.

## Ce qu'une lecture statique ne peut pas établir

| Limite | Conséquence dans les vues |
|---|---|
| **Les valeurs à l'exécution** : configuration réelle, contenu des données, variables d'environnement | les variables sont connues par leur nom, jamais par leur valeur ; une implémentation choisie par configuration est montrée avec toutes ses alternatives |
| **Les chemins calculés** : nom de table ou adresse construits à l'exécution | signalés comme « chemin dynamique », jamais résolus par supposition |
| **La fréquence et l'ordre réels** | une course est une fenêtre possible, pas un événement observé |
| **L'état des environnements** : machines, versions déployées, règles d'approbation chez l'hébergeur | non affichés ; le déploiement montre ce que le dépôt déclare |
| **Les usages hors du dépôt** : un autre système qui lit la même base | hors périmètre ; une vue d'impact le rappelle |

## Ce qu'elle n'établit pas encore

Ces limites ne sont pas structurelles : elles relèvent du travail en cours sur le moteur, et sont signalées comme telles.

- La **structure de contrôle** des déroulés : branches, rattrapages d'erreur, boucles, exécutions parallèles. Les étapes sont aujourd'hui dans l'ordre des lignes.
- La **résolution des appels à travers une interface** : un appel sur une valeur typée par un contrat ne mène pas encore à l'implémentation.
- La **sémantique des technologies** : les packs reconnaissent les formes d'une technologie ; ce qu'elle garantit (propriétés d'une transaction, livraison d'un événement, portée d'une règle d'accès) n'est porté qu'en partie. Un fait non qualifié est montré comme tel, sans lui prêter les garanties d'une autre technologie.
- Les **écrans d'une application** : les routes d'un client web ne sont pas encore lues comme des points d'entrée.

## La règle d'affichage

Une limite n'est jamais masquée. Ce qui n'est pas lu apparaît en trait pointillé, avec la raison (« non lu : langage sans lecteur », « cible à déclarer »). Une vue qui ne peut pas répondre le dit au lieu d'afficher une réponse partielle comme complète.
