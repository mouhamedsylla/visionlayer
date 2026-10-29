# Knowledge layer — 7. Voir n'importe quel système

**Statut :** proposé le 30/09/2026, à valider. Rien n'est construit selon ce document tant qu'il n'est pas validé.
**Pourquoi maintenant :** en construisant les écrans Bloc, Données et Couche IA, on a vu que VisionLayer ne comprend bien qu'un seul type de projet : celui de Nafar. Ce document fait l'inventaire de ce qu'un système logiciel peut montrer, puis propose une manière de le capturer pour n'importe quel projet.

## 1. Le constat

**L'interface n'est pas le problème.** Elle ne contient aucune donnée de Nafar : tout ce qu'elle montre vient du projet ouvert (`.vision/`, ou un calcul à la demande sur son code). Vérifié le 30/09 en cherchant dans son code les noms propres à Nafar : seuls des commentaires d'exemple les citent.

**L'extraction, si.** Pour dessiner la carte d'exécution, [analyze.ts](../../vision/arch/analyze.ts) ne reconnaît que la pile de Nafar :
- fonctions Firebase (`onCall`, `onRequest`, déclencheurs, `onTaskDispatched`), lectures et écritures Firestore, Cloud Tasks, hôtes d'IA connus ;
- seulement du TypeScript et du JavaScript.

Sur une API Express avec Postgres, un CRM Django ou un service Go, la carte serait presque vide. Le noyau Linux ne serait pas lu du tout. Le niveau Infrastructure est plus large (docker-compose, Kubernetes, Terraform, nginx), mais il ne relie pas ce qu'il voit au code.

**Et les écrans ont été pensés sur Nafar.** Les maquettes 05 (Données) et 27 (Couche IA) décrivent Firestore et la couche IA de Nafar. Le 30/09, en les construisant, des motifs propres au code de Nafar sont entrés dans l'extraction (`stopReason`, `AI_PROVIDER_<SURFACE>`, titres d'étapes écrits à la main). Ce code n'est pas commité ; il sera repris selon ce document.

**La règle qui en découle :** l'interface ne consomme qu'un modèle neutre. Une technologie n'apparaît jamais dans la forme des données, seulement dans leurs valeurs (un nom, un logo).

## 2. Inventaire : ce qu'un système logiciel peut montrer

Pour chaque aspect : où il se lit, et ce que VisionLayer en voit aujourd'hui (✓ oui, ◐ en partie, ✗ non).

### 2.1 Le langage et son paradigme

Le même concept prend une forme différente selon le paradigme. VisionLayer doit reconnaître le concept, quelle que soit la forme.

