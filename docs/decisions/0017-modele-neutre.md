# ADR 0017 — Le modèle neutre : niveaux, nœuds à facettes, liens prouvés, sources et couverture

**Statut :** Accepté le 01/10/2026. Remplace la phase 3 de l'[ADR 0012](./0012-runtime-architecture-and-feature-flows.md). Suit le [doc 07](../knowledge/07-voir-n-importe-quel-systeme.md) §4.1, §4.2 et §4.7.

## Contexte

Le format actuel de `.vision/architecture.json` (version 1) est né sur un projet réel. Ses types disent la pile au lieu de dire le système :
- un intérieur de base est une liste de `collections` (Firestore) ;
- un point d'entrée est `callable`, `trigger` ou `task` (Cloud Functions, Cloud Tasks) ;
- l'intérieur « IA » a ses propres champs (`providers`, `models`), alors qu'un module de paiement ou d'emails a exactement la même forme ;
- rien ne dit ce qui n'a pas été lu.

Exemple concret avec atelier-api ([tests/corpus/atelier-api](../../tests/corpus/atelier-api)). Ce dépôt a une base Postgres avec 14 tables, une file Redis pour les emails, 3 tâches planifiées, un webhook Stripe et un contrat `EmailSender` avec 3 implémentations. Rien de tout cela ne rentre dans la version 1 sans y ajouter des champs Postgres, BullMQ ou Stripe. C'est la pente qui a produit une extraction taillée pour Nafar. Aujourd'hui, VisionLayer y voit 1 bloc et 0 lien.

## Décision

**L'interface et le serveur MCP ne lisent qu'un modèle sans nom de technologie dans sa forme.** Une technologie peut apparaître comme une valeur (`"tech": ["postgresql"]`, pour le logo), jamais comme un champ. Le type est dans [vision/arch/types.ts](../../vision/arch/types.ts) (`ArchModelV2`), et son schéma strict dans [vision/arch/schema.ts](../../vision/arch/schema.ts) : un champ inconnu est refusé.

### 1. Quatre niveaux

| Niveau | Ce qu'il contient | Dans atelier-api | Dans une app Firebase |
|---|---|---|---|
| `system` | le système et ce qui l'entoure : acteurs, systèmes externes | les clients, Stripe, Resend | les élèves, Anthropic, Google |
| `deployable` | ce qui s'exécute ou se stocke séparément | l'API, le worker d'emails, l'app web, Postgres, Redis | les apps, les Cloud Functions, Firestore, Cloud Tasks |
| `component` | une partie d'un déployable | le module emails de l'API | la couche IA |
| `code` | fichiers, symboles, appels | `src/payments/create.ts#createPayment` | `engine.ts#runChat` |

Le niveau `code` n'est pas recopié : il vit déjà dans `.vision/model.json`. Les nœuds le citent par une référence de symbole (`path`, `line`, `name`).

Un nœud a un **rôle** neutre, qui dit ce qu'il est sans dire avec quoi il est fait :
- au niveau système : `actor`, `external` ;
- au niveau déployable : `app`, `service`, `function`, `worker`, `job`, `store`, `channel`, `binary`, `managed` ;
- au niveau composant : `module`, `layer`, `adapter`.

### 2. Des facettes, pas des types

Un écran s'affiche parce qu'un nœud porte une facette, jamais parce que le projet utilise Firebase.

| Facette | Ce qu'elle décrit | atelier-api | un projet réel |
|---|---|---|---|
| `entrypoints` | ce qui fait entrer dans le nœud. Genres : `http`, `rpc`, `event`, `schedule`, `message`, `main`, `cli`. Chaque entrée a une clé (`POST /bookings`, `placeOrder`, `*/5 * * * *`), son code, sa garde d'accès, et qui l'appelle | 15 routes, 3 tâches, le consommateur `emails` | les Cloud Functions |
| `data` | les entités stockées, leur forme (`relational`, `document`, `key-value`, `blob`…), leurs champs, leurs contraintes, leurs déclencheurs et leur règle d'accès | 14 tables, `bookings_one_active`, le déclencheur `audit_bookings` | 32 collections et leurs règles |
| `contract` | une interface, ses opérations, ses implémentations, et ce qui choisit entre elles | `EmailSender`, 3 implémentations, choisies par `EMAIL_PROVIDER` | le fournisseur d'IA |
| `channel` | ce qui transporte des messages : files, topics, réglages de reprise | la file `emails` : 5 essais, attente exponentielle | Cloud Tasks |
| `config` | les **noms** des variables d'environnement et où elles sont lues, jamais leur valeur | `STRIPE_SECRET_KEY`, `EMAIL_PROVIDER`… | `AI_PROVIDER`… |
| `trust` | la frontière : ce qui est public, ce qui est authentifié, par quel moyen | sessions par cookie, signature du webhook | Firebase Auth |

