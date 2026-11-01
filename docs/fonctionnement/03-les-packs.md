# 3. Les packs

Code : [vision/facts/packs.ts](../../vision/facts/packs.ts), packs livrés dans [vision/packs/](../../vision/packs/). Décisions : doc 07 §4.3, questions tranchées le 01/10/2026 (YAML, avec une porte en TypeScript).

## Le concept

Pour la syntaxe, `app.post("/payments", h)` est un appel de méthode comme un autre. Qu'il s'agisse d'une route HTTP, seul Express le sait. Un **pack** écrit ce savoir comme des données : quels fichiers regarder, quel motif chercher dans l'arbre syntaxique, quand ce motif compte, et quel fait neutre il produit.

Un pack décrit une technologie, pas un projet : il est écrit à partir de l'API de la technologie, pour que tout projet qui l'emploie soit lu. Il a deux rôles : reconnaître ses formes et les ranger dans les catégories communes, et porter sa sémantique, c'est-à-dire ce que la technologie garantit, ce qu'elle laisse au code et ses modes d'échec, d'après sa documentation. Le second rôle n'est aujourd'hui tenu qu'en partie (règles d'accès d'un stockage, forme des données, attributs littéraux). Le moteur, lui, ne contient aucun nom de pile. Un test (`le moteur ne connaît aucune pile`) échoue si un nom comme `express` ou `firestore` apparaît dans `vision/facts/`. Ajouter une pile, c'est ajouter un pack, et un petit projet de test.

## Le format

Un pack est un fichier YAML, validé par un schéma strict : un champ inconnu est refusé au chargement.

```yaml
id: express                       # minuscules, chiffres, tirets
name: Express
tech: [express]                   # technologies du catalogue que ce pack sait lire
languages: [javascript, typescript]   # pack de code
when: { imports: [express] }      # ne s'ouvre que si le fichier importe l'un de ces paquets
match:                            # des motifs
  - id: route
    query: |                      # requête tree-sitter
      (call_expression
        function: (member_expression
          object: (identifier) @app
          property: (property_identifier) @verb)
        arguments: (arguments . (string) @path (_) @handler .))
    where:                        # filtres sur les captures
      verb: [get, post, put, patch, delete]
      app: { bound_to: express }
    at: path                      # facultatif : la capture dont la ligne sert de preuve
    emit: entrypoint($file, http, "{verb:upper} {path}", @handler:symbol, @handler:line)
rules: |                          # facultatif : règles propres au pack (chapitre 4)
  …
script: express.ts                # facultatif : la porte TypeScript
```

Un pack de manifeste remplace `languages` et `when` par `files`, des motifs de noms de fichiers (`[Dockerfile, "*.Dockerfile"]`), et fait son travail dans `script`. Quand ses manifestes disent comment une unité est lancée ou où elle tourne (`fly.toml`, `docker-compose.yml`, un `Dockerfile`, `firebase.json`), il porte `deploys: true` : l'écran Déploiement compte ces fichiers comme des déclarations, et pas une page HTML qui fait seulement exister une app. Un fait littéral sur une unité, comme sa région, passe par `unit_attr(Fichier, Unité, Clé, Valeur)` et devient un attribut du bloc.

### `query` : le motif

Une requête tree-sitter, dans la syntaxe standard de tree-sitter. Les morceaux utiles portent un nom (`@verb`). Une requête compilée est gardée en mémoire, par langage.

Le binding de tree-sitter pour Node ignore certains prédicats des requêtes (`#any-of?`) : les filtres s'écrivent donc dans `where`, évalués par VisionLayer.

### `where` : quand le motif compte

| Forme | Vrai si la capture… |
|---|---|
| `[a, b]` ou `{ any: [a, b] }` | vaut `a` ou `b` |
| `{ not: [a, b] }` | ne vaut ni `a` ni `b` |
| `{ match: "^[A-Z_]+$" }` | correspond à l'expression |
| `{ import_of: paquet }` | est un nom importé de ce paquet (`import cron from "node-cron"`, ou `const cron = require("node-cron")`) |
| `{ bound_to: paquet }` | est une variable créée par ce que fournit le paquet : `const app = express()`, `express.Router()`, `new Queue(…)` |

