# Carte du système

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Quelles unités s'exécutent, et comment communiquent-elles ? Que change un pack quand on le charge ? | système | nœuds de niveau `deployable` et `system`, arêtes entre eux, et le pack qui a produit chaque fait | codée (maquettes A1 à A3) ; redessinée le 27/10 pour le hackathon (écran 03), avec l'effet d'un pack chargé |

## 1. Objet

La carte montre trois choses :
- les unités d'exécution : app, service, fonction, worker, tâche, binaire ;
- les ressources qu'elles utilisent : stockages, canaux, services gérés, services externes ;
- les échanges qui les relient, typés et comptés.

Elle dit aussi d'où vient chaque élément : le pack qui l'a lu, ou « non lu » quand aucun pack ne couvre sa technologie. On peut donc voir ce qu'un pack vient d'ajouter, et revenir à la carte sans lui.

## 2. Fondement

C'est le niveau « conteneurs » d'une description d'architecture : ce qui est déployé séparément et communique à travers une frontière réseau ou un stockage partagé. Les propriétés majeures d'un système se lisent à ce niveau :
- son **style** : client-serveur, services, serverless ;
- ses **points de couplage** : une ressource partagée par plusieurs unités ;
- ses **contournements** : un client qui écrit directement dans un stockage, hors de tout service.

La carte est la somme des faits lus dans le code, et chaque fait porte le pack qui l'a produit. Charger un pack ajoute ses faits. Le retirer enlève exactement ces faits-là, et rien d'autre. La carte « sans le pack » n'est donc pas un souvenir : elle se recalcule, et elle doit être identique à celle d'avant le chargement. C'est la vérification « charger puis retirer = jamais chargé » de l'[Atelier de pack](atelier-de-pack.md), montrée ici sur la carte.

## 3. Ce que la vue établit

- **Le style d'architecture** et la répartition des responsabilités entre unités. Chaque raison du style est reliée à une ligne de code ou de configuration.
- **Les ressources partagées**, donc les points où une modification se propage.
- **Les échanges qui ne passent par aucun service** : seule une règle de stockage les contrôle.
- **Les cibles inconnues** : une communication dont l'adresse est lue dans une variable et n'est pas déclarée.
- **Ce qui n'est pas lu** : une unité, un échange ou un mécanisme dont la technologie n'a pas de pack. Il porte « non lu », jamais une supposition.
- **Ce qu'un pack a ajouté** : les éléments et les libellés nouveaux, la différence en chiffres, et le retour à la carte d'avant.

## 4. Représentation

L'écran suit la direction du hackathon : cartes blanches, une seule carte noire, étiquettes mono. Les règles du [chapitre 7, section 0](../grammaire/07-les-representations.md) s'appliquent : une phrase avant le dessin, de vrais noms, des traits droits, une flèche de 8 px.

- **En-tête :**
  - le nom du projet et la question de la vue ;
  - le style reconnu, en une phrase, avec ses raisons (`fichier:ligne`), proposé par l'assistant et confirmé par l'humain ;
  - un sélecteur « Sans le pack · Avec le pack » quand un pack vient d'être chargé.
- **Carte noire : le dernier pack chargé.**
  - À gauche, ce que la carte sait de plus, en une phrase, puis « Retirer le pack » et « Ouvrir dans l'atelier ».
  - À droite, la différence en chiffres : faits ajoutés, faits retirés, points nouveaux, fichiers lus. On y trouve aussi le résultat du retrait : « retiré, la carte revient fait pour fait ».
  - Sans pack récent, la carte noire montre ce qui n'est pas lu et renvoie vers l'atelier.
- **La carte, en trois couloirs, de gauche à droite :**
  - *ce qui appelle* : les clients, et un service extérieur quand il appelle le système, comme un webhook ;
  - *ce qui tourne côté serveur* ;
  - *ce qu'ils utilisent* : stockages et services extérieurs appelés.
  - Une partie événementielle se lit de haut en bas dans le couloir du serveur : qui met en file, la file, qui la consomme.
- **Les blocs** portent le logo de leur technologie, leurs compteurs mono (routes, tables), « ×2 » s'ils tournent en plusieurs exemplaires, et « non lu » en `signal-ink` pour une technologie sans pack.
- **Les liens :**
  - Le trait dit la nature du lien : appel, écriture, lecture, message.
  - L'élément choisi montre ses liens en `ink`, avec leurs libellés et leurs comptes.
  - Sur un petit système, les autres liens restent en gris clair, sans libellé, pour garder la structure. Sur un grand, ils sont cachés.
- **La marque du pack :** pendant la comparaison, chaque libellé ou bloc ajouté par le pack porte une marque verte « + nom-du-pack ». Côté « Sans », la même place porte « non lu ». La valeur avant et après est donc visible au même endroit.
- **Panneau de l'élément choisi :**
  - ses technologies, chacune avec son pack ;
  - ses exemplaires et ses points d'entrée ;
  - ses liens, avec leurs comptes et un exemple `fichier:ligne` ;
  - les faits que le dernier pack lui a ajoutés.

Retirer le pack remet le sélecteur sur « Sans ». La carte qu'on voit alors est la carte recalculée, et la carte noire dit si elle est identique à celle d'avant le chargement.

## 5. L'exemple d'atelier-api et de `cookie-parser`

**Le style :** client-serveur, avec une partie événementielle.
- L'app web appelle l'API Express (`web/src/api/client.ts:4`) et ne touche jamais Postgres. Seuls l'API et le worker y accèdent (`src/db.ts:6`).
- L'API met en file `emails` sur Redis avec BullMQ (`src/queue.ts:9`), et le worker la consomme (`src/email/main.ts:6`).