Deux compléments sur le nœud lui-même :
- `instances` : combien d'exemplaires tournent, preuve à l'appui. Exemple : `min_machines_running = 2` dans fly.toml. C'est ce qui permet de voir qu'une tâche planifiée s'exécute deux fois.
- `attributes` : des paires clé, valeur, ligne pour les faits littéraux du code, comme un modèle d'IA cité. Les valeurs secrètes y sont masquées comme partout (ADR 0010).

### 3. Des liens typés

Genres de lien : `call`, `read`, `write`, `message`, `request`, `trigger`, `use`, `deploy`.

Un lien relie deux nœuds. Il peut préciser une cible plus fine : une entité (`bookings`), un point d'entrée (`POST /payments`) ou un topic (`emails`). Chaque occurrence porte sa ligne et les points d'entrée qui l'atteignent.

C'est ainsi que les lectures et écritures d'une collection, rangées aujourd'hui dans l'intérieur Firestore, deviennent des liens ordinaires vers une entité. L'écran Données les retrouve quel que soit le stockage.

### 4. Chaque élément dit d'où il vient

Toute preuve porte sa **source** :

| Source | Exemple |
|---|---|
| `syntax` | l'arbre syntaxique d'un fichier |
| `symbols` | un index de symboles (SCIP), s'il est installé |
| `manifest` | Dockerfile, docker-compose, fly.toml, `firebase.json`, migrations SQL |
| `pack` | un pack de détection, nommé dans la preuve (`"pack": "express"`) |
| `runtime` | des traces d'exécution exportées par le projet. Prévu dès maintenant, lu plus tard (doc 07 §8, question 3) |
| `declared` | une fiche d'agent ou `.vision/*.yaml` |

Un nœud a aussi un **statut** : `extracted` (lu), `proposed` (calculé, par exemple un découpage en composants) ou `declared` (écrit par un agent ou un humain). L'interface ne les montre jamais de la même façon.

### 5. Les constats

Ce qui mérite l'attention devient un **constat** (`finding`). Chaque constat a un code neutre, un message, ses preuves, les nœuds concernés et sa source. Exemples :
- `uncalled_entry` : un point d'entrée que rien n'appelle ;
- `unguarded_route` : une route d'administration sans garde de rôle ;
- `race_read_then_write` : une lecture puis une écriture sans verrou ;
- `write_then_enqueue` : une écriture en base puis une mise en file hors transaction ;
- `order_assumption` : un webhook qui suppose l'ordre des événements ;
- `personal_data_logged` : des données personnelles écrites dans les logs ;
- `scheduled_on_every_instance` : une tâche planifiée lancée sur chaque exemplaire ;
- `doc_contradiction` : une documentation qui contredit le code.

Les avertissements de la version 1 (`unresolved_target`, `dynamic_path`, `unknown_callable`) en sont aussi.

### 6. La couverture, par niveau

Pour chaque niveau : ce qui a été lu sur le total, et les **trous**, chacun avec son genre :
- `language_not_read` : un langage présent mais pas lu ;
- `pack_missing` : un framework détecté sans pack ;
- `target_unknown` : un appel dont la cible est inconnue ;
- `path_dynamic` : un chemin calculé à l'exécution ;
- `manifest_unknown` : un fichier de déploiement que VisionLayer ne sait pas lire.

Exemple sur un projet réel : le service de rendu en Python deviendra un trou `language_not_read` au niveau composant, au lieu d'un bloc vide qui ressemble à « rien dedans ». La conversion depuis la version 1 ne le sait pas encore : elle ne reprend que les avertissements de la v1. Le décompte des langages arrive avec la base de faits. « Aucun lien trouvé » et « ce langage n'est pas lu » ne se ressemblent plus.

### 7. La forme du fichier