La valeur d'une capture est celle d'une chaîne littérale si c'en est une, sinon le texte du code.

`bound_to` évite les faux amis : `cache.get("/x", y)` a la forme d'une route, mais `cache` n'est pas créé par `express()`.

### `emit` : le fait produit

`emit` est une émission ou une liste d'émissions, de la forme `relation(argument, …)`. Une émission dont un argument manque (capture absente, paquet inconnu) ne produit rien.

| Argument | Valeur |
|---|---|
| `$file`, `$line` | le fichier, la ligne de la preuve |
| `@nom` | la valeur de la capture |
| `@nom:raw` | son texte brut, guillemets compris |
| `@nom:upper`, `@nom:lower` | en majuscules, en minuscules |
| `@nom:symbol` | le nom appelé, après avoir retiré les enveloppes : `route(createPayment)` donne `createPayment` ; une fonction écrite sur place donne `""` |
| `@nom:line` | la ligne de ce que désigne `:symbol` |
| `@nom:pkg` | le paquet d'où vient ce nom importé ; rien si c'est un import interne |
| `"texte {nom} {nom:upper}"` | un gabarit |
| `mot`, `"chaîne"`, `42` | une constante |

Chaque fait émis porte `source: "pack"` et l'identifiant du pack.

### `rules` : ce que le pack sait relier

Des règles dans la syntaxe du chapitre 4. Elles servent à deux choses : déclarer des données propres à la pile, et relier les faits du pack à ceux des autres fichiers.

```
table_tech("pgTable", postgresql, relational).
accesses(F, Op, Tech, Name, L) :- db_op(F, Op, V, L), resolves(F, V, G, _),
                                  table(G, V, Name, Fn), table_tech(Fn, Tech, _).
```

### `script` : la porte TypeScript

Ce qu'un motif ne sait pas dire passe par un module TypeScript, chargé avec le pack. Il reçoit le fichier, son arbre et ses imports (pour un fichier de code), et une fonction `fact(relation, valeurs, ligne)` ; il renvoie des faits.

```ts
import type { PackScript } from "../facts/packs.js";
const script: PackScript = ({ file, root, imports, fact }) => [ … ];
export default script;
```

Trois usages aujourd'hui :
- **les manifestes**, qui ne sont pas du code (`docker.ts`, `compose.ts`, `fly.ts`, `html.ts`, `firebase.ts`, `node-package.ts`) ;
- **les API faites de chaînes d'appels**, qu'un seul motif ne couvre pas : `firebase-functions.ts` reconnaît `onCall(…)` comme `functions.region(…).firestore.document(…).onCreate(…)` ; `node-http.ts`, les routes d'un serveur `node:http` écrites en comparant `req.url` ;
- **les enveloppes** : `http-client.ts` reconnaît une fonction qui transmet son premier paramètre à l'URL de `fetch` ou d'axios, pour que `api("/payments", { method: "POST" })` devienne un appel HTTP.

Le script garde l'empreinte du pack : le modifier fait relire tous les fichiers.

Un script ne lit que son fichier. Quand une information dépend de deux fichiers, chacun émet son fait et une règle les joint. Exemple : `firebase.json` dit que la codebase `functions` vit dans le dossier `functions` (`fn_source`) ; `functions/package.json` dit ce que son paquet lance (`pkg_runs`, la source `src/index.ts` plutôt que le compilé `lib/index.js`) ; la règle `unit_runs(F, N, C) :- fn_source(F, N, D), pkg_runs(D, C).` relie les deux. Un fichier modifié ne relit ainsi que lui.

## Comment un pack s'écrit

1. **L'inventaire.** La liste des formes de l'API de la technologie, d'après sa documentation, et des formes du langage qu'elles emploient (une constante, une fonction, un singleton, un paramètre typé…). Elle est écrite avant le code.
2. **Un exemple par forme**, écrit sur place dans un test, sans code d'un projet réel.
3. **Le pack**, jusqu'à ce que les exemples passent.
4. **Les projets de référence, à la fin.** Un écart y est classé : une forme documentée oubliée par l'inventaire est ajoutée à l'inventaire, à un exemple, puis au pack ; une particularité du projet n'est jamais ajoutée, elle doit apparaître comme non lue.

