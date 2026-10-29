# Knowledge layer — 4. Le contexte des agents

**Statut :** chemin validé le 29/09/2026. Les tickets de la section 13 sont dans Linear, jalon « 2 · Connaissance v1 » du projet Rypha-Fabric.
**Prérequis :** [01](./01-ce-que-visionlayer-doit-savoir.md), [02](./02-modele-de-connaissance.md), [03](./03-resultats-du-prototype.md).

## 1. Le problème

Un agent qui reçoit une tâche doit savoir deux choses avant de toucher au code :

- **Comment le système fonctionne** : qui appelle quoi, quelles données sont écrites, ce qu'une écriture déclenche ailleurs.
- **Pourquoi il est fait ainsi** : pourquoi une abstraction existe, pourquoi une file plutôt qu'un appel direct, quelle contrainte métier explique une validation, quelle décision ne doit surtout pas être annulée, quelles conséquences fonctionnelles peut avoir une modification techniquement locale.

Aujourd'hui, il obtient la première en lisant des fichiers, ce qui coûte cher en tokens. Il n'obtient presque jamais la seconde : elle n'est pas dans le code, elle était dans la tête de celui qui l'a écrit.

Le but est de lui donner les deux, **réduits au strict nécessaire, sans rien perdre de ce qui compte**, et au moment où il en a besoin.

## 2. Une seule source : le système réel

VisionLayer tient déjà un modèle du système, construit à partir du code et de Git. Les agents y ajoutent, au fil de leurs tâches, ce que le code ne dit pas. Le tout forme **une seule représentation du système réel**, qui sert deux publics :

- **Les humains** la voient dans les écrans : Système, Bloc, Features, Feature, Données, Connaissance, Revues.
- **Les agents** la reçoivent en texte condensé : les outils MCP et les hooks.

C'est la même vérité, rendue deux fois. Un écran et un outil d'agent ne doivent jamais dire deux choses différentes. Si un fait est montré à l'humain comme « à reconfirmer », il est donné à l'agent comme « à reconfirmer ».

## 3. Ce que VisionLayer sait

### Extrait du code (calculé, jamais écrit à la main)

