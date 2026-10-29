# Knowledge layer — 1. Ce que VisionLayer doit savoir

**Statut :** brouillon de réflexion. Aucun format, aucune arborescence, aucune convention n'est décidé ici.
**Suite :** [02-modele-de-connaissance.md](./02-modele-de-connaissance.md) (comment représenter cette connaissance).

## Pourquoi ce document

Avant d'inventer un format de fichier pour que les agents « documentent », il faut savoir **quelles questions VisionLayer doit pouvoir répondre**, et pour chacune **qui peut y répondre de façon fiable** :

- **E — extrait** : VisionLayer le lit lui-même dans le code, les manifestes, la configuration, Git, les tests. Toujours vrai, avec sa ligne de preuve.
- **D — déclaré** : seul celui qui a écrit le code (agent ou humain) le sait. C'est ce que le knowledge layer doit capturer.
- **E+D** : VisionLayer propose (un découpage, un regroupement), l'auteur nomme, confirme ou corrige.

Une règle découle de ce tri et guide tout le reste :

> **Si VisionLayer peut le vérifier, l'agent ne l'écrit pas.** S'il l'écrit quand même, VisionLayer compare le déclaré à l'observé et montre l'écart.

C'est la suite directe des trois sources de l'[ADR 0012](../decisions/0012-runtime-architecture-and-feature-flows.md) (extrait, rédigé par un agent, déclaré par un humain) et de la distinction fait / interprétation de [vision-layer-concept.md §6](../vision-layer-concept.md).

---

## Partie A — Ce qu'il faut savoir pour comprendre un système logiciel

Lire le code ne suffit pas à comprendre un système. Un développeur expérimenté se pose, souvent sans les nommer, une vingtaine de questions. Les voici, chacune en langage courant, avec ce qu'elle veut dire, pourquoi elle compte, un exemple tiré de Nafar (learn-app) quand il existe, et qui peut y répondre.

Ces dimensions sont la vraie liste de ce que VisionLayer doit montrer. Les écrans actuels n'en couvrent qu'une partie.

### A1. Le but — « à quoi ça sert ? »
- **Sens :** pourquoi cette partie existe, pour qui, quel problème elle résout. Le code dit *ce que* fait une fonction, jamais *pourquoi* on en a eu besoin.
- **Pourquoi ça compte :** sans le but, on ne peut pas juger si un changement est bon ; on ne peut que juger s'il compile.
- **Source :** D.

### A2. Le vocabulaire du métier — « de quoi parle-t-on ? »
- **Sens :** les mots du domaine et leur sens exact dans *ce* projet : « chapitre », « maîtrise », « code d'accès », « job vidéo ». Les développeurs parlent de *langage ubiquitaire* (*ubiquitous language*) : le même mot, avec le même sens, dans la bouche du métier et dans le code.
- **Pourquoi ça compte :** la moitié des bugs de compréhension viennent d'un mot qui veut dire deux choses (« utilisateur » = compte ? élève ? parent ?).
- **Exemple :** dans Nafar, un utilisateur « connecté » n'est pas forcément un utilisateur « qui a accès » : l'accès passe par un code d'accès échangé (`redeemAccessCode`).
- **Source :** D. VisionLayer peut seulement repérer les mots qui reviennent (noms de collections, de types).

### A3. Les acteurs et leurs droits — « qui peut faire quoi ? »
- **Sens :** qui utilise le système (élève, administrateur, un service automatique, un autre système), et ce que chacun a le droit de faire. Deux mots à ne pas confondre :
  - **authentification** : *qui es-tu ?* (prouver son identité : mot de passe, Google…) ;
  - **autorisation** : *as-tu le droit ?* (une fois identifié, vérifier les permissions).