## Les relations que l'assembleur attend

Un pack peut créer les relations qu'il veut. Pour apparaître dans la carte, il doit aboutir, directement ou par ses règles, aux relations neutres que lit l'assembleur (chapitre 5) : `entrypoint`, `unit`, `unit_runs`, `unit_instances`, `unit_image`, `store_decl`, `trigger_on`, `accesses`, `entity_def`, `entity_seen`, `uses_store`, `channel_topic`, `publishes`, `subscribes`, `client`, `calls_external`, `inbound_from`, `http_call`, `env`, `env_required`, `unit_tech`, et pour les constats `finding`, `finding_store`.

## Les packs livrés

| Pack | Ce qu'il reconnaît | Vérifié sur |
|---|---|---|
| `core` | règles communes, sans pile (chapitre 4) | atelier-api |
| `express` | routes HTTP, routeurs montés sous un préfixe (d'un fichier à l'autre), routes chaînées, fichiers servis, le code de chaque route ; [inventaire](packs/express.md) | atelier-api, et un exemple par forme |
| `node-cron` | tâches planifiées (`schedule`, `createTask`, expression écrite ou en constante importée), tâches en arrière-plan dans un fichier, le code derrière une enveloppe ou une méthode ; une expression calculée reste non lue ; [inventaire](packs/node-cron.md) | atelier-api, et un exemple par forme |
| `bullmq` | files (nom écrit ou en constante importée), mises en file, tâches répétées, planificateurs, flux parent-enfant, travailleurs et processeurs isolés dans un fichier ; [inventaire](packs/bullmq.md) | atelier-api, et un exemple par forme |
| `drizzle` | tables (schémas nommés, créateurs, vues, schéma réparti), colonnes et contraintes (clés, unicité, index partiels, vérifications), lectures et écritures, API relationnelle, SQL brut ; [inventaire](packs/drizzle.md) | atelier-api, et un exemple par forme |
| `sql-migrations` | déclencheurs des fichiers `.sql`, la fonction qu'ils exécutent et ce qu'elle écrit ; [inventaire](packs/sql-migrations.md) | atelier-api, et un exemple par forme |
| `sdk` | clients de Stripe, Resend et nodemailer (créés avec `new`, en appelant le module, par une fabrique), leurs appels d'un fichier à l'autre, y compris par une fonction qui rend le client ; webhooks Stripe dont la signature est vérifiée, qui ne comptent pas comme une requête ; [inventaire](packs/sdk.md) | atelier-api, et un exemple par forme |
| `zod-env` | noms des variables d'environnement validées avec Zod, obligatoires ou non (schéma écrit sur place, dans une variable, dans un autre fichier, enrichi ou composé) ; un schéma qui ne valide pas l'environnement ne compte pas ; [inventaire](packs/zod-env.md) | atelier-api, et un exemple par forme |
| `http-client` | `fetch` (options dans une variable, `Request`, `new URL`), axios (verbes, configuration, instances et le chemin de leur base, d'un fichier à l'autre), enveloppes (méthode écrite, fixée ou en paramètre, enveloppe d'enveloppe) ; la base devant le chemin, la requête et l'ancre sont retirées ; [inventaire](packs/http-client.md) | atelier-api, et un exemple par forme |
| `stores` | stockages reconnus par leur image de conteneur, ou par la ligne où le code ouvre une connexion (pg, Postgres.js, MySQL2, MongoDB, Mongoose, ioredis, node-redis) ; une requête SQL ou une collection nommée est une lecture ou une écriture ; [inventaire](packs/stores.md) | atelier-api, et un exemple par forme |
| `logs` | journaux (console, pino, winston) : ce qu'ils écrivent, pour le constat « données personnelles dans les journaux » ; [inventaire](packs/logs.md) | atelier-api, et un exemple par forme |
| `docker` | ce que lance une image : commande et point d'entrée, script du paquet (`npm start`), code compilé ramené à sa source ; le fichier lancé suit `WORKDIR`, `COPY`, les variables et les étapes (`COPY --from`, `FROM étape`) ; un nom par Dockerfile ; [inventaire](packs/docker.md) | atelier-api, et un exemple par forme |
| `compose` | services : images connues (stockages), builds avec leur contexte et leur Dockerfile nommé (`unit_ctx`, `unit_dockerfile`, que lit le pack Docker), commande et point d'entrée propres, copies (`replicas`, `scale`), fragments `<<: *x` ; un Dockerfile construit par la composition n'est pas un déployable de plus ; [inventaire](packs/compose.md) | atelier-api, et un exemple par forme |
| `fly` | une app Fly : son Dockerfile (nommé ou par défaut, contexte du dossier de `fly.toml`), ses groupes de processus, ou l'app elle-même sous son nom ; minimum de machines (`[http_service]`, `[[services]]`) ; noms de `[env]` ; [inventaire](packs/fly.md) | atelier-api, et un exemple par forme |
| `html`, `vite` | une page qui charge un module (attributs dans n'importe quel ordre, module écrit dans la page) est une app ; elle est faite avec Vite si elle est dans la racine d'une configuration de Vite (`unit_tech`) ; [inventaire](packs/vite-react.md) | atelier-api, et un exemple par forme |
| `node-package` | le fichier que lance un paquet Node (`main`), sa source plutôt que le compilé ; le fichier que lance chaque script (`pkg_script`) | un projet réel |
| `node-http` | les routes d'un serveur `node:http` écrites à la main, avec leur méthode quand elle est comparée | un projet réel |
| `firebase` | `firebase.json` : codebases de Cloud Functions, Firestore, Storage, Realtime Database, leurs fichiers de règles, l'hébergement et ses réécritures | un projet réel |
| `firestore` | lectures et écritures Firestore, API modulaire et Admin : le chemin suivi à travers variables, gabarits, transactions, et les fonctions d'un autre fichier qui fabriquent un chemin ou la base ; un accès dont le chemin n'est pas écrit dans le code devient « chemin calculé », un trou de couverture | un projet réel |
| `firestore-rules` | chaque collection de `firestore.rules` et la ligne de sa règle d'accès | un projet réel |
| `firebase-functions` | les fonctions exportées, API v1 et v2 : appelables, HTTP, planifiées, files de tâches, Pub/Sub, et les déclencheurs Firestore, Storage, Realtime Database, Authentication | un projet réel |

« Vérifié sur » dit sur quels projets le pack a été testé de bout en bout. Ces projets n'emploient qu'une partie de l'API de chaque technologie ; les autres formes sont testées une à une, et celles qui ne sont pas encore couvertes sont listées ci-dessous (chapitre 6).

## Les formes connues pas encore couvertes

Des formes de l'API des technologies déjà prises en charge, que les packs livrés ne lisent pas encore. Chacune sera ajoutée au pack de sa technologie, avec son exemple de test.

| Écrit comme ça | Aujourd'hui |
|---|---|
| une route construite dans une boucle | pas vue |
| des décorateurs (`@Post()`, NestJS) | pas vus : il faut un autre pack |
| `this.client.emails.send()` | le service externe est vu là où le client est créé, pas à chaque appel |
| `userRef(uid).collection("x")`, quand `userRef` vient d'un autre fichier | compté comme chemin calculé : le moteur ne sait pas encore coller deux morceaux de chemin |
| Storage et Authentication côté code (`uploadBytes`, `signInWith…`) | pas encore lus : pack en cours |
| `httpsCallable(functions, "x")`, `getFunctions().taskQueue("x").enqueue()` | l'appel d'une fonction et la mise en file pas encore lus : pack en cours |
| `export * as admin from "./admin"` (groupe de fonctions, déployées `admin-x`) | le préfixe du groupe n'est pas ajouté au nom |
| un site d'hébergement relié à la page qu'il sert | le site est lu, pas encore relié à l'app (le lien passe par la configuration du build) |