| Paradigme | Unités | Ce qui fait office de « contrat » | Ce qui fait office d'« appel » | Aujourd'hui |
|---|---|---|---|---|
| Objet (Java, C#, TS, Kotlin, Python) | classe, interface, héritage, méthode | interface, classe abstraite, protocole | méthode, souvent par dispatch dynamique | ◐ TS/JS seulement, dispatch non suivi |
| Procédural (C, Go en partie) | fichier, fonction, struct | struct de pointeurs de fonction (`struct file_operations` dans Linux), en-tête `.h` | appel direct, pointeur de fonction | ✗ |
| Fonctionnel (Haskell, Elixir, OCaml, F#, Clojure) | module, fonction pure, type | typeclass, behaviour, signature de module | composition, pipeline, fonction d'ordre supérieur | ✗ |
| Traits et génériques (Rust, Go, Swift, Scala) | trait, impl, interface implicite | trait, interface satisfaite sans déclaration | appel statique ou dynamique (`dyn`) | ✗ |
| Acteurs et réactif (Erlang/Elixir, Akka, RxJS) | acteur, processus, flux | protocole de messages | envoi de message, souscription | ✗ |
| Déclaratif (SQL, config, IaC, CSS) | table, vue, ressource | schéma, contrat de ressource | requête, référence | ◐ règles Firestore, Terraform en partie |
| Métaprogrammation | macro, décorateur, réflexion, code généré | ce que la macro ou le décorateur produit | appel résolu à l'exécution | ◐ décorateurs lus comme du texte |

Ce qui rend la lecture difficile, quel que soit le langage :
- **l'injection de dépendances** : qui implémente quoi n'est connu qu'au câblage ;
- **le dispatch dynamique** : `provider.turn()` ne dit pas quel `turn` ;
- **le code généré** (gRPC, ORM, OpenAPI) : la vérité est dans le fichier source du générateur ;
- **les chaînes** : une route, un nom de table, un topic sont souvent des chaînes construites.

### 2.2 L'architecture interne d'une application ou d'un service

| Motif | À quoi on le reconnaît | Ce qu'il faut montrer |
|---|---|---|
| En couches (n-tier) | groupes de modules dont les dépendances vont dans un seul sens | les couches, et chaque dépendance qui remonte |
| Hexagonale, ports et adaptateurs | un cœur sans dépendance vers l'extérieur ; des interfaces (ports) implémentées par des adaptateurs | le cœur, ses ports, les adaptateurs de chaque port |
| Clean, oignon | comme l'hexagonale, avec des cercles nommés | idem, et les violations de la règle de dépendance |
| MVC, MVP, MVVM | rôles de fichiers ou de classes par convention du framework | les triplets, par écran ou par route |
| CQRS, event sourcing | commandes et requêtes séparées, journal d'événements | qui écrit l'événement, qui le projette |
| DDD | contextes délimités, agrégats, dépôts | les contextes et ce qui les traverse |
| Micro-noyau, plugins | un cœur et des extensions chargées par un registre | le registre, les extensions et leur contrat |
| Tuyaux et filtres, pipeline | étapes chaînées | l'ordre des étapes et ce qu'elles passent |

Aujourd'hui : ✗. Aucun de ces motifs n'est reconnu. La couche IA de Nafar est une hexagonale sans le nom (un port, `AiProvider`, et trois adaptateurs).

### 2.3 L'architecture du système

| Style | À quoi on le reconnaît | Aujourd'hui |
|---|---|---|
| Monolithe, monolithe modulaire | un seul déployable ; des modules à l'intérieur | ◐ un bloc, sans ses modules |
| Client-serveur | un client (web, mobile, desktop) qui appelle un serveur | ✓ pour une app web qui appelle Firebase |
| Microservices | plusieurs déployables qui se parlent par le réseau | ◐ conteneurs vus, leurs appels entre eux non |
| Orienté services (SOA) | services partagés, souvent un bus ou un contrat WSDL/SOAP | ✗ |
| Événementiel | producteurs et consommateurs de messages ou d'événements | ◐ Cloud Tasks, déclencheurs Firestore |
| Serverless (FaaS) | fonctions déclenchées par des événements gérés | ✓ Firebase seulement |
| Pipeline de données, batch, ETL | tâches planifiées, étapes de transformation | ◐ tâches planifiées Firebase |
| Micro-frontends | plusieurs apps sous un même domaine | ✗ |
| Pair à pair, grille, embarqué, noyau | pas de serveur central ; ou un binaire unique avec des sous-systèmes | ✗ |

Un vrai système mélange souvent plusieurs styles. Nafar est client-serveur, serverless et un peu événementiel à la fois.

### 2.4 Communication entre les parties

HTTP/REST, GraphQL, gRPC et RPC, WebSocket, files de messages (Cloud Tasks, SQS, RabbitMQ, BullMQ), flux (Kafka, Pub/Sub), base de données partagée, fichiers, IPC, appels système, pointeurs de fonction. Aujourd'hui : ◐ (appels Firebase, `fetch` et `axios`, Cloud Tasks).

### 2.5 Les données

Relationnel (tables, schémas, migrations, ORM), document, clé-valeur, graphe, index de recherche, cache, stockage de fichiers, flux. Plus le contrôle d'accès (règles Firestore, sécurité par ligne de Postgres, IAM, vérifications dans le code) et le cycle de vie (états, conservation, suppression). Aujourd'hui : ◐ Firestore et ses règles seulement.

### 2.6 Exécution et déploiement

Processus, conteneurs, fonctions, tâches planifiées, workers, régions, environnements, configuration, noms de variables d'environnement, secrets (jamais leurs valeurs), feature flags. Aujourd'hui : ◐ (Firebase, Docker, docker-compose, Kubernetes, Terraform, nginx lus ; pas encore reliés au code qu'ils lancent, sauf Firebase et Docker).

### 2.7 Aspects transverses

Authentification et autorisations, frontières de confiance, observabilité (logs, métriques, traces), erreurs et reprises, sécurité, internationalisation. Aujourd'hui : ◐ (Firebase Auth, refus lus dans le déroulé d'une feature).

### 2.8 Dépendances externes

Paquets, API et SaaS tiers, fournisseurs d'IA. Aujourd'hui : ✓ paquets (niveau Technologies, plusieurs écosystèmes) ; ◐ API tierces (par hôte) ; ◐ IA (hôtes et SDK connus).

### 2.9 Construction, tests, CI

Graphe de construction (Makefile, Gradle, Cargo, Bazel, Kconfig pour Linux), tests, pipelines de CI, génération de code. Aujourd'hui : ◐ (scripts de `package.json`, tests atteints par une ancre).

### 2.10 Les personnes et l'organisation

Propriété du code (CODEOWNERS, MAINTAINERS de Linux), équipes, documentation, ADR, tickets. La structure d'un système suit souvent celle de l'équipe (loi de Conway). Aujourd'hui : ✗.

## 3. Pourquoi c'est difficile

Le nombre de combinaisons explose : langage × paradigme × framework × style d'architecture × manière de déployer. Écrire un détecteur à la main pour chaque combinaison ne finit jamais. Et un seul projet en combine plusieurs.

S'y ajoutent trois limites de principe :
- **Le code ne dit pas tout.** Une URL lue dans une variable, un topic construit à l'exécution, un choix fait par injection : il faut la configuration, l'exécution réelle, ou quelqu'un qui le déclare.
- **L'échelle.** Le noyau Linux compte des dizaines de milliers de fichiers. On ne peut ni tout recalculer à chaque changement, ni tout afficher.
- **La vérité.** VisionLayer ne montre que ce qu'il peut prouver. Une carte vide par manque de détecteur ne doit jamais passer pour « rien à voir ».

## 4. La stratégie proposée : des faits, des règles, un modèle neutre

L'idée tient en une phrase : **les lecteurs produisent des faits neutres, des règles en déduisent l'architecture, et l'interface ne lit que le résultat.** On s'inspire de ce que font les outils d'analyse à grande échelle (CodeQL chez GitHub, Glean chez Meta) : une base de faits sur le code, interrogée par des règles déclaratives. Ici, en plus petit, local, et centré sur l'architecture d'exécution.

### 4.1 Un modèle neutre, à quatre niveaux

Le modèle reprend les niveaux du modèle C4, que les équipes connaissent déjà :

| Niveau | Contient | Exemples |
|---|---|---|
| **Système** | le système et ce qui l'entoure : acteurs, systèmes externes | Nafar, ses utilisateurs, Anthropic, Google |
| **Déployables** | ce qui s'exécute séparément : app, service, fonction, tâche, base, file, binaire | App prep, Cloud Functions, Postgres, le noyau et ses modules |
| **Composants** | les parties d'un déployable : modules, couches, ports et adaptateurs, sous-systèmes | la couche IA, `mm/`, `net/` de Linux |
| **Code** | fichiers, symboles, appels | `engine.ts#runChat` |

Chaque nœud porte des **facettes**, jamais un type de technologie :

| Facette | Ce qu'elle décrit | Où Nafar l'a |
|---|---|---|
| `entrypoints` | ce qui fait entrer dans le nœud : route HTTP, fonction appelable, déclencheur, tâche planifiée, consommateur de message, `main` | Cloud Functions |
| `data` | les entités stockées (tables ou collections), qui lit, qui écrit, la règle d'accès si elle existe | Firestore |
| `contract` | une interface et ses implémentations, quelle que soit sa forme dans le langage | la couche IA |
| `channel` | ce qui transporte des messages : topic, file, événement | Cloud Tasks |
| `config` | noms des variables d'environnement, flags, environnements | partout |
| `trust` | frontière de confiance : ce qui arrive de l'extérieur, qui est authentifié | Auth |

Un écran s'affiche parce qu'un nœud a une facette, pas parce que le projet utilise Firebase. L'écran « Couche IA » devient l'écran d'un **contrat** ; il servira aussi pour des adaptateurs de paiement, de stockage ou d'e-mail.

### 4.2 Des faits, avec leur source

Toute lecture produit des **faits** atomiques, chacun avec sa preuve (fichier, ligne) et sa source :

```
defines(symbole, kind, fichier:ligne)
calls(appelant, appelé, ligne)                 implements(classe, interface)
entrypoint(symbole, kind: http|rpc|event|schedule|main, clé: "/orders" | "placeOrder")
reads(symbole, store, entité)   writes(symbole, store, entité)
publishes(symbole, canal, topic)   subscribes(symbole, canal, topic)
requests(symbole, cible: hôte | variable)
deploys(déployable, fichiers)   env(déployable, NOM)   access_rule(store, entité, ligne)
```

Six sources, toujours distinguées dans l'interface :

| Source | Apporte | Exemples |
|---|---|---|
| **Syntaxe** | symboles, appels, imports, dans tous les langages | tree-sitter (déjà utilisé ; grammaires disponibles pour la plupart des langages) |
| **Index de symboles** | qui appelle vraiment quoi, à travers les fichiers et les types | indexeurs SCIP (TypeScript, Java, Python, Go, C/C++, Rust, Ruby, C#…), lancés s'ils sont installés |
| **Manifestes** | ce qui se déploie, se construit, se configure | Dockerfile, docker-compose, Kubernetes, Terraform, `firebase.json`, `serverless.yml`, Makefile, Kconfig, Gradle |
| **Packs de détection** | ce que veut dire un appel de framework | « `app.get('/x', h)` dans Express est un point d'entrée HTTP » |
| **Exécution** (optionnel) | les appels réels entre services, quand le code ne suffit pas | traces OpenTelemetry exportées par le projet |
| **Déclaré** | ce que rien d'autre ne dit : rôle, raison, cible d'une variable | fiches d'agents, `.vision/*.yaml` |

### 4.3 Des packs de détection, écrits comme des données

Aujourd'hui, reconnaître `onCall` est du code TypeScript dans `analyze.ts`. Demain, c'est une règle dans un **pack** : un fichier par framework, qui associe un motif de l'arbre syntaxique à un fait neutre.

```yaml
# packs/express.yaml (illustration)
language: [javascript, typescript]
when: { import: express }
rules:
  - match: "(call (member _ @verb) (string @route) @handler)"   # app.get('/orders', h)
    where: { verb: [get, post, put, patch, delete] }
    emit: entrypoint(@handler, http, "@verb @route")
```

Ajouter une pile, c'est ajouter un pack et un petit projet de test. La vérité reste l'arbre syntaxique, jamais une expression régulière (ADR 0012). Firebase devient un pack parmi d'autres. Le code actuel sert de premier pack, et de test : la carte de Nafar doit rester identique.

### 4.4 Des règles qui déduisent l'architecture

Les faits sont joints par des règles déclaratives, à la manière de Datalog. Exemples :

```
lien(A, B, "message")  :- publishes(a, c, t), subscribes(b, c, t), dans(a, A), dans(b, B).
lien(A, B, "http")     :- requests(a, hôte(h)), sert(B, h), dans(a, A).
contrat(I, impls)      :- implements(C, I), count(C) >= 2.
violation(couche)      :- dépend(X, Y), couche(X) < couche(Y).
```

C'est ce qui permet de relier un producteur et un consommateur de messages écrits dans deux langages différents, sans code spécifique. Le moteur peut être un petit évaluateur écrit en TypeScript (quelques centaines de lignes, déterministe), ou un moteur existant si le volume l'exige.

### 4.5 Reconnaître un style, ne jamais le supposer

Un style d'architecture est une **lentille** calculée par des règles, avec ses preuves et ses exceptions, jamais un gabarit imposé à l'écran.
- **Hexagonale probable** : un groupe de modules sans dépendance vers les SDK, des interfaces qu'implémentent des modules qui, eux, en ont.
- **En couches** : un ordre des groupes où presque toutes les dépendances descendent ; chaque dépendance qui remonte est montrée.
- **Microservices** : plusieurs déployables reliés par le réseau.

L'écran dit par exemple : « hexagonale probable : 1 port, 3 adaptateurs, 0 fuite ». Il ne dit jamais « c'est une hexagonale ».

### 4.6 Découper ce que personne n'a déclaré

Dans un gros monolithe ou un noyau, les composants ne sont déclarés nulle part. On les propose en deux temps :
1. d'abord les indices explicites : dossiers de premier niveau, paquets du workspace, MAINTAINERS, CODEOWNERS, Kconfig ;
2. sinon, une détection de communautés (algorithme de Leiden) sur le graphe des dépendances et des appels, pondéré, puis nommée par les dossiers qui dominent chaque groupe.

Un découpage calculé est étiqueté « proposé ». Un agent ou un humain le confirme ou le corrige ; la correction est déclarée et reste.

### 4.7 Dire ce qu'on n'a pas lu

Chaque niveau affiche sa **couverture** : fichiers lus, langages non pris en charge, appels dont la cible est inconnue, packs manquants pour un framework détecté. « Aucun lien trouvé » et « ce langage n'est pas lu » ne doivent jamais se ressembler.

### 4.8 Tenir à grande échelle

- **Incrémental** : un fait est rattaché au fichier qui le prouve ; un fichier modifié ne recalcule que ses faits et les règles qu'ils touchent.
- **Profondeur à la demande** : la carte d'ensemble est persistée ; l'intérieur d'un composant ou le déroulé d'une feature se calcule quand on l'ouvre (comme aujourd'hui pour les features).
- **Budget** : un temps maximum par niveau sur un gros dépôt (RYP-173).

### 4.9 Ce que les agents apportent

Le code ne dira jamais tout : le rôle d'un bloc, la raison d'un choix, où pointe une URL lue dans une variable. Les agents le déclarent, dans la PR, ancré au code ([ADR 0012](../decisions/0012-runtime-architecture-and-feature-flows.md) phase 2, [ADR 0015](../decisions/0015-demarrage-d-un-projet-par-des-agents.md)). Ces déclarations sont des faits de source « déclaré », joints par les mêmes règles. Le récit de « la vie d'un appel » vient de là, ou du déroulé extrait, jamais d'une phrase écrite par l'extracteur.

## 5. Les autres voies, et pourquoi pas

| Voie | Pour | Contre |
|---|---|---|
| Continuer à écrire des détecteurs en code, pile par pile | déjà en place | ne finit jamais ; chaque pile oblige à toucher le cœur ; c'est ce qui a produit une extraction taillée pour Nafar |
| Faire lire tout le code par un modèle de langage | couvre tout, tout de suite | non déterministe, coûteux, invérifiable ligne à ligne ; contraire à « rien de faux montré comme vrai ». Il a sa place comme agent qui **déclare**, relu dans une PR |
| Utiliser CodeQL tel quel | très puissant, multi-langages | lourd ; licence restrictive pour du code privé ; centré sécurité, pas architecture |
| Utiliser Glean tel quel | conçu pour l'échelle, requêtes déclaratives | infrastructure lourde pour un outil local |
| **Faits neutres, packs et règles (proposée)** | une pile de plus = un pack de plus ; tout reste prouvé ; les styles se reconnaissent au lieu d'être supposés | un travail de fond avant de nouveaux écrans ; le modèle neutre doit être bien pensé une fois |

## 6. Ce que ça change pour l'interface

- **Les écrans lisent le modèle neutre** : niveaux, nœuds, facettes, liens, preuves, source et couverture. Aucun nom de technologie dans le code de l'interface.
- **Chaque écran se décrit par un concept** : Système (déployables et liens), Composants, Contrat, Données (entités, quel que soit le stockage), Canal (messages), Point d'entrée et son déroulé, Configuration, Confiance.
- **Les maquettes restent la référence de mise en page et de style.** Leur contenu venait de Nafar : chaque écran doit aussi avoir un état « projet sans cette facette » et un état « non lu ». *Fait le 30/09 au soir : les écrans du canevas ont été refaits pour n'importe quel projet, sur l'exemple atelier-api. Le 02/10, il est décidé que l'interface actuelle est jetée et que les écrans sont recodés depuis ces maquettes, sans migration écran par écran ([ADR 0017 §8](../decisions/0017-modele-neutre.md#8-la-migration)).*
- **Ce que l'interface ne peut pas encore montrer** attend son extraction (voir §7). Un écran n'est pas construit avant que son concept existe dans le modèle neutre.

| Écran | Maquetté | Données disponibles dans le modèle neutre | Peut être construit |
|---|---|---|---|
| Vue d'ensemble, Système | oui | oui (déployables, liens), une fois le modèle neutre posé | oui, après la migration |
| Bloc (service, app) | oui (03) | points d'entrée : oui ; composants : non | en partie |
| Données | oui (05, Firestore) | entités et accès : Firestore seulement | après le pack d'un 2ᵉ stockage |
| Contrat (ex-Couche IA) | oui (27, IA) | contrat, implémentations : oui en TS ; déroulé d'un appel : via le déroulé extrait | après la reprise du 30/09 |
| Canal (file, topic) | oui (28, Cloud Tasks) | Cloud Tasks seulement | après un pack de messagerie |
| Composants, couches, styles | non | non | maquette, puis règles |
| Authentification, Acteurs | oui (26, 34) | Firebase Auth seulement | après un pack d'auth |
| Couverture | non | non | maquette, puis calcul |

## 7. Le chemin proposé

Chaque étape se vérifie sur **deux projets au moins** : Nafar, et un projet de test d'une autre pile.

1. **Corpus de test.** Petits projets dans `tests/corpus/`, dans l'ordre des langages (JS/TS d'abord, Python ensuite) : atelier-api (Node, Express, Postgres, Redis, Stripe), une app Next.js avec Prisma, un service Python (FastAPI ou Django). Plus Nafar. Go, Java, Rust et C rejoignent le corpus avec leur phase (décidé le 01/10/2026 ; la proposition initiale comptait Kafka entre deux services Go ou Java et un projet C).
2. **Modèle neutre, [ADR 0017](../decisions/0017-modele-neutre.md)** (accepté le 01/10/2026). Niveaux, nœuds, facettes, liens, preuves, sources, couverture. Le format de `.vision/architecture.json` passe à la version 2.
3. **Base de faits et moteur de règles.** Faits rattachés à leur fichier, règles déclaratives, calcul incrémental.
4. **Le pack Firebase**, tiré du code actuel. La carte de Nafar doit rester la même, test à l'appui. *Révisé le 01/10 : un pack s'écrit depuis la documentation de sa technologie, pas depuis le code actuel ; Firebase est en pause, après les technologies d'atelier-api.*
5. **Trois nouveaux packs** : Express, Django, Kafka ; puis un pack C (appels, structs de pointeurs de fonction).
6. **Index de symboles SCIP** quand un indexeur est installé ; sinon, la syntaxe seule, et la couverture le dit.
7. **Reconnaissance des styles et découpage en composants** (règles, puis détection de communautés).
8. **Migration de l'interface** vers le modèle neutre, écran par écran, avec l'état « non lu ». *Révisé le 02/10 : l'interface est recodée depuis les maquettes, l'ancienne est jetée avec la carte version 1.*
9. **Passage sur trois dépôts réels d'autres piles** (RYP-172) et sur un gros dépôt (RYP-173).

**Vérifier sans se tromper soi-même** (décidé le 01/10/2026). Un bon score sur un projet du corpus prouve peu quand le projet et les packs ont été écrits par la même équipe. Trois ensembles, jamais mélangés :
- le **corpus d'apprentissage**, où l'on ajuste les packs ;
- le **corpus de contrôle** : projets jamais vus, oracle écrit avant de lancer, aucun pack ajusté pour lui ; raté puis corrigé, il passe dans l'apprentissage et il en faut un nouveau ;
- les **dépôts réels** (open source, anciens, bibliothèques), relus à la main, résultat publié.

Trois mesures pour chacun : trouvé, faux, non lu. Détail : [fonctionnement, chapitre 6](../fonctionnement/06-limites-et-verification.md).

## 8. Questions à trancher

**Tranchées le 01/10/2026 :**
1. Oui, le modèle neutre passe avant tout nouvel écran.
2. YAML pour les cas simples, avec une porte en TypeScript.
3. Les traces d'exécution viennent plus tard ; le modèle prévoit la source « exécution » dès son ADR.
4. Corpus aligné sur l'ordre des langages (voir §7, point 1).

L'ADR du modèle neutre prendra le numéro 0017 : 0016 est déjà « Créer un projet », et 0014 reste réservé au format du contexte (RYP-222).

Les questions telles qu'elles étaient posées :

1. **Le modèle neutre avant tout nouvel écran ?** Proposé : oui. Les écrans déjà refaits (Vue d'ensemble, Système) passent sur le modèle neutre ; Bloc, Données et Contrat attendent.
2. **Les packs en YAML, ou en TypeScript avec une API stricte ?** Proposé : YAML pour les cas simples, avec une porte en TypeScript pour ce que les motifs ne savent pas dire (résolution d'un chemin construit par une fonction utilitaire, par exemple).
3. **Les traces d'exécution** (OpenTelemetry) : dans le périmètre maintenant, ou plus tard ? Proposé : plus tard, mais le modèle prévoit la source « exécution » dès l'ADR du modèle neutre.
4. **Le corpus** : ces quatre piles, ou d'autres plus proches de tes projets et de ceux de tes amis ?
