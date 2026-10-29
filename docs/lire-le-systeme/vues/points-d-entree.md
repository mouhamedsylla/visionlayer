# Points d'entrée et déroulés

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Que produit l'exécution de ce point d'entrée ? | point d'entrée | facette `entrypoints` : `Entrypoint`, sa garde, son déroulé (`FlowStep`) | codée (maquette 07), à enrichir |

## 1. Objet

**La liste** : chaque porte d'exécution du système (route, fonction appelable, tâche planifiée, consommateur de file, événement reçu), regroupée par ressource, avec sa garde d'accès, ses appelants et ce qu'elle touche.

**Le déroulé** d'un point d'entrée : ce que son code exécute, dans l'ordre, fonctions du dépôt dépliées. Chaque étape est typée : lecture, écriture, message, appel externe, appel d'une fonction du dépôt, refus, retour anticipé, réponse. Un refus porte son code, sa condition écrite et, le cas échéant, le fait qu'il survient dans un rattrapage d'erreur.

## 2. Fondement

Le point d'entrée est l'unité de comportement observable : c'est par lui que le système reçoit une demande et produit des effets. Diagnostiquer un comportement revient presque toujours à reconstituer un déroulé : **quelles conditions** mènent à quel refus, **dans quel ordre** les effets se produisent, **ce qui reste fait** quand une étape échoue. L'ordre des effets est décisif : une écriture suivie d'une mise en file n'a pas les mêmes propriétés de cohérence que l'inverse.

## 3. Ce que la vue établit

- Les conditions de chaque refus et le code renvoyé à l'appelant.
- La séquence des effets et leur cible (entité, canal, service).
- Les effets partiels possibles : une étape qui échoue après des écritures déjà faites.
- La garde qui protège l'entrée, et son absence.

## 4. Représentation

Un diagramme de séquence : une colonne pour le code du point d'entrée, puis une par cible (stockages, canaux, services externes) ; une ligne par étape, sa flèche du code vers la cible, sa preuve. Les refus sont regroupés dans une section *si ça rate*. Un onglet montre le code du point d'entrée avec les numéros d'étapes en marge.

**Évolution spécifiée (étude du 03/10).** Trois apports enrichissent ce déroulé, partagé avec les trajets de [Déclencheurs](declencheurs.md) et la vie d'un appel des [Contrats](contrats.md) :

1. les colonnes deviennent les **composants** du déployable, puis les ressources : le déroulé montre comment l'exécution traverse l'unité ;
2. les étapes sont regroupées en **moments**, chacun dépliable ;
3. la **structure de contrôle** est représentée : une condition et ses branches, un rattrapage et ce qu'il défait.

## 5. Sources et technologies

Le déroulé extrait de l'arbre syntaxique du point d'entrée et des fonctions qu'il appelle ; les cibles reprennent les arêtes de la carte.

**Ce qui dépend de la technologie.** La forme d'une entrée et ce que sa plateforme fait avant le code dépendent de la technologie : vérification d'identité, contrôle d'intégrité de l'appelant, désérialisation, délai maximal, nombre de tentatives. Le déroulé commence par ces étapes de plateforme, qualifiées, avant la première ligne du code. Un refus a la forme que sa technologie impose (code HTTP, code d'erreur d'une fonction appelable) et la vue le dit dans cette forme.

## 6. Limites

Le déroulé décrit le code, non une exécution : il ne contient aucune valeur. La structure de contrôle et les appels à travers une interface ne sont pas encore lus (voir [principe 5](../principes/05-les-limites.md)).

## 7. Relations

Vers [Code](code.md) pour une étape ; vers [Données](donnees.md) pour une entité touchée ; vers [Défaillances](defaillances.md) pour un appel externe ; vers [Accès](acces.md) pour la garde.
