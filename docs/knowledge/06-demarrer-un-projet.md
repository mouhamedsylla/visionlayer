# 06 — Démarrer un projet existant

**Statut :** conception, 29/09/2026. Décision de lancer des agents : [ADR 0015](../decisions/0015-demarrage-d-un-projet-par-des-agents.md).

## 1. Le problème

La première mission de VisionLayer est de donner à l'ingénieur une observation fidèle du système réel, en temps réel. Pour un projet qui démarre avec VisionLayer, la connaissance s'écrit au fil du travail des agents. Mais la plupart des projets existent déjà, parfois depuis des années.

**Ce qui se calcule déjà sur tout projet :** les blocs, les points d'entrée, les appels, les lectures et écritures de données, les files, les technologies, le déploiement.

**Ce que le parcours du code ne donnera jamais :**
- le but d'une feature ;
- pourquoi une règle existe ;
- ce que veut dire un état ;
- qui fait foi entre deux copies d'une donnée ;
- pourquoi on a choisi une solution plutôt qu'une autre ;
- ce qu'on suppose d'un service externe.

Ce sens existe presque toujours quelque part, mais éparpillé. Le démarrage le rassemble, le fait vérifier par un humain, et pose l'état initial du système. Ensuite, chaque micro-tâche d'un agent le tient à jour.

## 2. Les sources

Le code dit comment le système tourne. Le pourquoi est souvent ailleurs : dans les PR, les tickets, les discussions. Le démarrage commence donc par relier le projet à ce qui porte son histoire.

| Source | Ce qu'elle apporte | Comment on la relie au code | Première version |
|---|---|---|---|
| Le code, lu par une IA | commentaires, noms, messages d'erreur, conditions de refus : le but et les règles | c'est le code | oui, toujours |
| L'historique Git local | messages de commit, retours arrière, date et auteur d'une condition : le pourquoi des décisions | `git blame` sur les lignes | oui, toujours |
| Les docs du dépôt | README, ADR, specs, guides | par les noms de fichiers, de fonctions et de collections qu'elles citent | oui, toujours |
| Les tests | leurs noms disent souvent la règle | leurs imports atteignent le code | oui, toujours |
| La configuration | noms de variables (jamais leurs valeurs), règles d'accès, déploiement | déjà dans la carte | oui, toujours |
| **GitHub** | descriptions et discussions des PR, issues liées : le pourquoi d'un changement, discuté | une PR connaît ses commits, donc les lignes qu'elle a changées | **oui** |
| **Linear** | le but d'une feature et ses critères d'acceptation, les décisions dans les commentaires, les bugs (les pannes réelles) | identifiant du ticket dans une branche, un commit ou une PR ; sinon rapprochement par le texte, qui reste une hypothèse à confirmer | **oui** |
| Jira | le même rôle que Linear | pareil | plus tard |
| Slack | des décisions prises en discussion, au milieu de beaucoup de bruit ; seulement les canaux choisis | par les liens vers des PR ou des tickets | plus tard |
| Notion, Confluence | specs et docs hors du dépôt | comme les docs du dépôt | plus tard |
| Les humains | ce que rien ne dit | par des questions précises | oui |

**Ce que vaut un ticket dépend de l'équipe.** Si les branches, commits ou PR citent l'identifiant du ticket, le lien avec le code est sûr. Sinon, le rapprochement se fait par le texte, et reste une hypothèse. Sur Nafar, aucun des 321 commits ne cite un identifiant, et seulement 3 branches ; les 55 PR donnent en revanche un lien sûr vers les lignes changées.

**Règles des connexions :**
- lecture seule : VisionLayer n'écrit jamais dans ces outils (ADR 0013) ;
- les clés et jetons restent sur la machine, dans le trousseau du système, jamais dans le dépôt ; pour GitHub, la connexion `gh` existante suffit ;
- ce qui est lu sert au démarrage et reste local.

## 3. Le démarrage en cinq temps

### 3.1 Extraire (automatique, sans agent)

Le scan existant : modèle, architecture, technologies, infrastructure.

### 3.2 Relier les sources (un humain)

L'écran « Relier » montre ce qui est déjà dans le dépôt (code, historique, docs, tests), puis propose les connexions : GitHub, détecté par le remote ; Linear, avec le choix de l'équipe et des projets. Pour chacune, il dit ce qu'elle apporte et comment elle se relie au code, y compris quand les liens sont faibles.

### 3.3 Préparer (automatique, sans agent)