- **Exemple :** dans Nafar, trois niveaux : connecté, avec accès (code échangé), administrateur (`requireAdmin`). Les règles Firestore utilisent `isOwner` 29 fois : « on ne touche qu'à ses propres données ».
- **Source :** E+D. Les gardes et les règles sont extraites ; le sens des rôles (« un admin est un membre de l'équipe pédagogique ») est déclaré.

### A4. Les frontières de confiance — « où arrive ce qui vient de l'extérieur ? »
- **Sens :** tout ce qui vient de l'extérieur (le navigateur de l'utilisateur, un webhook, une réponse d'IA) peut être faux ou malveillant. Une *frontière de confiance* est l'endroit où on vérifie avant de croire. Le code côté client n'est **jamais** une frontière : l'utilisateur peut le modifier.
- **Pourquoi ça compte :** c'est là que naissent les failles de sécurité.
- **Exemple :** App Check est activé sur 9 fonctions ; les autres acceptent des appels sans cette vérification.
- **Source :** E pour les points d'entrée et les vérifications présentes ; D pour « ce point d'entrée est volontairement public ».

### A5. Les données et leur source de vérité — « où est la vraie valeur ? »
- **Sens :** pour chaque information, quel est l'endroit qui fait foi (la *source de vérité*), et quelles sont les copies. Une donnée **primaire** est saisie ou produite une seule fois ; une donnée **dérivée** est recalculée à partir d'autres (un total, un résumé, un cache).
- **Pourquoi ça compte :** si deux endroits croient chacun détenir la vérité, ils finissent par se contredire.
- **Source :** E pour où c'est écrit et lu ; D pour « celle-ci est la référence, celle-là une copie ».

### A6. Le cycle de vie des données — « par quels états passe une chose ? »
- **Sens :** beaucoup d'objets ont des états : un job vidéo est créé, en cours, terminé, en échec. C'est une *machine à états* : des états et les transitions permises entre eux. Aussi : qui la crée, qui la modifie, quand elle est supprimée (ou jamais).
- **Exemple :** `videoJobs` et son champ `status`, écrit par les Functions puis par le service vidéo.
- **Source :** E pour les transitions écrites dans le code (on lit les `status: "…"`) ; D pour le sens de chaque état et les transitions **interdites**.

### A7. Les flux — « que se passe-t-il quand l'utilisateur clique ? »
- **Sens :** le chemin complet d'une action, d'un bout à l'autre, à travers les blocs. Deux familles :
  - **synchrone** : l'utilisateur attend la réponse ;
  - **asynchrone** : le travail continue après la réponse (une file, un déclencheur), l'utilisateur est prévenu plus tard.
- **Pourquoi ça compte :** c'est la seule façon de comprendre une feature qui traverse l'app, les Functions, une file et un service.
- **Exemple :** création vidéo : l'app appelle une Function, qui crée un `videoJob` et met une tâche dans Cloud Tasks, qui appelle le service vidéo `/render`, qui écrit le fichier et met à jour le job.
- **Source :** E pour la mécanique (déjà en grande partie dans `flow.ts`) ; D pour les noms d'étapes et les liens que le code ne montre pas (une URL lue dans une variable d'environnement).

### A8. Les contrats — « qu'est-ce qui est promis entre deux parties ? »
- **Sens :** un *contrat* est une promesse entre celui qui appelle et celui qui répond. La signature (types) n'en est qu'une partie. Le reste :
  - **précondition** : ce qui doit être vrai *avant* l'appel (« l'utilisateur est connecté ») ;
  - **postcondition** : ce qui est garanti *après* (« le job existe en base ») ;
  - **erreurs** : lesquelles, et ce qu'elles signifient.
- Un contrat concerne aussi une interface avec plusieurs implémentations interchangeables : la couche IA de Nafar définit `AiProvider`, implémenté pour Anthropic, Gemini et DeepSeek, et choisi par `getProvider`.
- **Source :** E pour l'interface, les implémentations, la fabrique ; D pour les garanties que chaque implémentation doit respecter.

### A9. Les règles métier et les invariants — « qu'est-ce qui doit toujours être vrai ? »
- **Sens :**
  - une **règle métier** est une décision du domaine traduite en code (« un script n'est généré qu'une fois par réponse ») ;
  - un **invariant** est une propriété qui doit être vraie *à tout moment*, quoi qu'il arrive (« un exercice hors du programme actif n'est jamais servi »).
