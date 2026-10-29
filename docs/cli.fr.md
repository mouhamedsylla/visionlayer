# RYPHA VisionLayer — Guide d'utilisation CLI

**But de ce document** : te permettre de tester toi-même chaque commande, avec des exemples réels (pas reconstruits) capturés sur `examples/reference-project/`. Pour comprendre *pourquoi* chaque commande existe et *comment* elle se relie à la gouvernance, voir [docs/architecture.md](docs/architecture.md) et docs/mvp-roadmap.md — ce document-ci est volontairement pratique, pas conceptuel. Pour la suite du travail : docs/feuille-de-route.md et le projet Rypha-Fabric dans Linear.

---

## 0. Installation

```bash
cd visionlayer
pnpm install
```

Vérifie que tout fonctionne :

```bash
pnpm test
```

Tu dois voir `137 pass, 0 fail` puis `10 passed` pour les écrans (ou plus, si on a continué depuis).

**Note sur la syntaxe des commandes ci-dessous** : avec `pnpm`, on passe les arguments directement après le nom du script, **sans** `--` (contrairement à npm) : `pnpm run scan /chemin`, pas `pnpm run scan -- /chemin`. Un `--` en trop reste toléré (les CLI le retirent elles-mêmes, voir [ADR 0007](docs/decisions/0007-cli-args-strip-double-dash.md)), mais autant prendre la bonne habitude.

---

## 1. Le terrain de jeu : `examples/reference-project/`

Un petit projet TypeScript réaliste (7 fichiers, dossiers imbriqués, dépendances croisées, ré-exports) — voir son [README](examples/reference-project/README.md). C'est sur celui-ci que tous les exemples ci-dessous ont été exécutés.

**Important** : certaines commandes (`update`, `diff`, `report`) prennent tout leur sens quand tu fais un vrai changement de code entre deux exécutions. Pour ne pas polluer le projet versionné, fais-en une copie de travail avant de tester :

```bash
cp -r examples/reference-project /tmp/mon-essai
```

Remplace `/tmp/mon-essai` par ce chemin dans tous les exemples ci-dessous.

---

## 2. Les commandes, une par une

### `vision scan <chemin>` — premier scan

```bash
pnpm run scan /tmp/mon-essai
```

```
Scanned 7 file(s), 13 dependency edge(s).
Output written to /tmp/mon-essai/.vision
```

Produit `.vision/model.json`, `.vision/graph.mmd`, `.vision/metadata.json`. C'est la base dont toutes les autres commandes ont besoin — lance-la en premier.

### `vision inspect <fichier|symbole> <chemin>` — comprendre un fichier ou un symbole

Par chemin de fichier :

```bash
pnpm run inspect src/auth/invitations/service.ts /tmp/mon-essai
```

```
FICHIER src/auth/invitations/service.ts (typescript)
  Symboles:
    export function createInvitation  (src/auth/invitations/service.ts:8)
  Dépend de:
    -> node:crypto (externe)
    -> src/auth/token/service.ts
    -> src/notifications/email.ts
    -> src/auth/invitations/repository.ts
    -> src/auth/invitations/repository.ts
    -> src/auth/user/service.ts
  Utilisé par:
    <- src/auth/index.ts
```

