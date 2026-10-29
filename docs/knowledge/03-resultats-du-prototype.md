# Knowledge layer — 3. Résultats du prototype

**Statut :** prototype mené le 28/09 sur learn-app (Nafar). Rien n'est fusionné dans learn-app ; le format des fichiers reste jetable.
**Prérequis :** [01](./01-ce-que-visionlayer-doit-savoir.md), [02](./02-modele-de-connaissance.md).

## Ce qui a été construit

**Côté VisionLayer** ([vision/knowledge/](../../vision/knowledge/), CLI `vision knowledge [chemin] [--json]`) :
- lecture de `.vision/knowledge/**/*.yaml` : concepts, affirmations, ancrages `chemin#Symbole@marqueur` ;
- résolution des ancrages sur l'arbre syntaxique : symboles de premier niveau, méthodes `Classe.méthode`, parties sans nom repérées par un marqueur `// @k identifiant` ;
- **empreinte** du code ancré : les jetons de l'arbre, sans commentaires ni mise en forme, nom du symbole neutralisé (un renommage garde la même empreinte) ;
- **point de référence** : le commit le plus récent qui a écrit les lignes de l'affirmation (`git blame`) ; le code ancré à ce commit (`git show`) est comparé au code actuel ;
- **déplacements** : marqueur retrouvé ailleurs, sinon même empreinte ailleurs (renommé ou déplacé), sinon même nom ailleurs (candidat), sinon orphelin ;
- **vérification structurelle** par type : règle et invariant (condition, refus ou filtre), panne (chemin d'erreur), garantie (interface ou type) ;
- tests dont les imports atteignent un fichier ancré ; points d'entrée de la carte qu'aucune feature ne couvre.

Tests : [tests/knowledge.test.ts](../../tests/knowledge.test.ts) rejoue les expériences ci-dessous sur un dépôt Git temporaire.

**Côté learn-app** : worktree `../learn-app-knowledge`, branche `vision/knowledge-prototype`, partie de `67f2921`.

| Commit | Contenu |
|---|---|
| `6e3b2c4` | 5 fichiers de connaissance (3 features, 1 entité, 1 contrat), 18 affirmations, 7 marqueurs `// @k` |
| `ec8e77c` | refactoring sans changement de comportement : `claimJobById` renommé, `accessMirrorRef` déplacé dans un autre fichier, commentaire ajouté dans une partie ancrée |
| `9eb6089` | trois changements de comportement : plafond du jour relâché, garde « un code, un compte » supprimé avec son marqueur, plus de réponse 200 en cas d'échec du rendu |
| `231e6e3` | reconfirmation de `video.daily-cap`, texte corrigé |

## Résultats, critère par critère (doc 02 §9)

| Critère | Résultat |
|---|---|
| 1. Les écrans répondent aux questions pour ces features, sans rien de faux affiché comme vrai | **Données prêtes, écrans pas encore branchés.** Le rapport contient ce qu'attendent Features, Connaissance et les sections « Règles et invariants » et « Si ça rate » des maquettes. |
| 2. Renommage et déplacement retrouvés sans intervention | **Oui.** `claimJobById` → `claimQueuedJob` et `accessMirrorRef` déplacé : affichés « déplacé », toujours valides. Le commentaire ajouté ne périme rien. |
| 3. Un changement de comportement périme les affirmations concernées, et seulement elles | **Oui, avec une réserve.** Plafond relâché : à reconfirmer. Garde supprimé avec son marqueur : orphelin. Chemin d'erreur supprimé : contredit. Deux autres passent à reconfirmer parce que leur ancrage **contient** le code modifié : c'est juste pour l'invariant de transaction, c'est du bruit pour le but de `redeemAccessCode` (voir constat 2). Les 13 autres restent intactes. |
| 4. Peu d'affirmations, aucune redite d'un fait extrait | 18 pour 3 features, 1 entité et 1 contrat, de 1 (gestion des codes) à 9 (création vidéo) par concept. Aucune ne décrit un import, un appel ou une donnée lue. Le coût d'écriture par un agent n'est pas encore mesuré (écrites à la main). |
| 5. Un agent qui reçoit ces affirmations évite de casser l'invariant | **Pas encore testé** : il faut d'abord les servir par `vision_context`. |

## Constats

1. **« Vérifié » promet trop.** La vérification structurelle dit que l'ancrage peut encore porter la phrase (il y a bien une condition, un chemin d'erreur), pas que la phrase est vraie. Un `if` qui ne refuse plus la bonne chose reste « vérifié ». Dans l'interface, il faut dire **« structure vérifiée »**, et réserver « vérifié » aux cas où le sens est contrôlé (un statut écrit, un code de retour, un test qui cite l'identifiant).
2. **Le but ancré sur une fonction entière périme à chaque modification.** C'est le bruit que le doc 02 craignait. Deux pistes : ne comparer que la signature et le nom pour un `purpose` ; ou ancrer le but sur le concept (la feature) plutôt que sur une fonction.
3. **Un marqueur laissé en place quand on supprime son code se rattache à l'instruction suivante.** Le code désigné change, donc l'affirmation passe à reconfirmer : rien de faux n'est affiché. Supprimer le marqueur avec son code donne « orphelin », plus clair.
4. **L'écart « le code d'accès ne protège que l'app » n'est pas détecté.** Aucune vérification par ancrage ne le voit : il faut raisonner sur le **bloc** où l'affirmation est appliquée. Piste : une règle d'accès ancrée seulement dans un bloc client (la carte connaît le type du bloc) est signalée « appliquée côté client seulement ».
5. **Aucun test n'atteint les ancrages** : learn-app n'a qu'un test de règles Firestore et un test Python. La détection ne suit que les imports relatifs ; les alias (`@/…`) et les tests Python sont à ajouter.
6. **Le point de référence par `git blame` fonctionne**, reconfirmation comprise : toucher une ligne de l'affirmation (texte corrigé, ligne `confirmed`) la fait repasser « vérifiée » au nouveau commit. Rien de technique n'est écrit dans le fichier de connaissance.
7. **Les numéros de ligne des maquettes** venaient de la copie de travail de la branche Codex, qui a des changements non commités par rapport à `67f2921` (décalage d'une vingtaine de lignes dans `job.ts`). Dans le produit, les lignes viennent toujours du rapport calculé, jamais d'une saisie.
8. **Durée** : 6,6 s pour tout learn-app, surtout pour reconstruire la carte ; la connaissance elle-même prend une fraction de seconde.

## Branché dans l'interface

- **Serveur** : `GET /api/knowledge` (le rapport, gardé tant que HEAD, `git status` et la carte n'ont pas changé), `GET /api/knowledge/claim?id=` (code ancré au point de référence comparé au code actuel, commits sur le fichier ancré depuis), `POST /api/knowledge/confirm` (clic humain confirmé, affirmation « à reconfirmer » seulement : écrit sa seule ligne `confirmed:`, à commiter avec le code).
- **Connaissance** (ancien « Fiches ») : états par compteur, affirmations rangées par concept, onglets par état, points d'entrée sans feature, erreurs de lecture. Le compteur de la navigation signale les affirmations à reprendre.
- **Features** : features déclarées (but, points d'entrée vérifiés sur la carte, ce qu'elles atteignent, état de leur connaissance), puis les points d'entrée avec leur feature ; onglet « Sans feature déclarée ».
- **Feature** : carte de la feature déclarée au-dessus du déroulé ; « Règles et invariants », « Si ça rate », « Autres affirmations » sous le déroulé ; un ancrage cliqué montre le code à droite. Sur un symbole hors feature : les affirmations ancrées dans ce symbole.
- **Tiroir d'une affirmation** : ancrages, commit de référence, tests, raison de l'état, différence du code ancré, « Toujours vrai » et « Copier la demande pour l'agent ».
- Constat 1 appliqué : « structure vérifiée » partout (interface et CLI).

Corrigé en chemin :
- à la même seconde (commits rapprochés, rebase), le point de référence prenait parfois le commit le plus ancien ; il prend maintenant celui qui descend des autres (le test du cycle complet échouait une fois sur trois) ;
- un marqueur `// @k` devenait le titre d'une étape du déroulé ; il est maintenant transparent ;
- un ancrage vers un fichier d'environnement est refusé.

## Suite proposée

1. ~~Brancher le rapport dans l'interface.~~ Fait, voir ci-dessus.
2. Servir les affirmations aux agents : `vision_context` renvoie celles des fichiers visés ; le hook après modification signale celles dont le code ancré vient de changer. Puis tester le critère 5.
3. Trancher le constat 2 (but non périmé par le corps de la fonction).
4. Seulement ensuite : format définitif et ADR 0014.