- **Pourquoi ça compte :** c'est ce qu'un agent casse le plus facilement sans s'en rendre compte, parce que rien dans le code ne dit que c'est intouchable.
- **Source :** D pour l'énoncé ; E pour l'endroit qui le fait respecter et les tests qui l'atteignent.

### A10. Les pannes — « que se passe-t-il quand ça rate ? »
C'est la dimension la plus souvent oubliée, et celle qui fait les incidents de production.
- **Sens :** tout appel réseau, toute IA, toute base peut échouer, être lente, ou réussir à moitié. Pour chaque étape :
  - **nouvelle tentative** (*retry*) : qui réessaie, combien de fois ;
  - **idempotence** : refaire la même opération deux fois donne-t-il le même résultat qu'une seule fois ? (sinon une nouvelle tentative crée un doublon, débite deux fois…) ;
  - **échec partiel** : si l'étape 3 sur 5 échoue, dans quel état reste le système ?
  - **délai maximal** (*timeout*) ;
  - **compensation** : ce qu'on défait si la suite échoue.
- **Exemple :** le service vidéo répond `200` même en cas d'échec (`service.ts:91`), pour que Cloud Tasks ne réessaie pas en boucle ; l'échec est écrit dans le job. Un commentaire de `render-core.ts` dit le contraire : c'est exactement le genre d'écart que VisionLayer doit montrer.
- **Source :** E pour les `try/catch`, les codes de retour, la configuration des files ; D pour l'intention (« on répond 200 exprès »).

### A11. La concurrence — « et si deux choses arrivent en même temps ? »
- **Sens :** deux utilisateurs, deux onglets, deux tentatives de la même tâche peuvent agir au même moment. Une *condition de course* (*race condition*) est un bug qui n'apparaît que selon l'ordre d'arrivée. On s'en protège par des **transactions** (tout ou rien) ou des verrous.
- **Source :** E pour les transactions présentes ; D pour « cette opération doit être atomique parce que… ».

### A12. La cohérence — « quand tout le monde voit-il la même chose ? »
- **Sens :** après une écriture, certaines parties voient la nouvelle valeur tout de suite, d'autres plus tard (cache, copie, déclencheur). On parle de *cohérence à terme* (*eventual consistency*) quand le système finit par être d'accord, mais pas instantanément.
- **Source :** D, surtout (« l'écran peut montrer l'ancien statut quelques secondes »).