*(Tu remarqueras `repository.ts` listé deux fois — c'est correct : le fichier contient deux instructions d'import distinctes vers cette même cible (`import { save }` et `import type { Invitation }`). C'est un fait fidèle au code, pas un bug — voir [ADR 0004](docs/decisions/0004-testing-strategy.md).)*

Par nom de symbole (fonctionne même si le symbole n'est pas déclaré ici, juste ré-exporté) :

```bash
pnpm run inspect generateToken /tmp/mon-essai
```

```
SYMBOLE generate (function, exporté)
  Ré-exporté via: src/auth/index.ts
  Défini dans: src/auth/token/service.ts:3

FICHIER src/auth/token/service.ts (typescript)
  Symboles:
    export function generate  (src/auth/token/service.ts:3)
    function isExpired  (src/auth/token/service.ts:7)
    export function validate  (src/auth/token/service.ts:12)
  Dépend de:
    -> node:crypto (externe)
  Utilisé par:
    <- src/auth/index.ts
    <- src/auth/invitations/service.ts
```

### `vision source <symbole> <chemin>` — juste la ligne de code

```bash
pnpm run source generateToken /tmp/mon-essai
```

```
(ré-exporté via src/auth/index.ts)
src/auth/token/service.ts:3
```

### `vision context --task "..." <chemin>` — contexte pour une tâche

```bash
pnpm run context --task "envoyer un email d'invitation" /tmp/mon-essai
```

```
FICHIERS PERTINENTS (5)
  src/auth/index.ts
    ré-exports correspondants: createInvitation
  src/auth/invitations/repository.ts
    symboles correspondants: Invitation
  src/auth/invitations/service.ts
    symboles correspondants: createInvitation
  src/index.ts
    ré-exports correspondants: sendEmail
  src/notifications/email.ts
    symboles correspondants: EmailMessage

FICHIERS LIÉS — un saut de dépendance (2)
  src/auth/user/service.ts
  src/auth/token/service.ts

INTERPRÉTATION SÉMANTIQUE : aucune (ADR 0005) — uniquement des faits déterministes...
```

Aucun appel LLM ici — uniquement correspondance de mots-clés + voisinage dans le graphe de dépendances ([ADR 0005](docs/decisions/0005-agent-context-v1-deterministic-only.md)).

### `vision update <chemin>` puis `vision diff <chemin>` — avant/après un changement

```bash
pnpm run update /tmp/mon-essai
```

```
Modèle mis à jour : 7 fichier(s), 13 dépendance(s).
Pas de dépôt Git détecté — commit non enregistré.
Comparez avec l'état précédent via: vision diff /tmp/mon-essai
```

*(Le message "not a git repository" est normal si `/tmp/mon-essai` n'est pas un dépôt Git — `vision update` reste utilisable sans Git, voir [ADR 0006](docs/decisions/0006-git-integration-stays-local.md).)*

Fais maintenant un vrai changement — par exemple ajoute `src/auth/invitations/expiration.ts` :

```ts
import type { Invitation } from "./repository";

const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

export function isInvitationExpired(invitation: Invitation): boolean {
  return Date.now() - invitation.issuedAt > INVITATION_TTL_MS;
}
```

Et ajoute cette ligne dans `src/auth/invitations/service.ts` :

```ts
import { isInvitationExpired } from "./expiration";
```

Puis relance `update` et compare :

```bash
pnpm run update /tmp/mon-essai
pnpm run diff /tmp/mon-essai
```

```
ARCHITECTURE CHANGES

+ src/auth/invitations/expiration.ts
+ INVITATION_TTL_MS (variable) in src/auth/invitations/expiration.ts
+ isInvitationExpired (function) in src/auth/invitations/expiration.ts
+ dependency: src/auth/invitations/expiration.ts -> src/auth/invitations/repository.ts
+ dependency: src/auth/invitations/service.ts -> src/auth/invitations/expiration.ts

AFFECTED
- src/auth/invitations/expiration.ts
- src/auth/invitations/repository.ts
- src/auth/invitations/service.ts
```

### `vision report --task "..." [--intent "..."] <chemin>` — le rapport complet

Nécessite d'avoir fait la séquence `update` → changement → `update` ci-dessus (il compare les deux derniers snapshots) :

```bash
pnpm run report --task "Implémenter l'expiration d'une invitation" --intent "Ajouter l'expiration au cycle de vie de l'invitation" /tmp/mon-essai
```

```
CHANGE REPORT
────────────────────────────────

TASK
Implémenter l'expiration d'une invitation

INTENT
Ajouter l'expiration au cycle de vie de l'invitation

COMMIT
(pas de dépôt Git détecté)

ARCHITECTURE CHANGES
... (identique au diff ci-dessus) ...

VERIFICATION
Tests / Semgrep : non disponible — pas encore intégrés (architecture.md §5, étape 13).

RISQUE
Niveau : HIGH
Approbation humaine requise avant merge (gouvernance §6).

RISQUES DÉTECTÉS AUTOMATIQUEMENT
(aucun détecté — ceci ne garantit pas l'absence de risque, seulement l'absence de signal calculable)

HUMAN REVIEW
Ce changement touche un périmètre classé MEDIUM ou HIGH — revue humaine explicite requise avant merge.
```

**Pourquoi HIGH ?** Le changement touche `src/auth/**`, qui matche le motif HIGH dans [policies/high-risk-paths.yaml](policies/high-risk-paths.yaml) — pas une supposition, une règle appliquée. Essaie avec un changement dans `src/notifications/` pour voir la différence (LOW/MEDIUM).

### `vision infra <chemin>` — comment le système est déployé (MVP7)

```bash
pnpm run infra /tmp/mon-essai
```

```
INFRASTRUCTURE
────────────────────────────────

ENVIRONNEMENTS (2)
  dev · prod

COMPOSANTS (14)
  api  [service]  env: tous  ← docker-compose.yml:3
      ports: 3000:3000
      build: . (Dockerfile)
      image (prod): ghcr.io/rypha/reference-api:1.4.0
      replicas (prod): 2
  nginx  [reverse proxy]  env: tous  ← docker-compose.yml:35
      domains: reference.local
      tls: non
      domains (prod): reference.rypha.io
      tls (prod): oui
  Resend  [plateforme]  env: prod  ← déclaré (.vision/infra.yaml)
  ...

LIENS (18)
  nginx —routes_to (reference.rypha.io/api/)→ api  env: prod
  api —connects_to (SMTP)→ Resend  env: prod
  CI · Deploy —deploys (déploie → prod)→ prod  env: prod
  ...

VARIABLES D'ENVIRONNEMENT — noms uniquement (24)
  SENTRY_DSN  (api)  env: prod
  ...

DIFFÉRENCES ENTRE ENVIRONNEMENTS (4 composant(s))
  api
      prod: image = ghcr.io/rypha/reference-api:1.4.0
      prod: replicas = 2
  ...

POINTS D'ATTENTION (1)
  ⚠ variable SENTRY_DSN présente uniquement en prod  ← .env.production.example:8
```

Lit `docker-compose*.yml`, `Dockerfile`, nginx / Caddyfile / Traefik, `.env*` (**noms seulement, jamais les valeurs**), workflows GitHub Actions, `cloudbuild.yaml`, Terraform, manifestes Kubernetes, `vercel.json`, `netlify.toml`, `firebase.json` + `.firebaserc` (projet et site par environnement), et les scripts de déploiement de `package.json` — et la part **déclarée** à la main dans `.vision/infra.yaml` (ce qu'aucun fichier ne dit : un CDN, un fournisseur SaaS…), toujours étiquetée « déclaré ». Le résultat est aussi écrit dans `.vision/infra.json` à chaque `scan`/`update`. Dans l'interface : niveau **Infrastructure** (carte, filtre par environnement, tableau des différences, configuration lue sur place). Voir [ADR 0010](docs/decisions/0010-infrastructure-level.md).

### `vision archi <chemin>` — comment le système fonctionne vraiment (MVP9)

```bash
pnpm run archi /tmp/mon-essai
pnpm run archi /tmp/mon-essai --feature videoCreate
```

La première commande donne les **blocs qui s'exécutent** (apps, Cloud Functions, conteneurs), les services qu'ils utilisent (Firestore, Storage, Auth, IA, files, backends), les **liens** (appelle, lit, écrit, déclenche, met en file) avec leur nombre d'occurrences, l'intérieur de Firestore (collections, qui lit, qui écrit, règles) et les points d'attention. La seconde donne l'**algorithme d'une feature**, extrait du code (extrait réel de Nafar) :

```
ÉTAPES
  ⛔ si !request.auth?.uid → refuse : new HttpsError('unauthenticated', 'Auth required.')  :259
  · reserveVideoSlot(uid, VIDEO_DAILY_CAP, VIDEO_LIFETIME_CAP)  ⟶ lit users/{}/videoStats · écrit users/{}/videoStats  :333
  ⛔ si !slot.ok → s'arrête : renvoie { status: 'daily-limit', … }  :334
  · debitCredits(uid, duration.cost, 'video')  ⟶ lit users/{}/wallet · écrit users/{}/creditTx · écrit users/{}/wallet  :343
  ▶  écrit videoJobs  :434
  · enqueueRender(ref.id)  ⟶ file Cloud Tasks → variable RENDER_URL  :461
```

Dans l'interface : niveau **Architecture** (par défaut). Clic sur un bloc ou une flèche pour les lignes qui les prouvent, « Entrer dans le bloc » pour son intérieur, une feature pour son algorithme avec le code à droite. Voir [ADR 0012](docs/decisions/0012-runtime-architecture-and-feature-flows.md).

### `vision stack <chemin>` — toutes les technologies utilisées (MVP8)

```bash
pnpm run stack /tmp/mon-essai
```

```
TECHNOLOGIES
────────────────────────────────

LANGAGES (6)
  TypeScript     329 fichiers  80 %  (.ts .tsx)
  Python          28 fichiers  7 %  (.py)
  ...
CLOUD & HÉBERGEMENT (2)
  Firebase  12.14.0  [Admin SDK, App Check, Authentication, Cloud Functions, Firestore, Hosting, Storage…]  — importé par 41 fichier(s)
      firebase ^12.12.1 (installé 12.14.0) ← package.json:51
      firebase-functions ^6.0.1 (installé 6.6.0) ← functions/package.json:33
      ...
POINTS D'ATTENTION (6)
  ⚠ @google/genai : versions majeures différentes — ^2.12.0 (functions/package.json) · ^1.29.0 (package.json)
  ⚠ recharts est déclaré (package.json) mais aucun fichier scanné ne l'importe
```

(Extrait réel de Nafar.) Chaque technologie n'existe que par ses **preuves** : paquet dans un manifeste (npm, PyPI, Go, Cargo, Composer, RubyGems), fichier de configuration, image de conteneur, paquet système installé dans un Dockerfile, version d'exécution, composant d'infrastructure — plus les fichiers qui l'importent. Un paquet hors catalogue reste listé sous son nom. Écrit dans `.vision/stack.json` à chaque `scan`/`update` ; `update` garde l'inventaire précédent pour montrer ce qui a changé. Dans l'interface : niveau **Technologies**, avec les vrais logos (Simple Icons). Voir [ADR 0011](docs/decisions/0011-technologies-level-and-first-nafar-run.md).

### Le serveur MCP (ce que lit un agent : Claude Code, Codex…)

```bash
pnpm run mcp
```

Démarre un serveur MCP sur stdio, **en lecture seule** : jamais `update`/`diff`/`report` (l'écriture du modèle garde une étape humaine explicite, voir mvp-roadmap.md — MVP5). Chaque outil renvoie peu de texte, parce que chaque caractère est payé en tokens par l'agent ([ADR 0013](docs/decisions/0013-visionlayer-control-tower-and-agent-integration.md)) :

| Outil | Ce qu'il renvoie | Sur Nafar |
|---|---|---|
| `vision_architecture` | la carte (blocs, liens, entrées, collections) ; `block: "Firestore"` pour un seul bloc et son voisinage | ≈ 1 900 tokens, ≈ 900 pour un bloc |
| `vision_flow` | l'algorithme d'une feature (`feature: "videoCreate"`), avec qui l'appelle et ce qu'elle déclenche ; `full: true` garde les calculs purs | ≈ 1 250 tokens (lire `job.ts` : ≈ 6 600) |
| `vision_context` | les fichiers et symboles liés à une tâche ; `detail: true` pour tous les symboles | ≈ 1 400 tokens (≈ 20 000 avant) |
| `vision_inspect` / `vision_source` | un fichier ou un symbole, sa déclaration réelle | — |

Brancher l'agent (chemins absolus vers ce dossier ; l'agent passe `root` = le repository à lire) :

- **Claude Code**, dans `.mcp.json` du projet :
  ```json
  { "mcpServers": { "visionlayer": { "command": "/chemin/visionlayer/node_modules/.bin/tsx", "args": ["/chemin/visionlayer/integrations/agents/server.ts"] } } }
  ```
- **Codex**, dans `~/.codex/config.toml` ou `.codex/config.toml` du projet :
  ```toml
  [mcp_servers.visionlayer]
  command = "/chemin/visionlayer/node_modules/.bin/tsx"
  args = ["/chemin/visionlayer/integrations/agents/server.ts"]
  ```

### Journal d'activité des agents et coût par feature (`vision hook`, `vision cost`)

Les hooks de l'agent appellent `vision hook`, qui note dans `.vision/activity/journal.jsonl` ce que la session a **modifié** (chemins de fichiers du repository) et ses **compteurs de tokens**. Ces compteurs sont lus dans le transcript local de l'agent. Le journal ne contient jamais un prompt, une commande shell ni le contenu d'un fichier. Il s'ignore lui-même dans git. `vision hook` sort toujours en 0 : il ne bloque jamais l'agent.

- **Claude Code**, dans `.claude/settings.json` du projet (remplace `/chemin/workflow`) :
  ```json
  {
    "hooks": {
      "PostToolUse": [{ "matcher": "Edit|Write|MultiEdit|NotebookEdit|mcp__visionlayer__.*", "hooks": [{ "type": "command", "command": "/chemin/visionlayer/node_modules/.bin/tsx /chemin/visionlayer/cli/hook.ts claude" }] }],
      "Stop": [{ "hooks": [{ "type": "command", "command": "/chemin/visionlayer/node_modules/.bin/tsx /chemin/visionlayer/cli/hook.ts claude" }] }],
      "SessionEnd": [{ "hooks": [{ "type": "command", "command": "/chemin/visionlayer/node_modules/.bin/tsx /chemin/visionlayer/cli/hook.ts claude" }] }]
    }
  }
  ```
- **Codex**, dans `.codex/hooks.json` du projet : la même structure, avec `cli/hook.ts codex` et sans `matcher` (le hook trie lui-même).

```bash
pnpm run cost /chemin/du/projet
```

Ce rapport donne les tokens (et le montant, si des tarifs sont déclarés) **par feature**. Le principe :
- une session est répartie à parts égales entre les fichiers qu'elle a modifiés ;
- la part d'un fichier va aux features qui l'exécutent, sinon au bloc qui le contient ;
- les sessions sans modification (exploration, questions) sont listées à part, sans être imputées à une feature.

VisionLayer n'invente aucun tarif. Pour avoir des montants, déclare-les dans `.vision/prices.json`, en prix par million de tokens ; une clé peut être un préfixe de nom de modèle :

```json
{ "currency": "USD", "perMillion": { "claude-opus": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }, "gpt-5": { "input": 0, "output": 0, "cacheRead": 0 } } }
```

Détail et raisons : [ADR 0013](docs/decisions/0013-visionlayer-control-tower-and-agent-integration.md).

### `vision knowledge [chemin]` — ce que le code ne dit pas, vérifié contre le code

```bash
pnpm run knowledge /chemin/du/projet
pnpm run knowledge /chemin/du/projet --json
```

Les agents déclarent, dans `.vision/knowledge/*.yaml`, ce que le code seul ne dit pas : le but d'une feature, ses règles, ses invariants, ce qui se passe quand ça rate, les décisions, les hypothèses. Chaque affirmation est **ancrée** dans le code (`chemin#Symbole[.méthode][@marqueur]`, avec un commentaire `// @k identifiant` pour un endroit précis dans une fonction). La commande calcule l'état de chaque affirmation contre le code et Git :

- le **point de référence** est le commit où ses lignes ont été écrites (git blame) : l'affirmation était vraie là ;
- **structure vérifiée** : une vérification structurelle confirme ce qu'elle dit (un `try/catch`, une transaction…) ; **à jour** : le code ancré n'a pas changé depuis ;
- **à reconfirmer** : le code ancré a changé ; **contredit** : la vérification échoue ; **orphelin** : l'ancrage est introuvable ; **hypothèse** : rien à ancrer.

Un refactoring (renommage, déplacement, commentaire ajouté) ne périme rien : l'ancrage est retrouvé par son marqueur ou par l'empreinte du code. Un ancrage ne sort jamais du dépôt et ne désigne jamais un `.env`. Extrait réel, sur le prototype mené dans une copie de travail de Nafar :

```
Connaissance · 5 concepts · 18 affirmations
  structure vérifiée 8 · à jour 5 · à reconfirmer 2 · contredit 1 · orphelin 1 · hypothèse 1

feature access.code — Entrer avec un code d'accès  (.vision/knowledge/features/access-code.yaml)
  points d'entrée : redeemAccessCode, claimAccess
  [à reconfirmer] invariant access.one-redeem-at-a-time · vraie au 6e3b2c4 (2026-09-28) · tests : aucun
      « Deux élèves qui saisissent le même code au même moment ne peuvent pas le consommer tous les deux ; la lecture et la liaison du code sont dans la même transaction. »
      functions/src/access.ts:76–102 (redeemAccessCode) · code changé depuis la référence
```

Reconfirmer une affirmation, c'est toucher une de ses lignes (l'interface écrit une ligne `confirmed:` sur clic) ; le changement se commite avec le code et se relit en PR. Le modèle, le format et les résultats du prototype : [docs/knowledge/](docs/knowledge/).

---

## 3. L'interface

### Lancer l'interface (`vision ui`)

```bash
pnpm run ui:build   # construit le front (une fois, puis après chaque changement du front)
pnpm run ui /chemin/du/projet
```

Ouvre `http://127.0.0.1:4173` (`--port N` pour un autre port). Sans chemin, le dossier courant est lu.

L'interface est recodée depuis le 02/10 à partir des maquettes, sur le modèle neutre ([ADR 0018](docs/decisions/0018-nouvelle-interface.md)). L'ancienne est archivée dans [archive/ui-v1](archive/ui-v1). La carte est calculée au démarrage, puis seulement sur le bouton **Mettre à jour l'analyse**. Le serveur garde l'analyse précédente en mémoire pour dire ce qui a changé, et n'écrit aucun fichier.

**Les écrans recodés** :

| Écran | Ce qu'il montre |
|---|---|
| Vue d'ensemble (`#/vue`, l'écran d'accueil) | le système tel qu'il tourne : le dernier commit du dossier, la carte réduite en trois couloirs, quatre compteurs qui mènent aux écrans ; le workflow en cours (aucun outil relié pour l'instant, et l'écran le dit) ; les points à vérifier par nature, le point ouvert dessiné avec ses lignes, ses blocs et son code au clic ; ce qui n'est pas lu ; ce qui a changé depuis l'analyse précédente |
| Features (`#/features`, `#/features/<point d'entrée>`, `/code`) | aucune feature n'est encore déclarée (un agent ou une personne la nomme) : chaque point d'entrée, rangé par regroupement proposé (même ressource, tâches planifiées, files), avec ce qu'il atteint et ses refus ; un clic ouvre son déroulé tracé en couloirs, extrait du code : la garde dépliée, chaque lecture, écriture, appel et mise en file, chaque refus avec sa condition, la réponse, le commentaire de l'auteur, le code de l'étape au clic ; puis ce qui se passe si ça rate |
| Contrats (`#/contrats/<contrat>/fournisseurs`, `/features`) | une interface du dépôt implémentée au moins deux fois : la règle que le module écrit en tête, vérifiée (aucun paquet du fournisseur importé ailleurs) ; ce que chaque opération reçoit et rend, champ par champ, avec le commentaire de l'auteur ; la vie d'un appel en couloirs, de la file au fournisseur et retour ; chaque implémentation avec ce qu'elle appelle et quand elle est choisie ; qui choisit, et les variables lues, par leur nom ; les points d'entrée qui finissent par l'employer |
| Messages (`#/messages`, `#/messages/<déclencheur>`, `/code`) | ce qui tourne sans que personne clique : tâches planifiées, files écoutées, routes appelées par un service externe qui signe ; un bandeau (combien de chaque, ce qui part plusieurs fois d'après les exemplaires déclarés au déploiement, ce qu'on ne sait pas) ; une journée où chaque tâche est placée à ses heures lues dans le cron ; chaque déclencheur avec ce que fait son code et ce qui est constaté ; un clic ouvre son trajet en couloirs, avec les branches que son code distingue, qui met en file et les variables lues, par leur nom |
| Architecture | ce qui tourne, qui parle à qui et ce qu'il faut vérifier, en trois couloirs ; un bandeau de cinq cases comptées sur la carte, dont « ce qu'on ne sait pas » ; un clic sur un bloc montre ses liens et ses points |
| Bloc (`#/architecture/<bloc>`) | l'intérieur d'un bloc : ses points d'entrée, qui déclenche chacun, ce qu'il lit, écrit, met en file ou appelle ; un clic sur un point d'entrée montre chaque effet avec sa ligne ; à droite, à qui le bloc parle, qui l'appelle, ce qui tourne sans clic, d'où il est déployé |
| Données (`#/donnees/<stockage>/<table>`) | une ligne par table, rangées par section du schéma, une colonne par bloc et par tâche planifiée : qui lit, qui écrit ; ce que la base refuse (unicité, vérification) et ce qui s'y déclenche ; un clic sur une table montre le commentaire de son auteur, sa déclaration, ce que le code montre de qui l'écrit, chaque fichier qui la lit ou l'écrit et les points d'entrée qui la modifient |
| Entité (`#/donnees/<stockage>/<table>/cycle`, `/forme`, `/acces`) | le cycle de vie d'un champ à valeurs : ses états (défaut, jamais écrit), puis chaque écriture dans un schéma en couloirs (qui appelle, qui écrit, la ligne), son code au clic ; les colonnes regroupées par qui les écrit |

Les autres entrées de la barre latérale sont grisées jusqu'à ce qu'elles soient recodées ; l'ordre est dans docs/feuille-de-route.md. Le serveur MCP reste en lecture seule pour les agents.

Pour développer le front avec rechargement à chaud : `pnpm run ui /chemin/du/projet` dans un terminal (API), `pnpm run ui:dev` dans un autre (Vite sur `http://localhost:5173`, qui renvoie `/api` vers le premier). La structure du front et ses règles sont dans [ui/README.md](ui/README.md).

### Mermaid brut

Après un `scan` ou `update`, `.vision/graph.mmd` reste généré — c'est du Mermaid brut, collable dans n'importe quel viewer Mermaid (GitHub le rend nativement dans un bloc ```mermaid).

---

## 4. Lancer les tests

```bash
pnpm test        # tous les tests (unitaires, golden fixtures, e2e, protocole MCP réel), puis ceux des écrans
pnpm run test:ui # seulement les écrans
pnpm run typecheck
```

Les tests golden ([tests/fixtures/](tests/fixtures/)) sont les cas de non-régression — un par bug réel trouvé (voir [ADR 0004](docs/decisions/0004-testing-strategy.md)). Les tests `e2e-reference-project.test.ts` rejouent le scénario complet ci-dessus automatiquement. Les tests des écrans ([ui/tests/](ui/tests/), Vitest et jsdom) montent l'interface entière contre le vrai serveur, sur une copie du projet [tests/arch-fixtures/shop](tests/arch-fixtures/shop) : premier scan, Système, Bloc, Features, Feature, Code, Symbole, Technologies, Déploiement, recherche, Connaissance et ses tiroirs. Un écran qui plante, ou une erreur signalée par React, fait échouer le test de cet écran.

---

## 5. Pour aller plus loin

- **Le mécanisme complet et la conformité gouvernance** : [docs/architecture.md](docs/architecture.md)
- **Le détail de chaque périmètre MVP livré** : docs/mvp-roadmap.md
- **La suite du travail** : docs/feuille-de-route.md, et les tickets dans le projet Rypha-Fabric sur Linear
- **Le knowledge layer** : [docs/knowledge/](docs/knowledge/)
- **Pourquoi chaque décision technique a été prise** : [docs/decisions/](docs/decisions/)
- **Le cadre de gouvernance** (indépendant de VisionLayer) : [../governance/RYPHA_Governance_and_Standards_Framework.md](../governance/RYPHA_Governance_and_Standards_Framework.md)