VisionLayer calcule **ce qui manque de sens** :
- les points d'entrée sans feature, avec un regroupement proposé par les écrans qui les appellent ;
- les collections et tables sans définition ;
- les champs d'état et les valeurs qu'on leur écrit ;
- les conditions de refus et les chemins d'erreur ;
- les appels à des services externes, les files et leurs nouvelles tentatives.

Il indexe aussi les sources : les docs du dépôt, et les commits qui ont touché chaque point d'entrée.

Puis il découpe le travail en **lots bornés**, un par bloc ou par groupe de features. Il commence par ce qui écrit des données et par les chemins à haut risque. Chaque lot a une estimation de tokens, calculée sur la taille du code et des sources à lire, jamais inventée.

### 3.4 Écrire (des agents, lancés par VisionLayer)

Sur un clic humain, VisionLayer lance un agent par lot, sur une branche dédiée (ADR 0015). Chaque agent reçoit :
- son lot ;
- la carte du lot ;
- les sources indexées ;
- les consignes d'écriture.

Il écrit dans `.vision/knowledge/` :
- **des affirmations ancrées**, chacune avec **sa source** (voir 4) ;
- **des questions**, quand il ne trouve pas la réponse ;
- **des contradictions**, quand deux sources disent des choses différentes.

### 3.5 Vérifier (un humain, dans l'interface)

- **VisionLayer vérifie** d'abord ce qui se vérifie : l'ancrage existe, la condition de refus existe, le code dit la même chose que l'affirmation.
- **L'humain passe ensuite en revue** trois files :
  - les **hypothèses** : confirmer, corriger ou rejeter ;
  - les **questions** : répondre ; la réponse devient une affirmation de source « humain » ;
  - les **contradictions** : trancher.
- **La couverture** dit où on en est : points d'entrée couverts par une feature, collections définies, conditions de refus expliquées, décisions trouvées.
- **La PR** rassemble le tout, relue comme n'importe quel code.

Le démarrage ne vise pas 100 % : il pose un socle fidèle. Le reste s'enrichit à chaque tâche.

## 4. La source de chaque affirmation

| Source | Exemple | Ce que ça vaut |
|---|---|---|
| `doc` | `docs/strategie-ia.md` §4 | écrit par l'équipe ; peut être ancien |
| `commit` | `a1b2c3d` « fix: rembourse une seule fois » | le pourquoi au moment du changement |
| `pr` | PR #42 | la discussion de l'équipe |
| `ticket` | Linear RYP-136 | le but et les critères, s'ils sont écrits |
| `comment` | commentaire ligne 88 | proche du code ; peut mentir |
| `test` | `test("un code sert à un seul compte")` | la règle, telle qu'on la teste |
| `code` | déduit du code seul | **hypothèse : à confirmer par un humain** |
| `human` | réponse à une question, ou revue | fait foi |

Une affirmation sans source n'est jamais présentée comme un fait. Elle reste « à confirmer » tant qu'un humain ne l'a pas relue.

## 5. Les questions à l'humain

Une bonne question se répond en quelques secondes. Elle :
- porte sur **un seul point** ;
- montre **ce que l'agent a trouvé**, avec les sources et le code ;
- propose **des réponses**, quand il y en a de plausibles ;
- dit **ce que la réponse change** (quelle affirmation elle crée ou corrige) ;
- peut être **renvoyée à quelqu'un d'autre** ou **laissée pour plus tard**.

Exemple réel, sur Nafar :

> **Combien de vidéos par jour en production ?**
> `docs/strategie-ia.md` dit 1 (`VIDEO_DAILY_CAP` dans `functions/.env.<projet>`). Mais les fichiers `.env` des Functions ne définissent pas cette variable : c'est la valeur par défaut du code, 3, qui s'applique.
> - La doc est à jour : il manque la variable dans les `.env`.
> - Le code fait foi : la doc est ancienne.
> - Je ne sais pas.
>
> Ta réponse fixe `video.daily-cap`.

## 6. Ce que ça demande

| Travail | Où |
|---|---|
| Brief de démarrage : ce qui manque de sens, lots, estimation | nouveau |
| Consignes de démarrage pour les agents | avec RYP-135 |
| Source, questions et contradictions dans le format | avec RYP-177 |
| Lancer, suivre et arrêter les agents d'un démarrage | nouveau (ADR 0015) |
| Détection des contradictions entre sources | nouveau |
| Relier GitHub et Linear, en lecture seule ; clés dans le trousseau | nouveau |
| Écrans : ouvrir un projet, relier les sources, préparer, en cours, questions, revue et couverture | maquettés le 29/09 (page « 6 · Démarrer un projet ») |
| Démarrage de Nafar, à la place de la connaissance écrite à la main | premier test réel |