```jsonc
{
  "version": 2,
  "system": { "name": "atelier-api" },
  "nodes": [ /* id, name, level, role, parent?, tech?, status, proof, files?, instances?, attributes?, facets */ ],
  "edges": [ /* id, from, to, kind, target?, count, occurrences */ ],
  "findings": [ /* code, message, proof, nodes?, source */ ],
  "coverage": [ /* level, unit, read, total, gaps */ ]
}
```

Les déroulés de features restent calculés à la demande (ADR 0012) et ne sont pas écrits dans ce fichier.

### 8. La migration

1. **Maintenant (cet ADR) :**
   - le type et le schéma de la version 2 ;
   - une conversion de la version 1 vers la version 2 ([vision/arch/neutral.ts](../../vision/arch/neutral.ts)), pour que la carte d'un projet réel s'y décrive dès aujourd'hui ;
   - l'oracle d'atelier-api écrit en version 2 ([expected.arch.json](../../tests/corpus/atelier-api/expected.arch.json)), validé par le schéma.
2. **Avec le moteur de packs :** l'extraction produit directement la version 2. Fait le 01/10 pour les technologies d'atelier-api. Le pack Firebase est en pause : il s'écrit depuis la documentation de Firebase, forme par forme, comme les autres packs, et non en recopiant le code de la version 1.
3. **Contrôle à l'aveugle :** un projet jamais vu, son oracle écrit avant de lancer ; on compte ce qui est trouvé, faux et non lu.
4. **Nouvelle interface :** les écrans ne sont pas migrés un par un. L'interface actuelle est jetée, et chaque écran est recodé depuis les maquettes, refaites le 30/09 pour n'importe quel projet. Il lit la version 2 et a son état « non lu ». Les déroulés et les contrats calculés à la demande sont refaits sur la base de faits avant.
5. **Bascule et retrait :** `scan` écrit la version 2. L'ancien moteur (`vision/arch/build.ts`, `analyze.ts`, `flow.ts`, `contract.ts`) est retiré. Un fichier en version 1 reste lisible, converti au chargement, jusqu'à la fin du jalon 2. Sans le pack Firebase, les parties Firebase d'un projet réel apparaissent comme non lues.

*Révisé le 02/10/2026 : l'ordre d'origine (pack Firebase recopié du code actuel, puis migration écran par écran) est remplacé par celui-ci.*

## Rationale

- **Une forme par concept, pas par pile.** Ajouter Postgres ne change ni le type ni l'écran Données. Seul un pack s'ajoute.
- **Le schéma strict est le garde-fou.** Un champ `collections` ou `bullmq` serait refusé à la validation : la tentation de tailler pour une pile se voit au test, pas en revue.
- **La source sur chaque preuve** prolonge la règle « rien de faux montré comme vrai ». Un lien déclaré par un agent ou proposé par une règle ne passe jamais pour un lien lu.
- **La couverture fait partie du modèle**, pas de l'interface. Le serveur MCP peut dire à un agent ce qui n'a pas été lu, au lieu de lui laisser croire qu'il n'y a rien.
- **Les niveaux reprennent C4**, que les équipes connaissent déjà, sans en imposer les dessins.

## Conséquences

- Les deux projets de référence s'y décrivent sans champ propre à une pile :
  - une app Firebase, par conversion de sa carte actuelle ;
  - atelier-api, par son oracle écrit à la main.

  Les tests le vérifient ([tests/neutral.test.ts](../../tests/neutral.test.ts)).
- Sur un projet réel aujourd'hui, la conversion donne :
  - 14 nœuds (dont 5 systèmes externes, avec les fournisseurs d'IA sortis de l'intérieur « IA ») ;
  - 21 points d'entrée sur 21 ;
  - 32 entités, dont 26 avec leur règle ;
  - 77 liens, car les lectures et écritures sont maintenant comptées par entité ;
  - 4 constats ;
  - 0 problème au schéma.

  L'ADR 0012 comptait 27 règles : l'écart vient du code de ce projet depuis, la v1 trouve aussi 26.
- La conversion perd une seule chose : les champs du contrat calculés à la demande (`contract.ts`). Ils restent à la demande et rejoignent la facette `contract` avec le pack.
- Le score de couverture du corpus devient possible : comparer la carte produite à l'oracle, nœud par nœud et lien par lien.
- Le serveur MCP reste en lecture seule (ADR 0009). Il servira la version 2 quand le fichier basculera.