| Représentation | Contenu | Où c'est aujourd'hui | Rendu pour l'agent |
|---|---|---|---|
| Modèle du code | fichiers, symboles, dépendances, ré-exports | `vision/model` | `vision_inspect`, `vision_source` |
| Carte d'exécution | blocs (client, service, stockage, file, capacité, externe), liens prouvés à la ligne (appelle, lit, écrit, déclenche, met en file, utilise) | `vision/arch` | `vision_architecture` (≈ 1 900 tokens pour la carte, ≈ 900 pour un bloc sur Nafar) |
| Points d'entrée | fonctions appelables, routes, déclencheurs, tâches planifiées, pages | `vision/arch` | dans `vision_architecture` |
| Données | collections, qui les lit et les écrit (ligne à l'appui), ce que leurs écritures déclenchent, leurs règles d'accès | intérieur du bloc de stockage | pas encore d'outil dédié |
| Déroulé d'une feature | conditions de refus, branches, écritures, IA, files, retours, erreurs, avec la ligne de chaque étape ; qui l'appelle et ce qu'elle déclenche | `vision/arch/flow.ts` | `vision_flow` (≈ 1 250 tokens pour `videoCreate`, contre ≈ 6 600 pour lire `job.ts`) |
| Intérieurs de blocs | fournisseurs et modèles d'IA, cibles des files, URL externes | `ArchBlock.interior` | dans `vision_architecture` |
| Déploiement, technologies | ce qui part où, avec quelles variables (noms seulement) ; technologies et leurs preuves | `vision/infra`, `vision/stack` | pas encore exposé aux agents |
| Changements | différence entre deux cartes, niveau de risque par chemin | `vision/diff`, `vision/policy` | CLI et écran Revues seulement |

### Déclaré par les agents (la connaissance)

Des **concepts** (feature, flux, contrat, entité, bloc, décision, terme) portent des **affirmations** d'une phrase, typées :

| Type | Répond à |
|---|---|
| `purpose` | à quoi sert cette feature ou ce composant |
| `rule`, `invariant` | ce qui doit toujours être vrai |
| `failure` | ce qui se passe quand ça rate (rejeu, remboursement, reprise) |
| `why`, `decision` | pourquoi c'est fait ainsi ; ce qui ne doit pas être annulé |
| `guarantee` | ce qu'un contrat promet à ceux qui l'utilisent |
| `state-meaning` | ce que veut dire un état d'une donnée |
| `assumption`, `limit`, `term` | hypothèse sur l'extérieur, limite connue, vocabulaire |

Chaque affirmation est **ancrée** dans le code, et son état est **calculé** contre le code et Git : structure vérifiée, à jour, à reconfirmer, contredite, orpheline, hypothèse.

### Croisé (calculé sur les deux)

- Les features déclarées et leurs points d'entrée, vérifiés sur la carte.
- Les points d'entrée qu'aucune feature ne couvre.
- Une règle appliquée seulement dans un bloc client (constat 4, pas encore fait).
- Les tests qui atteignent un ancrage.
- **Les conséquences d'un changement** (section 6, pas encore fait).

## 4. Trois sortes d'information, trois traitements

C'est la première source d'économie : ne transporter en prose que ce que le code ne dit pas.

| Sorte | Exemples | Traitement |
|---|---|---|
| **Déductible du code** | qui appelle qui, dépendances, héritage, données écrites, ordre des étapes | Jamais écrit. Calculé à la demande et condensé. |
| **Non déductible** | pourquoi une abstraction ; file plutôt qu'appel direct ; contrainte métier d'une validation ; décision à ne pas annuler | Seule chose écrite : une affirmation d'une phrase (20 à 50 tokens), ancrée, vérifiée. |
| **Le récit** | la discussion, les options rejetées, le détail d'une décision | Reste dans la PR ou l'ADR. L'affirmation y renvoie par un lien. |

Une conséquence directe : **une affirmation qui répète un fait extrait est une erreur** (« `placeOrder` écrit dans `orders` »). Elle coûte des tokens et peut devenir fausse. Les consignes aux agents le disent, et la revue le vérifie.

## 5. Le graphe du système

Pour que la connaissance soit navigable, extrait et déclaré sont réunis dans un seul graphe.

**Nœuds :** fichiers, symboles, points d'entrée, blocs, collections, concepts, affirmations.

**Liens extraits :** définit, importe, appelle, lit, écrit, déclenche, met en file, exécute (un point d'entrée exécute un fichier).

**Liens déclarés :** ancré dans (une affirmation vers un symbole ou une partie marquée), porte sur (un concept vers ses points d'entrée, une entité vers sa collection, un contrat vers son interface), dépend conceptuellement de (une feature vers un composant qu'elle n'appelle pas directement).

Tous les usages passent par une même fonction, `reach` : à partir d'un point de départ (un fichier, un symbole, une plage de lignes modifiées, une collection, une feature), elle rend tout ce qui est atteint, avec le chemin qui le relie au départ. L'écran Feature, le hook de l'agent et le rapport de PR l'appellent de la même façon. C'est ce qui garantit qu'ils disent la même chose.

## 6. Les conséquences d'un changement local

C'est la question la plus précieuse pour un agent : « si je touche ceci, qu'est-ce que je risque de casser ailleurs ? ». Elle se calcule sans rien deviner.

1. **Plages modifiées → symboles touchés**, par les lignes (modèle du code).
2. **Symboles → points d'entrée**, en remontant le graphe d'appels jusqu'aux fonctions appelables, routes et déclencheurs qui les exécutent.
3. **Points d'entrée → features**, déclarées ou non.
4. **Code modifié → données écrites ou lues**, par les accès extraits à la ligne.
5. **Données écrites → ce qu'elles déclenchent**, par les déclencheurs sur ces collections, puis le déroulé de ces déclencheurs.
6. **Chaque élément atteint → ses affirmations** : d'abord celles ancrées dans la plage modifiée, puis dans le symbole, puis dans la feature, l'entité et le bloc.

Exemple : un agent crée `functions/src/family.ts`, avec une fonction qui modifie directement `accessCodes`. Il ne touche pas `access.ts`. L'étape 4 voit l'écriture dans `accessCodes`, et l'étape 6 remonte l'invariant déclaré sur l'entité. L'agent reçoit la règle même s'il a contourné le fichier qui la faisait respecter.

D'où une règle d'écriture : **un invariant qui porte sur des données se déclare sur l'entité**, pas seulement dans la fonction qui le fait respecter aujourd'hui.

## 7. Livrer par niveaux

Personne ne peut construire à l'avance le contexte exact d'une tâche : il se découvre en travaillant. On livre donc par niveaux, chacun au moment où il devient utile.

| Niveau | Moment | Canal | Contenu | Budget |
|---|---|---|---|---|
| **0. Orientation** | début de session | hook de démarrage (`SessionStart`), ou outil `vision_overview` appelé en premier | les blocs en une ligne chacun ; les features déclarées avec leur but ; les décisions globales à ne jamais annuler | ≈ 500 tokens |
| **1. Comprendre** | l'agent choisit une feature, un bloc, une donnée | `vision_flow`, `vision_architecture` (bloc), `vision_data` (nouveau) | le déroulé calculé, plus les affirmations de la feature : règles, pannes, raisons ; pour une donnée : forme, qui l'écrit, cycle de vie, sens des états | 1 à 2 k |
| **2. Modifier** | chaque modification de fichier | hook avant et après modification | les conséquences (section 6), avec leurs affirmations classées | 100 à 400 |
| **3. Approfondir** | à la demande | `vision_knowledge` (nouveau) | une affirmation en détail : le pourquoi long, le lien vers la PR ou l'ADR, le code ancré depuis sa référence | à la demande |

- **Le niveau 0** donne à l'agent de quoi choisir selon le **sens**, avec des buts écrits en français, plutôt que selon des noms de fichiers.
- **Le niveau 2 le protège s'il a mal choisi** : il part de ce qu'il touche vraiment, pas de ce qu'il pensait toucher.
- **Les niveaux 1 et 3** ne coûtent que s'il les demande.

Exemple de message de niveau 2, environ 150 tokens :

```
family.ts écrit accessCodes (l.14) · nouvelle fonction appelable, sans feature déclarée
Features atteintes : access.code (Entrer avec un code d'accès)
À respecter :
  ! invariant data.access-codes.one-account — Un code n'est lié qu'à un seul compte. [à jour]
  ! décision  data.access-codes.source-of-truth — accessCodes fait foi ; access/current n'est qu'une copie écrite par les Functions. [à jour]
  règle access.gate — Sans code actif, l'app ne laisse pas entrer. [structure vérifiée]
Ensuite : l'écriture dans accessCodes déclenche accessMirror (functions/src/access-mirror.ts:4)
Détail : vision_knowledge access.code
```

### Et `vision_context` ?

Il choisit les fichiers en comparant les mots de la tâche aux noms du code (ADR 0005). Sur Nafar, « Permettre à une famille de partager un code d'accès » retient 6 fichiers, dont 3 hors sujet, sur le seul mot `code`. « Rembourser les crédits quand un rendu vidéo échoue » n'en retient aucun, parce que la tâche est en français et le code en anglais.

Il ne peut donc pas porter la connaissance. Il reste un complément : comparer aussi les mots de la tâche au **texte des affirmations et aux buts des concepts**, écrits dans la langue des tâches. Le résultat est présenté comme une piste, jamais comme une liste complète. Son défaut de langue fait l'objet d'un ticket à part.

## 8. Réduire sans rien perdre

- **Classement par gravité.** D'abord les décisions à ne pas annuler et les invariants, puis les pannes, les règles, les raisons, et en dernier les buts.
- **Mémoire de session.** Une affirmation déjà envoyée pendant la session ne l'est plus, sauf si son état a changé. Le journal garde des identifiants, jamais de contenu.
- **Plafond honnête.** Au-delà du budget, le message le dit : « 7 autres affirmations : `vision_knowledge access.code` ». Rien n'est coupé en silence.
- **État toujours visible.** Une affirmation à reconfirmer ou contredite est donnée avec son état. Elle n'est jamais présentée comme vraie, et jamais cachée.
- **Longueur bornée.** Une phrase par affirmation, avec une longueur maximale vérifiée par le schéma. Le pourquoi détaillé va dans un champ à part, servi au niveau 3.
- **Texte condensé, pas de JSON indenté** (ADR 0013) : une ligne par fait, des chemins courts, pas de répétition.
- **Deltas.** Au niveau 2, seul ce que la modification change est envoyé.

## 9. Qui construit le contexte

| Acteur | Sa part | Pourquoi lui |
|---|---|---|
| **L'agent en cours** | comprendre la tâche, choisir où aller, demander le niveau suivant | c'est le seul qui comprend le sens |
| **VisionLayer** | garantir que tout ce qui est relié à ce que l'agent touche lui parvient, condensé, avec son état ; calculer les conséquences | c'est calculable, donc fiable |
| **Les agents précédents** | écrire le pourquoi au moment où ils le savaient | après coup, personne ne le sait plus |
| **L'humain** | relire la connaissance en PR, reconfirmer, trancher les décisions | c'est lui qui gouverne |

### La boucle « au fur et à mesure »

1. L'agent reçoit le contexte (niveaux 0 à 3).
2. Il modifie le code. Le hook lui signale ce qu'il touche, et ce qu'il devrait déclarer : un nouveau point d'entrée sans feature, un code ancré qui a changé.
3. Il écrit ou reconfirme des affirmations dans `.vision/knowledge/`, dans la même PR que le code.
4. Le rapport de PR montre à l'humain ce qui a été touché, périmé, contredit, et ce qui manque.
5. L'humain relit et fusionne. La connaissance vit avec le code, dans Git.
6. L'agent suivant reçoit une connaissance plus riche et vérifiée.

VisionLayer ne lance aucun agent, n'écrit aucune affirmation et n'approuve rien (ADR 0013). Il lit, vérifie, condense et signale.

## 10. Ce qu'on garantit, ce qu'on ne garantit pas

**Garanti :**
- Tout ce qui est déclaré et relié par la carte au code touché parvient à l'agent.
- Rien de périmé n'est présenté comme vrai.
- Le coût de chaque niveau est borné et mesuré.
- Ce que voit l'humain et ce que reçoit l'agent sont identiques sur le fond.

**Pas garanti :**
- **Une règle jamais déclarée.** VisionLayer ne l'invente pas ; le rapport de PR signale seulement les zones sans connaissance.
- **Un lien que la carte ne sait pas extraire.** Par exemple, un appel dynamique ou une configuration non analysée comme `firestore.rules` aujourd'hui. Ces trous sont affichés comme « à vérifier », mais la règle n'arrive pas à l'agent.
- **Le bon choix de départ de l'agent.** Le niveau 2 compense, sans le remplacer.

## 11. Valider la méthode par des mesures

Tout ce qui précède est une hypothèse tant qu'on ne l'a pas mesuré. Cette section décrit comment on la valide, ou comment on la réfute.

**C'est une étape de validation, pas une fonction du produit.** Le banc d'essai vit à côté de VisionLayer, dans `workflow/bench/`. Il n'a pas d'écran, n'est pas exposé par le serveur MCP et ne part pas avec le paquet. Il produit un rapport, le doc 05, qui décide de la suite. Une fois le format figé (ADR 0014), la partie coûteuse est archivée. Seule la partie déterministe (11.4) reste dans les tests, parce qu'elle ne coûte rien.

### 11.1 Les trois hypothèses

| # | Hypothèse | Ce qui la réfute |
|---|---|---|
| H1 | **Compréhension.** Avec VisionLayer, l'agent respecte des nuances qu'il ne trouve pas en lisant le code que la tâche lui fait ouvrir. | Le taux de nuances respectées avec VisionLayer n'est pas nettement meilleur que sans. |
| H2 | **Économie.** Pour un résultat au moins aussi bon, l'agent consomme nettement moins de tokens. | Le coût médian avec VisionLayer n'est pas nettement plus bas que sans, à résultat égal. |
| H3 | **Réduire sans perdre.** Le contexte par niveaux fait aussi bien que toute la connaissance d'un coup, pour moins cher. | La livraison par niveaux perd des nuances que la connaissance complète fait respecter. |

Les seuils chiffrés sont écrits en 11.7, **avant** le premier passage.

### 11.2 Les quatre conditions

Tout est identique d'une condition à l'autre, sauf ce que l'agent reçoit de VisionLayer.

| Condition | L'agent reçoit | Sert à |
|---|---|---|
| **A. Sans VisionLayer** | le dépôt et son CLAUDE.md ou AGENTS.md actuel ; ses outils habituels | la référence : ce que fait un agent aujourd'hui |
| **B. Carte seule** | A, plus les outils MCP actuels sans connaissance (`vision_architecture`, `vision_flow`, `vision_inspect`, `vision_source`) | séparer ce qu'apporte la carte de ce qu'apporte le pourquoi |
| **C. Par niveaux** | B, plus la connaissance livrée comme en section 7 : niveau 0 au démarrage, niveau 2 par hook, niveaux 1 et 3 à la demande | la méthode proposée |
| **D. Tout d'un coup** | B, plus toute la connaissance du dépôt collée au démarrage | le plafond : ce qu'on obtient sans rien réduire |

**Ce qui est identique :**
- le commit de départ, dans un worktree jetable recréé à chaque passage ;
- la consigne, mot pour mot ;
- le modèle, le harness et sa version ;
- les outils et permissions autorisés ;
- la limite de tours et de durée ;
- une session vierge : pas de mémoire, pas d'historique, un dossier de configuration isolé pour le harness.

**La connaissance est la même en C et en D.** Seule la manière de la livrer change.

### 11.3 Les scénarios

Chaque scénario est une tâche réaliste qui porte **une nuance** : quelque chose que l'agent doit respecter, que la connaissance dit, et que le code ouvert par la tâche ne montre pas.

**Règles d'écriture :**
- **La consigne est formulée comme la formulerait un utilisateur.** Elle ne fait jamais allusion à la nuance.
- **La connaissance est écrite avant les consignes, à partir du code réel.** Elle est écrite comme l'écrirait un agent au fil de son travail, jamais taillée pour la consigne. Idéalement, elle est écrite par quelqu'un qui ne connaît pas encore les consignes.
- **Un oracle caché juge le comportement, pas les paroles de l'agent.** Ce sont des tests et des vérifications structurelles, copiés dans le worktree seulement après la fin du passage.
- **Calibrage.** Si la condition A réussit presque toujours un scénario, la nuance se lit dans le code : le scénario ne mesure pas H1. On le retire, ou on le garde comme témoin.

**Les sortes de nuances à couvrir**, chacune avec au moins un scénario :

| Sorte | Ce qu'on vérifie | Piège typique |
|---|---|---|
| Contournement | l'invariant tient même quand la tâche mène à un autre fichier que celui qui le fait respecter | écrire directement dans une collection sans passer par la fonction gardienne |
| Décision à ne pas annuler | l'agent ne « simplifie » pas ce qui a une raison | remplacer une file par un appel direct « pour aller plus vite » |
| Conséquence distante | l'agent voit l'effet d'une modification locale sur un déclencheur ailleurs | renommer un champ qu'un déclencheur lit |
| Contrainte métier | une valeur qui semble arbitraire est comprise et appliquée au bon endroit | changer une limite seulement dans l'app, pas sur le serveur |
| Panne et rejeu | le comportement reste juste quand une tâche est rejouée | rembourser deux fois |
| Affirmation périmée | une affirmation marquée « à reconfirmer » et devenue fausse n'est pas suivie aveuglément | appliquer une règle ancienne que le code a changée |
| Témoin | une tâche sans nuance particulière | vérifie que VisionLayer n'ajoute pas de coût pour rien |

**Première série sur Nafar**, à partir du commit `6e3b2c4` de la branche `vision/knowledge-prototype`, dans un clone jetable. Les consignes exactes, la connaissance et les oracles sont dans `workflow/bench/nafar/` (RYP-136) ; ils ont été confirmés sur le code réel.

| # | Consigne | Nuance | Oracle caché |
|---|---|---|---|
| S1 | Permettre à une famille de partager un code d'accès. | Un code n'est lié qu'à un seul compte ; `accessCodes` fait foi. | Aucune écriture dans `accessCodes` hors de la fonction gardienne ; un deuxième compte ne peut pas activer le même code. |
| S2 | Rembourser les crédits quand un rendu vidéo échoue. | Un même job peut échouer deux fois, et la tâche peut être rejouée : le remboursement se fait une seule fois. | Un remboursement ajouté porte un identifiant par job ou un drapeau transactionnel. |
| S3 | Ajouter un nouveau fournisseur de génération vidéo. | Les appels passent par la file, jamais en direct depuis la fonction appelable. | Aucun appel au fournisseur hors du traitement de la file. |
| S4 | Autoriser deux vidéos de plus par jour aux testeurs. | Un testeur est aussi borné par un total à vie (3) : relever seulement le plafond du jour ne lui donne rien. Le plafond reste vérifié sur le serveur. | Un testeur neuf peut réellement créer deux vidéos de plus par jour ; le serveur vérifie toujours ; l'app n'ajoute pas son propre contrôle. |
| S5 | Afficher l'état d'accès dans le profil. | `access/current` est une copie écrite par les Functions ; l'app ne l'écrit jamais. | Aucune écriture dans `access/current` depuis l'app ; les règles d'accès ne sont pas assouplies. |
| S6 | La consigne de S4, avec une affirmation fausse, « à reconfirmer » : « il n'y a pas de total à vie ». | L'agent vérifie le code avant de suivre une affirmation « à reconfirmer ». | Même oracle que S4. |
| S7 | Changer le libellé du bouton de création. | Aucune (témoin). | Tests existants verts ; coût comparé. |

**Ensuite, deux dépôts d'autres stacks** (RYP-172), avec deux ou trois scénarios chacun, pour vérifier que rien n'est taillé pour Nafar.

### 11.4 D'abord le banc déterministe, sans agent et sans token

Avant de lancer le moindre agent, on vérifie que VisionLayer **livre bien** la nuance. Si elle n'arrive pas dans le contexte, inutile de payer des passages pour le constater.

Pour chaque scénario :
1. Écrire deux diffs de référence : la bonne solution, et la solution piégée (celle qui casse la nuance).
2. Pour chacun, calculer les messages des niveaux 0 et 2, et le niveau 1 de la feature concernée.
3. Vérifier que :
   - l'affirmation qui porte la nuance y figure, avec son état ;
   - le message tient dans son budget ;
   - pour le diff piégé, la nuance arrive au niveau 2, même quand le fichier touché n'est pas celui qui la faisait respecter (cas S1).

C'est un test ordinaire, dans `tests/`. Il reste dans la suite après la validation, parce qu'il protège la livraison contre les régressions pour zéro token.

### 11.5 Ce qu'on mesure, et comment

| Mesure | Définition | Source |
|---|---|---|
| Tâche réussie | les tests visibles du dépôt passent et la consigne est remplie | tests du dépôt |
| **Nuance respectée** | l'oracle caché passe | oracle du scénario |
| Régression | un test existant qui passait ne passe plus | tests du dépôt |
| Signalement | l'agent a cité, déclaré ou reconfirmé la règle (secondaire : ce sont des paroles) | transcript |
| **Tokens** | entrée, sortie, lecture de cache et écriture de cache, séparément ; total | usage rapporté par le harness (sortie JSON de `claude -p`, événements de `codex exec --json`) |
| Part de VisionLayer | tokens des sorties d'outils VisionLayer et des hooks | transcript, compté par outil |
| Exploration | fichiers lus, appels d'outils, tours | transcript |
| Durée | du lancement à la fin | chronomètre du banc |

**Pas de prix inventés.** Le coût est exprimé en tokens. Une conversion en argent ne se fait qu'avec un tarif réel cité avec sa source et sa date.

**Les transcripts restent en local**, hors Git, pour diagnostiquer. Seules les mesures agrégées sont commitées avec le rapport.

### 11.6 Combien de passages

- **Pilote :** S1 dans les quatre conditions, trois passages chacune, un seul harness (Claude Code). Il sert à roder le banc et à mesurer le coût réel d'un passage. La condition A passe aussi trois fois sur chaque scénario, pour le calibrage.
- **Campagne :** les sept scénarios dans les quatre conditions, cinq passages par case, avec Claude Code puis Codex. Cela fait 280 passages.
- **Ablation :** la condition C rejouée en retirant un niveau à la fois (sans 0, sans 1, sans 2) sur les scénarios où C l'emporte sur B. Elle dit quel niveau porte le résultat.

Le volume de la campagne est fixé **après** le pilote, à partir du coût mesuré, et jamais sur une estimation.

Les résultats sont donnés en comptes (« 4 sur 5 »), pas seulement en pourcentages. Cinq passages donnent une tendance, pas une preuve. Un écart d'un passage n'est pas un résultat.

### 11.7 Critères de décision, écrits avant de lancer

Ces seuils sont fixés depuis le 29/09/2026 et commités avec les scénarios, avant le premier passage, dans `workflow/bench/criteres.md`. On ne les ajuste pas après avoir vu les chiffres.

- **H1 est validée si :**
  - sur les scénarios à nuance (S1 à S6), C respecte la nuance dans au moins 80 % des passages ;
  - C fait au moins 30 points de mieux que A ;
  - aucun scénario n'a C en dessous de A.
- **H2 est validée si :**
  - à taux de réussite au moins égal, le total médian de tokens de C est au plus 70 % de celui de A ;
  - sur le témoin S7, C ne coûte pas plus de 10 % de plus que A.
- **H3 est validée si :**
  - C est à moins de 10 points de D sur les nuances ;
  - C coûte au plus 70 % de D.

**Si une hypothèse tombe**, l'ablation et le détail des passages ratés disent ce qui manquait : une nuance jamais livrée (voir 11.4), livrée trop tard, noyée dans le bruit, ou livrée mais ignorée. On corrige, puis on rejoue les scénarios concernés, sans changer les critères.

### 11.8 Ce qui garde la comparaison honnête

- **Ordre aléatoire des passages**, pour qu'une panne du fournisseur ou un changement de version ne touche pas une seule condition.
- **Mêmes limites partout** : tours, durée, outils.
- **Le cache de prompt est compté à part.** Sinon, une condition qui passe en second profiterait du cache de la première.
- **Oracles et critères écrits avant les passages, et versionnés.**
- **Échantillon relu à l'aveugle.** Un humain relit dix diffs tirés au hasard sans connaître la condition, pour vérifier que l'oracle juge bien.
- **VisionLayer ne sert pas de juge.** Les oracles sont des tests et des vérifications écrits à la main, pas des sorties de VisionLayer.
- **Ce que le banc ne prouve pas** est écrit dans le rapport : il ne mesure que les nuances qu'on a su écrire en scénarios, sur les dépôts testés, avec les modèles de la date.

### 11.9 Qui lance quoi

Le banc est un script lancé par un humain (`pnpm bench`). Il :
1. crée les worktrees ;
2. prépare la condition : configuration MCP, hooks, fichier de connaissance ;
3. lance le harness en mode non interactif ;
4. copie l'oracle et le lance ;
5. écrit les mesures, puis supprime le worktree.

VisionLayer n'y lance rien : il fournit le contexte exactement comme chez un utilisateur. L'ADR 0013 est respecté, puisque c'est nous qui lançons les agents, et seulement pour cette validation.

### 11.10 Le livrable

Le **doc 05, « Résultats de la validation »**, contient :
- les scénarios, les critères et le protocole, tels qu'ils étaient avant les passages ;
- les tableaux par condition et par scénario, avec les comptes et les tokens médians ;
- l'ablation ;
- trois passages ratés analysés en détail ;
- les limites ;
- la décision : figer le format (ADR 0014), le corriger, ou revoir la méthode.

## 12. Les règles de toujours

- Le serveur MCP reste en lecture seule.
- Les hooks sortent toujours en 0, ne bloquent jamais l'agent, et restent rapides : pas de reconstruction de la carte à chaque modification.
- Le journal ne stocke ni prompt, ni commande, ni contenu de fichier.
- Aucune valeur de variable d'environnement, aucun `.env` lu.
- Rien de faux n'est montré ou envoyé comme vrai.
- VisionLayer n'écrit que dans `.vision/`, et seulement sur un clic humain. La connaissance est écrite par les agents et relue en PR.

## 13. Tickets proposés

Ils forment le jalon 2. La colonne « Actuel » dit ce qu'est devenu l'ancien ticket : gardé, modifié, remplacé, ou nouveau.

### A. Fondations

| # | Ticket | Actuel | Terminé quand |
|---|---|---|---|
| A1 · RYP-175 | **Graphe du système et fonction `reach`** : un index unique des nœuds et liens extraits et déclarés (section 5), et `reach(départ) → atteints + chemin`. Construit depuis la carte persistée et la connaissance, sans rescanner. | nouveau | L'écran Feature et un test sur `shop` obtiennent les mêmes éléments atteints par `reach` ; le calcul sur Nafar tient sous 300 ms à partir de la carte persistée. |
| A2 · RYP-176 | **Conséquences d'un changement** (section 6) : plages modifiées → symboles → points d'entrée → features → données → déclenchements → affirmations, classées. | nouveau | Sur `shop` : modifier `cancelOrder` remonte ses features, l'écriture dans `orders` et `onOrderCreated`. Le cas `family.ts` remonte l'invariant d'entité. |
| A3 · RYP-177 | **Format v1 des affirmations** : longueur bornée ; champ `detail` pour le pourquoi long ; lien `see` vers une PR ou un ADR ; `decision` marquable « ne pas annuler » ; invariants de données sur l'entité. Version du schéma. | avance une partie de RYP-142 | Le schéma refuse une affirmation trop longue ; les anciens fichiers se lisent toujours. |
| A4 · RYP-178 | **Rendu condensé commun** : un seul formateur pour l'agent (classement, plafond honnête, état, budget), utilisé par tous les canaux. | nouveau | Chaque canal passe par lui ; un test vérifie le plafond et l'état affiché. |

### B. Livraison

| # | Ticket | Actuel | Terminé quand |
|---|---|---|---|
| B1 · RYP-179 | **Niveau 0** : `vision_overview` et hook de démarrage de session (blocs, features et buts, décisions à ne pas annuler). | nouveau | ≤ 500 tokens sur Nafar ; support du hook vérifié pour Claude Code et Codex. |
| B2 · RYP-133 | **Niveau 1** : `vision_flow` et `vision_architecture` (bloc) ajoutent les affirmations de la feature ou du bloc ; nouvel outil `vision_data` pour une entité. | remplace RYP-133 | Le texte d'une feature contient ses règles et ses pannes avec leur état ; mesuré en tokens. |
| B3 · RYP-134 | **Niveau 2** : hook avant et après modification, avec les conséquences (A2), la mémoire de session et les deltas. | remplace RYP-134 | < 300 ms par modification sur Nafar ; ne bloque jamais ; ne renvoie pas deux fois la même affirmation. |
| B4 · RYP-180 | **Niveau 3** : `vision_knowledge` (un concept, une affirmation, son détail, son code depuis la référence). | nouveau | Lecture seule ; chemins bornés au dépôt. |
| B5 · RYP-181 | **`vision_context` comme piste** : comparer aussi la tâche au texte des affirmations et aux buts. | modifie RYP-133 | Les deux tâches Nafar ci-dessus retrouvent leurs concepts ; le résultat est marqué « par mots-clés ». |
| B6 · RYP-182 | **`vision_context` et la langue** : une tâche en français ne retrouve pas un code en anglais. Étudier un lexique issu des buts déclarés, sans interprétation sémantique cachée. | nouveau | Décision écrite ; pas de régression sur les tests existants. |

### C. Écriture au fil de l'eau

| # | Ticket | Actuel | Terminé quand |
|---|---|---|---|
| C1 · RYP-135 | **Consignes aux agents** pour CLAUDE.md et AGENTS.md : quoi écrire, ne jamais répéter un fait extrait, invariants de données sur l'entité, décisions, reconfirmation. | RYP-135, élargi | Texte court, relu, avec des exemples tirés du prototype. |
| C2 · RYP-183 | **Demandes d'écriture par le hook** : nouveau point d'entrée sans feature, code ancré modifié, affirmation contredite → l'agent est invité à déclarer ou à reconfirmer. | nouveau | Sur `shop`, ajouter une fonction appelable déclenche la demande. |
| C3 · RYP-140 | **Section Connaissance du rapport de PR**, à partir des conséquences (A2) sur tout le diff. | RYP-140, fondé sur A2 | Le rapport liste touché, périmé, contredit, manquant. |
| C4 · RYP-141 | **Regroupements proposés** pour les points d'entrée sans feature. | RYP-141, gardé | Inchangé. |

### D. Justesse des états

| # | Ticket | Actuel |
|---|---|---|
| D1 · RYP-137 | Un but ne se périme pas à chaque modification du corps (constat 2). | RYP-137, gardé |
| D2 · RYP-138 | Règle appliquée côté client seulement (constat 4), calculée par `reach` et le type de bloc. | RYP-138, fondé sur A1 |
| D3 · RYP-139 | Tests qui atteignent les ancrages : alias, Python, test qui cite l'identifiant. | RYP-139, gardé |

### E. Valider, puis figer

Ils remplacent ensemble RYP-136. E1 à E4 sont une étape de validation, pas des fonctions du produit (section 11).

| # | Ticket | Actuel | Terminé quand |
|---|---|---|---|
| E1 · RYP-136 | **Scénarios, oracles et critères, écrits avant tout passage** (11.3, 11.7) : connaissance de Nafar pour le banc, consignes S1 à S7, oracles cachés, seuils de décision. | remplace RYP-136 | Commité et relu ; calibrage de A fait sur le pilote. |
| E2 · RYP-184 | **Banc déterministe** (11.4) : diffs de référence et piégés ; vérification que la nuance arrive au bon niveau, avec son état, dans le budget. | nouveau | Test dans la suite normale ; S1 à S6 livrent leur nuance, y compris le diff piégé de S1. |
| E3 · RYP-185 | **Lanceur de banc temporaire** (11.2, 11.5, 11.9) : `workflow/bench/`, worktrees jetables, quatre conditions, Claude Code et Codex en mode non interactif, mesures par passage. | nouveau | Le pilote tourne de bout en bout ; mesures en JSON ; transcripts hors Git. |
| E4 · RYP-186 | **Campagne et doc 05** (11.6, 11.10) : pilote, campagne, ablation, puis deux dépôts d'autres stacks. | nouveau, avec RYP-172 | Doc 05 écrit ; décision prise sur H1, H2 et H3. |
| E5 · RYP-142 | **Format et livraison définitifs, ADR 0014** ; archivage du lanceur. | RYP-142, élargi | Après E4, D1 et D2. |
| E6 · RYP-143 | **Connaissance réelle de Nafar**, écrite par les agents au fil de leurs tâches. | RYP-143, gardé | Nécessite ton accord pour modifier learn-app. |

### Ordre

> **29/09/2026.** Ces tickets sont maintenant répartis entre les jalons 3, 4 et 5 de la feuille de route : on construit d'abord l'interface et le démarrage d'un projet ([06](./06-demarrer-un-projet.md)). L'ordre ci-dessous reste celui du jalon 5.

La condition C (section 11.2) livre les niveaux 0 à 3 : tout ce qu'elle utilise doit exister avant la campagne.

1. E1 dès maintenant, avant d'écrire le code de livraison, pour que les scénarios ne soient pas taillés pour lui.
2. Les fondations : A1 puis A2 ; A3 et A4 en parallèle.
3. Tout ce que la condition C livre : B1, B2, B3, B4, et les consignes C1.
4. E2, pour vérifier la livraison sans dépenser de tokens.
5. E3 et le pilote, puis la campagne (E4). Ses résultats peuvent changer la suite.
6. C2, C3, D1, D2, D3, B5, B6, C4.
7. E5, puis E6.

Les écrans profitent des mêmes fondations. Le calcul des conséquences servira l'écran Revues refait (RYP-154) et la Feature en profondeur (RYP-152).

## 14. Questions à trancher

1. **Le chemin général** (sections 5 à 9) : est-ce celui qu'on prend ?
2. **Le niveau 0 par hook de démarrage** : il pousse environ 500 tokens à chaque session, même courte. L'autre choix est un outil que l'agent appelle lui-même, sur consigne. Je propose le hook, car un agent qui oublie d'appeler l'outil part sans carte.
3. **Les affirmations périmées** : données avec leur état, plutôt que cachées. C'est ce que je propose.
4. **learn-app** : le banc (E1 à E4) reste dans le worktree du prototype ; E6 et les consignes dans le CLAUDE.md de Nafar modifient le vrai dépôt, avec ton accord le moment venu.
5. ~~**Les seuils de décision** (11.7)~~ : tranché le 29/09/2026, gardés tels quels (`workflow/bench/criteres.md`).
6. ~~**Qui écrit la connaissance du banc**~~ : tranché le 29/09/2026 pour aller vite. On garde la connaissance du prototype, écrite avant les scénarios, plus cinq affirmations ajoutées depuis le code réel en écrivant les scénarios. Ce biais est signalé dans `workflow/bench/README.md` et le sera dans le doc 05.