### A13. Le temps — « qu'est-ce qui dépend de l'heure ? »
- **Sens :** tâches planifiées, expirations (par exemple, un code d'accès qui ne vaut que pendant une durée donnée), fuseaux horaires, ordre des événements.
- **Source :** E pour les `onSchedule` et les dates écrites ; D pour les durées qui ont un sens métier.

### A14. Les dépendances externes et leurs hypothèses — « sur quoi compte-t-on sans le contrôler ? »
- **Sens :** chaque service extérieur (fournisseur d'IA, Cloud Tasks, paiement) a ses propres règles : quotas, limites, comportement en cas d'erreur. Le code *suppose* ces comportements sans les écrire.
- **Exemple :** « Cloud Tasks réessaie toute réponse différente de 2xx » est une hypothèse sur Google, pas un fait du repository.
- **Source :** E pour la présence du service ; D pour les hypothèses.

### A15. Les environnements et la configuration — « qu'est-ce qui change entre dev et prod ? »
- **Sens :** le même code tourne dans plusieurs environnements, avec des variables et des projets différents. Une variable présente en dev et absente en prod est une panne qui attend.
- **Exemple :** les variables `TASKS_*` et `RENDER_*` n'apparaissent que dans le `.env` de dev.
- **Source :** E pour les noms de variables (jamais les valeurs) ; D pour « tel projet est la prod ».

### A16. Les effets irréversibles — « qu'est-ce qu'on ne peut pas annuler ? »
- **Sens :** envoyer un email, débiter de l'argent, appeler une IA payante, supprimer un fichier. Ces actions méritent plus d'attention que le reste.
- **Source :** E (appels d'IA, suppressions, envois reconnus) ; D pour « c'est payant / irréversible ».

### A17. Le coût et la charge — « qu'est-ce qui grossit avec le nombre d'utilisateurs ? »
- **Sens :** quelles opérations coûtent (tokens d'IA, rendu vidéo, lectures de base), lesquelles sont sur le *chemin chaud* (appelées à chaque action), où sont les quotas.
- **Source :** E en partie (appels d'IA, boucles autour d'écritures, coût en tokens des agents) ; D pour les ordres de grandeur attendus. Jamais de prix inventé.

### A18. L'observabilité — « comment sait-on que ça marche en production ? »
- **Sens :** les journaux (*logs*), les mesures, les alertes. Sans elles, une panne silencieuse dure des semaines.
- **Exemple :** `logTelemetry` est appelé 9 fois dans un seul flux.
- **Source :** E pour les appels de journalisation ; D pour « cette alerte existe dans tel outil ».

### A19. L'évolution et la compatibilité — « que casse-t-on en changeant ça ? »
- **Sens :** une donnée déjà en base garde son ancien format ; une vieille version de l'app peut encore appeler une Function. Changer une forme de donnée demande une *migration* ; changer un contrat peut casser les anciens clients.
- **Source :** E pour la forme actuelle et son historique Git ; D pour « les anciens documents n'ont pas ce champ ».

### A20. Les décisions et leurs limites — « pourquoi c'est fait comme ça, et qu'est-ce qui n'est pas géré ? »
- **Sens :** le choix fait, les alternatives écartées et pourquoi ; les limites connues et la *dette technique* (ce qu'on a fait vite en sachant qu'il faudra le reprendre).
- **Pourquoi ça compte :** sans elles, le développeur suivant « corrige » une chose volontaire, ou refait une erreur déjà évitée.
- **Source :** D.

### Ce que cette liste change

Les dimensions A10 (pannes), A11 (concurrence), A12 (cohérence), A14 (hypothèses externes), A16 (irréversible) et A19 (compatibilité) sont **absentes** des écrans actuels. Ce sont pourtant celles qui distinguent « je sais lire ce code » de « je comprends ce système ». Le knowledge layer doit pouvoir les porter, et VisionLayer extraire tout ce qui peut l'être (les `try/catch`, les transactions, les codes de retour, les planifications).

---

## Partie B — Inventaire par écran

Pour chaque écran : les questions qu'il doit trancher, leur source, et l'état aujourd'hui (**livré**, **partiel**, **absent**).

### Système (la carte)
| Question | Source | Aujourd'hui |
|---|---|---|
| Quels blocs s'exécutent, et comment sont-ils reliés ? | E | livré |
| Quel est le rôle de chaque bloc, et pourquoi est-il séparé ? | D | absent |
| Quelles frontières de confiance ? | E+D | absent |
| Quels liens le code ne montre pas (URL dans une variable) ? | D | partiel (`.vision/infra.yaml`) |

### Bloc et « comment ça marche »
| Question | Source | Aujourd'hui |
|---|---|---|
| Par où entre-t-on, qu'est-ce qui en sort ? | E | livré |
| Comment ça fonctionne, étape par étape ? | E+D | maquettes (auth, IA, Cloud Tasks) |
| Quel contrat le bloc expose, quelles garanties ? | E+D | absent |
| Que se passe-t-il en cas d'échec ? | E+D | absent |

### Features
| Question | Source | Aujourd'hui |
|---|---|---|
| Quelles features existent (nom, but pour l'utilisateur) ? | D | absent : on liste des points d'entrée, pas des features |
| Quels points d'entrée forment une feature ? | E+D | absent |
| Qu'est-ce qu'elle touche (données, IA, files) ? | E | livré |
| Combien elle coûte en agents ? | E | livré (tokens ; montant si prix déclarés) |

### Feature (le tracé)
| Question | Source | Aujourd'hui |
|---|---|---|
| Quelles étapes, dans quel ordre, avec quel code ? | E | livré |
| Comment s'appelle chaque étape pour un humain ? | E+D | partiel (commentaires du développeur) |
| Pourquoi cette branche existe-t-elle ? | D | absent |
| Quelles règles et invariants protège-t-elle ? | D + E (lieu de contrôle) | absent |
| Quels tests l'atteignent ? | E | absent |

### Données
| Question | Source | Aujourd'hui |
|---|---|---|
| Quelles entités (collections, tables, buckets, clés) ? | E | partiel (Firestore, Storage) |
| Quelle forme, qui lit, qui écrit ? | E | partiel |
| Quels états et quelles transitions ? | E + D (sens, interdits) | maquette |
| Quelle est la source de vérité, quelles copies ? | D | absent |
| Quand une donnée est-elle supprimée ? | E+D | absent |

### Contrats (nouvel écran)
| Question | Source | Aujourd'hui |
|---|---|---|
| Quelles interfaces ont plusieurs implémentations et une fabrique ? | E | absent |
| Quelles garanties chaque implémentation doit tenir ? | D | absent |
| Quelle implémentation est choisie, et selon quoi ? | E | absent |

### Technologies, Déploiement
| Question | Source | Aujourd'hui |
|---|---|---|
| Quelles technologies, quelles versions, où ? | E | livré |
| Où tourne chaque bloc, par quel job part-il ? | E | livré |
| Quel projet ou compte est la prod, qui peut déployer ? | D | absent (« fiche à rédiger ») |
| Quelles variables manquent dans quel environnement ? | E | livré (noms seulement) |

### Revues (le rapport de changement)
| Question | Source | Aujourd'hui |
|---|---|---|
| Qu'est-ce que ce changement fait au système ? | E | livré (diff d'architecture) |
| Quelle connaissance a-t-il ajoutée, rendue fausse ou laissée manquante ? | E+D | absent |
| Pourquoi ce choix plutôt qu'un autre ? | D | absent |

---

## Partie C — Ce que les agents doivent fournir

### À demander, par ordre de valeur
1. **Les features** : nom, but pour l'utilisateur, points d'entrée. Sans cela, l'écran Features reste une liste de fonctions.
2. **Les règles et invariants**, chacun avec l'endroit du code qui le fait respecter.
3. **Le comportement en cas d'échec**, quand il est voulu (« on répond 200 exprès », « cette opération est idempotente »).
4. **Les noms d'étapes** des flux non triviaux, et le pourquoi des branches non évidentes.
5. **Le but** des blocs, des modules, des entités, et le sens des états.
6. **Les garanties des contrats.**
7. **Les hypothèses sur les services externes.**
8. **Les décisions**, avec les alternatives écartées ; les limites connues.
9. **Le vocabulaire du métier**, quand un mot a un sens propre au projet.

### À ne jamais demander
Tout ce que VisionLayer extrait : imports, appels, signatures, types, dépendances et versions, fichiers d'un bloc, collections lues et écrites, points d'entrée, variables d'environnement, historique, tests qui atteignent un symbole, coût. Une affirmation qui répète un de ces faits est du bruit, et elle deviendra fausse la première.

### Ce qui fait que ce n'est pas une charge documentaire
- On n'écrit **que sur ce qu'on vient de toucher**, jamais « documente ce module ».
- On n'écrit **que ce qui sera relu** : par l'agent suivant (qui reçoit les invariants avant de coder), par l'humain (dans la PR et dans les écrans).
- Un helper trivial ne reçoit rien. La plupart des modifications ajoutent entre zéro et trois affirmations.

---

## Partie D — Questions ouvertes

1. **Le vocabulaire du métier** (A2) vit-il dans le knowledge layer ou dans un glossaire à part ?
2. **Les humains** écrivent-ils avec le même format que les agents, avec une provenance distincte ?
3. **La langue** des affirmations : celle du projet, ou toujours la même ?
4. **Les dimensions A12, A17, A18** (cohérence, charge, observabilité) dépendent souvent d'outils hors du repository. Jusqu'où VisionLayer les lit-il (ADR 0013 : lire chez les autres, renvoyer vers eux) ?
5. **Le prototype** : quelles features de Nafar prendre en premier ? Proposition : la création vidéo (asynchrone, pannes, file, IA) et l'échange de code d'accès (autorisation, règle métier).
