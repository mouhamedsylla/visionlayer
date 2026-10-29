# ADR 0012 — Une vraie architecture : blocs qui s'exécutent, liens prouvés, algorithme des features

**Statut :** Accepté (phase 1 livrée ; phases 2 et 3 planifiées ci-dessous)

## Contexte
Retour du premier utilisateur, sur Nafar : l'écran « Architecture » n'était **pas une architecture**, seulement l'arborescence des dossiers avec les imports entre fichiers — « c'est comme si on ouvrait VS Code et on regardait les fichiers ». Ce qu'on attend d'une architecture :
- **ce qui s'exécute** (apps, fonctions, conteneurs), **où**, et **qui parle à qui** (appels, lectures, écritures, déclencheurs, files, services externes) ;
- des **blocs dans lesquels on entre** : ce qu'il y a vraiment dans Firestore, dans la couche IA, dans un service ;
- la **logique algorithmique des features**, pour lire vite une base de code en revue humaine ;
- pour **n'importe quel projet**, pas seulement Nafar ;
- et, puisqu'on code avec des agents, que **les agents enrichissent** cette description de ce qu'ils construisent.

## Décision

### Trois sources, toujours distinguées
| Source | Apporte | Garantie |
|---|---|---|
| **Extrait** (cette phase) | blocs, points d'entrée, liens, intérieurs, algorithme des features | déterministe, chaque fait porte sa ligne |
| **Rédigé par un agent** (phase 2) | rôle d'un bloc, raison d'un choix, sens métier | fiche ancrée au code, revue dans la PR |
| **Déclaré par un humain** | ce qui est hors du repository (où pointe `RENDER_URL`, ce qu'est `VITE_BACKEND_URL`) | `.vision/*.yaml`, étiqueté « déclaré » |

### Phase 1 — la carte extraite ([vision/arch/](../../vision/arch/))
- **Blocs qui s'exécutent** ([build.ts](../../vision/arch/build.ts)) : une app par page HTML qui charge un module (`<script type="module" src>`, reliée à sa cible Firebase Hosting) ; les Cloud Functions (dossier source de `firebase.json`) ; un service par image Docker dont le `CMD` lance un fichier du repository ; un serveur pour tout autre `listen()`. **Le code d'un bloc = fermeture de ses imports** depuis ses points d'entrée — un fichier partagé appartient à tous les blocs qui l'exécutent ; un script ou une maquette qu'aucun bloc n'exécute n'apparaît pas.
- **Services managés et externes**, créés seulement si le code les utilise : Firestore, Cloud Storage, Authentification, couche IA, Cloud Tasks / Pub/Sub, backends nommés par leur variable d'environnement (dont la valeur n'est jamais lue).
- **Détecteurs sur l'arbre syntaxique** ([analyze.ts](../../vision/arch/analyze.ts)), pas des expressions régulières : points d'entrée (`onCall`, `onRequest`, `onDocument*`, `onSchedule`, `onTaskDispatched`, routes HTTP), `httpsCallable('nom')`, Firestore modulaire et Admin — y compris à travers des **variables** (`const ref = …`), des **fonctions utilitaires** qui renvoient un chemin (`txCol(uid)`, même importées) et des **transactions** (`tx.set(ref, …)`) —, Storage, Auth, clients d'IA (SDK du catalogue ou hôte d'API), modèles cités, mises en file, `fetch`/`axios` avec résolution de l'URL (littéral, gabarit, constante, variable d'environnement). Une seule fonction `effectOf` classe un appel, partagée par la carte et les parcours.
- **Attribution fine** : une fonction « atteint » les fichiers que **sa propre déclaration** importe (pas tout ce qu'importe son fichier — `functions/src/index.ts` réexporte tout) ; dans son propre fichier, seules ses lignes et celles des fonctions locales qu'elle utilise comptent.
- **Intérieurs** : Firestore = arbre des collections (code + `firestore.rules`), avec qui lit, qui écrit, ce qui est déclenché et la ligne de la règle ; couche IA = fournisseurs, modèles cités, features qui l'atteignent — le **module IA** est le fichier qui construit un client, ou un dossier dédié (≥ 2 tels fichiers et ≥ 25 % du dossier), jamais un dossier partagé ; file = ses cibles.
- **Algorithme d'une feature** ([flow.ts](../../vision/arch/flow.ts)) : pour un point d'entrée, les étapes dans l'ordre du code — conditions de refus (`si !uid → refuse : HttpsError(…)`), branches, boucles, transactions, lectures/écritures, IA, files, requêtes, retours ; chaque **appel interne** porte le **résumé de ses effets en profondeur** (« lit users/{}/wallet · écrit users/{}/creditTx ») et **se déplie** à la demande ; une fonction locale (`const call = () => …`) est dépliée sur place ; en amont, **qui l'appelle** (la fonction cliente et les écrans qui l'importent) ; en aval, **ce qu'elle déclenche** (collection écrite → fonction déclenchée ; mise en file). Les étiquettes sont le **code condensé**, jamais une paraphrase.
- **Points d'attention** : fonction appelable qu'aucun client n'appelle ; appel d'une fonction que rien ne définit ; chemin Firestore calculé à l'exécution ; cible de file lue dans une variable d'environnement (à déclarer).
- **Interface** : le niveau « Architecture » est cette carte (niveau par défaut) ; l'ancien écran devient « **Structure du code** ». Clic sur un bloc → ses liens et points d'entrée ; clic sur une flèche → les lignes qui la prouvent ; « Entrer » → l'intérieur ; une feature → son algorithme, avec le code de la fonction à droite, lignes des étapes marquées. CLI : `vision archi [chemin]`, `vision archi --feature <nom>`.
- **Persistance** : `.vision/architecture.json` écrit par `scan`/`update` (archivé en `architecture.previous.json`) ; les parcours sont calculés à la demande (`/api/flow`), fichiers analysés une fois et gardés tant que le modèle ne change pas. Lecture de fichiers bornée aux fichiers cités par la carte (`/api/arch-file`), jamais un `.env`.

### Corrections du modèle, révélées par Nafar (profitent à tous les niveaux)
- **Alias d'import** ([model/aliases.ts](../../vision/model/aliases.ts)) : `paths` du tsconfig le plus proche et paquets du workspace (`@nafar/firebase`). 340 imports internes de Nafar passaient pour des paquets externes.
- **`import()` dynamique** (routes paresseuses `lazy(() => import(…))`) : une dépendance comme une autre. Sans elle, 4 fonctions appelées par l'app n'étaient reliées à rien.

### Phase 2 — fiches rédigées par les agents (à faire)
- `.vision/architecture/<bloc|feature>.md`, écrites par l'agent **dans la PR qui construit** (revues comme le code ; le serveur MCP reste en lecture seule, ADR 0009) : rôle, raisons, sens métier.
- Chaque affirmation **ancrée** (fichier, symbole, ligne) ; VisionLayer marque « à revérifier » une fiche dont le code ancré a changé ou disparu, et signale un bloc ou une feature extrait sans fiche.
- Outil MCP en lecture `vision_architecture` (l'agent lit la carte avant de coder) ; consigne standard pour `AGENTS.md` / `CLAUDE.md`.
- Liens déclarés (Cloud Tasks → service vidéo) dans la même fiche, étiquetés « déclaré ».

### Phase 3 — plus d'écosystèmes (à faire)
Routes Express/Fastify/Hono/Next.js (API routes, Server Actions), schémas Prisma / migrations SQL / Supabase (intérieur d'une base relationnelle), BullMQ / SQS / Kafka, OpenAI / LangChain, apps Next.js/Remix ; puis campagne sur plusieurs projets réels.

## Rationale
- Une architecture qu'on ne peut pas vérifier serait une interprétation de plus : chaque bloc, lien et étape renvoie à une ligne lisible sur place.
- L'algorithme est lu dans l'arbre syntaxique, pas résumé par un modèle : ce qu'on relit est ce qui s'exécute. Le « pourquoi » relève des fiches (phase 2), étiquetées comme telles.
- Des détecteurs sur l'arbre et une résolution des indirections (variables, utilitaires, transactions) : sur Nafar, un repérage par motifs aurait manqué la moitié des accès Firestore.

## Conséquences
- Sur Nafar : 10 blocs, 21 liens, 21 points d'entrée, 32 collections (27 avec leur règle), 4 fournisseurs d'IA et 6 modèles cités ; `exoFeedback` et `exoFeedbackQuota` déployées mais appelées par aucun client ; la cible de la file de rendu à déclarer.
- Limites connues : seuls les fichiers JS/TS sont analysés (le rendu Python de Nafar est un bloc sans intérieur) ; un chemin Firestore construit dynamiquement reste signalé, pas deviné ; les méthodes appelées sur un objet reçu en paramètre (`provider.turn()`) ne sont pas suivies — l'IA est alors vue à l'endroit où le fournisseur est obtenu ; `LessonWriter.tsx` (limite de grammaire, ADR 0011) manque encore à la fermeture de l'app studio.
- Tests : [tests/arch.test.ts](../../tests/arch.test.ts) sur [tests/arch-fixtures/shop](../../tests/arch-fixtures/shop) (alias, `import()` dynamique, utilitaire de chemin, transaction, déclencheur, IA, Cloud Tasks, conteneur, règles).
