# Contrats

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelle implémentation réalise cette interface, et que garantit-elle ? | frontière | facette `contract` : interface, opérations, implémentations, sélecteur, étanchéité | codée (maquette 27) |

## 1. Objet

Une interface du code réalisée par plusieurs implémentations interchangeables : les opérations promises et leurs types champ par champ, chaque implémentation et ce qu'elle appelle réellement, le mécanisme qui choisit l'implémentation (fabrique, configuration, valeur par défaut), et les imports qui contournent l'interface.

## 2. Fondement

Une interface à plusieurs implémentations est un **point de variation** du système : le même code appelant produit des comportements différents selon l'implémentation retenue. C'est l'application de l'inversion de dépendance, et sa valeur dépend de deux propriétés vérifiables :

- **La substituabilité** : chaque implémentation rend-elle le résultat promis, à partir de la réponse native de son fournisseur ?
- **L'étanchéité** : les détails d'un fournisseur restent-ils derrière l'interface, ou des imports directs la contournent-ils ?

## 3. Ce que la vue établit

- L'implémentation choisie pour chaque valeur de configuration, et celle choisie par défaut.
- Pour chaque implémentation, les appels au fournisseur et les retours qui reconstituent le résultat promis.
- Les fuites : chaque import d'un paquet d'implémentation hors du module.
- Les appelants du contrat.

## 4. Représentation

Trois onglets. *Fonctionnement* : le propos du module, les opérations champ par champ, et la vie d'un appel en séquence (appelant, interface, implémentation, fournisseur). *Fournisseurs* : une colonne par implémentation. *Utilisateurs* : les appelants et le sélecteur, chaque valeur reliée à la classe qu'elle choisit.

## 5. Sources et technologies

Les interfaces et leurs implémentations, la fabrique, la configuration qu'elle lit (par nom), les imports de paquets.

**Ce qui dépend de la technologie.** Les implémentations d'un contrat enveloppent souvent des fournisseurs de technologies différentes : leurs limites (taille, délai, quotas), leurs erreurs et leurs garanties diffèrent même quand l'interface est commune. La vue montre ce que chaque implémentation traduit, et ce qu'elle laisse passer, plutôt que de les présenter comme interchangeables.

## 6. Limites

La valeur de configuration effective en production n'est pas connue : toutes les alternatives sont montrées. Une implémentation chargée dynamiquement n'est pas résolue.

## 7. Relations

Un contrat est un [composant](composant.md) à plusieurs variantes ; vers [Défaillances](defaillances.md) pour un fournisseur ; vers [Technologies](technologies.md) pour les paquets des fournisseurs.