| Couloir | Blocs |
|---|---|
| Ce qui appelle | App web (React, Vite) ; Stripe, qui appelle `POST /webhooks/stripe` et que l'API appelle en retour (3 appels, 10 s de délai, 2 reprises) : un seul bloc, deux liens, celui du retour vers la gauche |
| Ce qui tourne | API (Express, ×2 machines, 15 routes, 3 tâches planifiées) ; en dessous, la file `emails` (Redis, BullMQ), puis le Worker emails, puis Resend et le serveur SMTP qu'il appelle |
| Ce qu'ils utilisent | Postgres (14 tables), qui montre les tables écrites et lues par le bloc choisi |

Les liens de l'API, choisie par défaut :
- l'app web l'appelle 8 fois ;
- Stripe l'appelle 1 fois, par le webhook ;
- elle appelle Stripe 3 fois ;
- elle écrit 21 fois dans 9 tables de Postgres et lit 17 fois dans 5 ;
- elle met en file `emails` 6 fois.

**Ce que `cookie-parser` change :**

| À cet endroit | Sans le pack | Avec le pack |
|---|---|---|
| Lien app web → API | 8 appels, dont 4 vers des routes gardées : la garde est connue (`requireUser`), pas ce qu'elle lit | 4 appels présentent le cookie `sid`, 2 le reçoivent (inscription, connexion) |
| Bloc API | cookie-parser : non lu | lecteur de cookies sur 14 routes sur 15 (`src/app.ts:34`) |
| Lien Stripe → API | 1 appel, signé | 1 appel, signé ; ne passe pas par le lecteur de cookies (déclaré avant, `src/app.ts:31`) |
| Session des 8 routes gardées | non lue | cookie `sid` non signé, vérifié en base dans `sessions` (`src/auth/session.ts:28`) |
| Points à surveiller | — | +1 : `SESSION_SECRET` ne signe aucun cookie |

Différence : 4 faits ajoutés, 0 retiré, 1 point nouveau, 60 fichiers lus sur 60 au lieu de 58. Une fois le pack retiré, la carte redevient celle d'avant, fait pour fait.

## 6. Selon la taille du projet

| Projet | Ce qu'on y voit | Exemple |
|---|---|---|
| Petit | une dizaine de blocs ; tous les liens visibles, ceux de l'élément choisi en `ink` | atelier-api : 3 déployables, 2 ressources, 3 services extérieurs |
| Moyen | des services groupés par domaine ; seuls les liens de l'élément choisi | un pack de file de messages : la différence se range par déployable |
| Grand | des domaines repliés, ouverts un à un ; les liens entre domaines comptés | un pack ajoute des centaines de faits : la carte noire les compte par relation, la carte ne marque que les blocs touchés |

## 7. Sources et technologies

Trois sources, chacune avec ses occurrences (lignes) :
- les manifestes de déploiement, pour les unités ;
- le code, lu par les packs, pour les échanges ;
- le pack qui a produit chaque fait, pour la provenance.

| Information | Source |
|---|---|
| Unités, exemplaires | manifestes (`fly.toml`, `Dockerfile`, `docker-compose.yml`) |
| Échanges et comptes | le code, lu par les packs (Express, Drizzle, BullMQ, Stripe…) |
| Style | proposé par l'assistant à partir des points de contact, chaque raison reliée à une ligne ; confirmé par l'humain |
| Ce qu'un pack a ajouté | les faits marqués par pack, comparés à la carte sans lui |

Le modèle de langage propose un style et rédige la phrase de la carte noire. Il n'écrit aucun bloc, aucun lien, aucun compte.

**Ce qui dépend de la technologie.**
- Le rôle d'une unité vient de sa technologie. Une fonction gérée démarre à la demande et peut tourner en plusieurs exemplaires. Un service garde un processus.
- Les garanties d'un échange aussi. Un appel direct, une mise en file et un déclencheur de stockage n'ont pas les mêmes garanties de livraison.
- La carte qualifie donc chaque arête par la technologie qui la porte. Pour un client, elle montre s'il atteint un stockage directement, ce que seule une technologie qui l'autorise rend possible.

## 8. Ce qui est lu aujourd'hui, et ce qui manque

| Élément | État |
|---|---|
| Unités, ressources, liens comptés avec leurs occurrences | codé |
| Faits marqués par pack, carte sans un pack | à faire (ADR 0019, étape 1) |
| Style proposé avec ses raisons | à faire, pendant le hackathon (Muse Spark) |
| Sélecteur « Sans · Avec » et marque du pack | à faire, avec l'écran |

## 9. Limites

- Pas l'intérieur d'une unité, ni le trafic réel. Une arête existe parce qu'une ligne la produit.
- Une unité déclarée sans code lisible apparaît avec son langage non lu.
- Un pack ajoute ce qu'il lit dans le code, pas ce qui se passe à l'exécution. Exemple : la carte sait que le cookie `sid` n'est pas signé, pas si quelqu'un a déjà tenté de le forger.

## 10. Relations

- Vers l'[Intérieur d'un bloc](interieur-d-un-bloc.md), en entrant dans un bloc.
- Vers [Données](donnees.md) pour un stockage.
- Vers [Déploiement](deploiement.md) pour l'hébergement d'une unité.
- Vers [Défaillances](defaillances.md) pour une dépendance externe.
- Vers l'[Atelier de pack](atelier-de-pack.md), pour le pack qui a ajouté un fait ou pour une technologie « non lue ».
- Vers [Accès](acces.md), pour un point à surveiller sur la session.
