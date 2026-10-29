# 4. Faits extraits et connaissance déclarée

## Deux natures d'information

Le code dit **ce que fait** le système. Il ne dit pas **pourquoi**, ni ce qui **doit** rester vrai. Une règle métier (« un code d'accès ne sert qu'à un compte »), une décision (« le fournisseur par défaut est celui-ci, pour la qualité »), une garantie (« la dotation n'est jamais versée deux fois ») sont des intentions : elles existent dans la tête des équipes, dans des tickets, rarement dans le code.

VisionLayer sépare donc strictement :

| | Faits extraits | Connaissance déclarée |
|---|---|---|
| **Nature** | ce que le code fait | ce que le système doit faire, et pourquoi |
| **Origine** | lecture du dépôt | humains et agents, dans `.vision/knowledge/` |
| **Vérité** | vraie par construction, à la ligne près | vraie au moment où elle est écrite |
| **Évolution** | recalculée à chaque analyse | doit être reconfirmée quand le code change |

Les deux ne sont jamais mélangés dans une vue : une note déclarée est toujours marquée comme telle.

## L'ancrage

Une note déclarée est **ancrée** sur le code qui la porte : une fonction, un symbole, un repère dans le code. L'ancrage permet de confronter l'intention au code d'aujourd'hui. À chaque analyse, VisionLayer recalcule l'état de chaque note :

| État | Condition |
|---|---|
| **vérifiée** | une vérification propre au type de note réussit, et le code ancré est inchangé |
| **à jour** | le code ancré est inchangé depuis que la note a été écrite ou reconfirmée |
| **à relire** | le code ancré a changé, ou n'est retrouvé qu'approximativement |
| **contredite** | la vérification échoue |
| **introuvable** | le code ancré n'existe plus |
| **sans ancrage** | une hypothèse ou une définition, qui ne porte sur aucun code |

« À relire » ne signifie pas « fausse » : cela signifie qu'un humain doit confronter de nouveau l'intention au code.

## Pourquoi cette séparation compte pour le diagnostic

Un comportement inattendu relève de deux causes possibles : le code ne fait pas ce qu'on croit (les faits le montrent), ou le code fait ce qu'il fait mais une règle attendue n'y est pas (seule la connaissance déclarée permet de le voir). Une règle métier non appliquée se détecte précisément comme une note dont le code ancré n'implémente pas la condition, ou comme une règle déclarée sans refus correspondant dans les déroulés.
