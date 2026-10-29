# 7. Les représentations

Le [chapitre 6](06-grammaire-visuelle.md) dit comment un écran se compose. Ce chapitre dit avec quelles **formes** on dessine le système. Il donne d'abord le vocabulaire commun (les objets, les liens, les marques), puis le catalogue des représentations : chacune répond à une question, et tout écran en emprunte une. Enfin, il donne les styles d'architecture reconnus et la disposition de la carte pour chacun.

Une représentation n'appartient à aucun écran. Le déroulé d'un point d'entrée, le trajet d'un message et la vie d'un appel dans un contrat sont la même représentation. Ce qui change, c'est l'objet qu'on lui donne. Ajouter un écran, c'est choisir une représentation de ce catalogue, pas en inventer une.

Les couleurs sont celles de la direction du hackathon ([design système « VisionLayer Hackathon »](https://claude.ai/artifact/VCw4cF98qRfhQQTDupvAuf)). Les formes valent pour toute direction.

## 0. Se comprendre en quelques secondes

Une représentation qu'on ne comprend pas d'un regard rend l'écran inutile. Avant sa forme, chacune respecte ces règles. Elles ont été posées le 20/10/2026, après une première série de miniatures illisibles : texte hors de son cadre, têtes de flèche démesurées, frise de course incompréhensible.

1. **Une phrase d'abord.** Au-dessus du dessin, une phrase dit ce qu'il montre sur ce projet. Exemple : « Le client a payé, sa réservation est annulée et sa place remise en vente. » Le dessin prouve la phrase ; il ne la remplace pas.
2. **Un seul sens de lecture.** Soit de gauche à droite, de ce qui appelle à ce qui est touché. Soit de haut en bas, dans l'ordre du temps. Une ligne « Se lit : … » le dit quand ce n'est pas évident.
3. **Un cas réel, jamais une forme vide.** Chaque boîte porte un vrai nom du projet. Une boîte sans nom, un carré noir sans légende ne disent rien.
4. **Le texte tient dans son cadre.** Une boîte prend la taille de son texte. Le texte n'est jamais posé à une coordonnée fixe. Au moins 11 px ; le mono des chemins et des routes au moins 11 px aussi.
5. **Des traits droits.** Horizontaux ou verticaux, sans courbe qui traverse un autre élément. Un trait s'arrête au bord de sa cible.
6. **Une tête de flèche de taille fixe.** 8 px, quelle que soit l'épaisseur du trait. L'épaisseur dit la nature du lien (écrire pèse plus que lire), jamais la taille de la tête.
7. **Une couleur a toujours son mot.** Rouge ou orange viennent avec un libellé (« constat », « sans revérifier ») ou une légende visible.
8. **La valeur, pas seulement l'action.** Quand une donnée change, on montre sa valeur avant et après (`pending` → `cancelled`), pas seulement « écrit ».
9. **Vérifié sur une capture en pleine résolution** avant d'être montré : aucun texte coupé, aucune flèche qui mord, rien qui se chevauche.

## 1. Le vocabulaire commun

### Les objets

Chaque objet du modèle neutre a une seule forme, partout.

| Objet | Forme | Ce qu'elle porte |
|---|---|---|
| **Déployable** (bloc) | carte blanche, filet, rayon 12 | logo de la technologie, nom, compteurs mono (routes, tables), « ×2 » s'il tourne en plusieurs exemplaires |
| **Client** (app web, mobile) | même carte, coin supérieur coupé | ce qu'il appelle |
| **Service extérieur** | carte sur fond `surface-sunken`, étiquette EXTÉRIEUR | ce que le système lui envoie |
| **Ressource gérée** (base, file, stockage) | carte basse, rayon 8, glyphe de genre (base : trois traits ; file : chevrons ; stockage : dossier) | ses tables ou ses files |
| **Composant** | rectangle rayon 8, plus petit | trait plein : contrat lu dans le code ; trait pointillé : composant calculé |
| **Fonction** | nom en mono, puce `surface-sunken` | ses appelants, au survol |
| **Point d'entrée** | badge de méthode + route en mono (`POST /payments`) ; une tâche : horloge + nom | sa garde, en marque |
| **Entité** | puce mono avec glyphe de grille (`bookings`) | ses champs, dans le panneau |
| **Message, file, sujet** | puce mono avec glyphe de chevrons (`emails`) | producteurs et consommateurs |
| **Acteur** | rond à initiales ou glyphe (personne, service, fournisseur) | sa preuve d'identité |
| **État** (d'une entité) | pastille : blanche à filet ; noire pour un état final ; pointillée grise pour un état jamais écrit | les écritures qui y mènent |

### Les liens

Écrire pèse plus que lire, et un lien n'apparaît que pour l'élément choisi (chapitre 6, « La sélection révèle »).

| Lien | Trait | Flèche |
|---|---|---|
| Appel synchrone | plein, `ink`, 1,5 px | pleine |
| Écriture | plein, `ink`, 2 px | pleine |
| Lecture | plein, `muted`, 1 px | ouverte |
| Message asynchrone (mise en file, publication) | pointillé, `ink`, avec la puce de la file au milieu | pleine |
| Relation déclarée par un agent | pointillé long, `line-strong`, avec le nom de l'agent | ouverte |
| Chemin d'échec | plein, `signal` ou `critical` selon la gravité | pleine |

L'épaisseur peut compter les occurrences (de 1 à 3 px). Elle ne sert jamais à autre chose.

### Les marques

| Marque | Forme | Exemple |
|---|---|---|
| **Effet** | étiquette mono : écriture sur fond `ink`, lecture à filet | ÉCRIT `payments` · LIT `bookings` · APPELLE Stripe · MET EN FILE `emails` · REFUSE 409 |
| **Étape** | pastille ronde noire numérotée | ① ② ③ : le même numéro dans le déroulé et en marge du code |
| **Moment** | bandeau `surface-sunken` titré, qui se replie | « Vérifier », « Payer », « Prévenir » |
| **Aiguillage** | petit losange, une branche par condition, chacune nommée | `status ≠ pending` → 409 |
| **Cadre de cohérence** | cadre pointillé autour des étapes, étiquette mono | TRANSACTION · VERROU · CLÉ D'IDEMPOTENCE |
| **Qualification** | puce avec le logo de la technologie | Stripe · rejoué tant qu'il n'est pas accepté |
| **Provenance** | trait plein : lu ; pointillé + nom : déclaré ; pointillé + PROPOSÉ : pack proposé ; « non lu » en `signal-ink` | — |
| **Gravité** | `critical` : constat ; `signal` : à surveiller ; `live` : vérifié. Toujours avec un libellé, et la ligne vient en premier | — |
| **Preuve** | `fichier:ligne` (CodeRef) | `src/jobs/expire.ts:20` |
| **Temps** | axe horizontal, heures en mono | 03:00 · 08:00 · chaque minute |

## 2. Le catalogue

Chaque représentation a un code. Les fiches de vue le citent (« le déroulé, F1 »).

### Structure : ce qui existe

| Code | Représentation | Question | Forme | À l'échelle | Écrans |
|---|---|---|---|---|---|
| S1 | **Carte par style** | De quoi le système est-il fait ? | les déployables rangés selon le style reconnu (§ 3) ; les liens de l'élément choisi seulement | blocs groupés par domaine, puis repliés | Carte |
| S2 | **Intérieur d'un bloc** | Comment ce déployable est-il composé ? | trois colonnes : propres, partagés, socle ; les appels vont toujours vers la droite | composants groupés par dossier | Intérieur d'un bloc |
| S3 | **Fonctions offertes** | Que fournit ce composant, et à qui ? | une ligne par fonction, rangée par nombre d'appelants ; les fonctions internes en retrait | 5 lignes puis « voir les N autres » | Composant |
| S4 | **Grille de couverture** | Qu'est-ce qui est lu ? | une case par fichier, une colonne par dossier | dossiers repliés en « + N » | Vue d'ensemble, Couverture |
| S5 | **Familles de technologies** | De quoi le système dépend-il ? | tuiles à logo groupées par famille | familles repliées | Technologies |

### Flux : comment ça circule

| Code | Représentation | Question | Forme | À l'échelle | Écrans |
|---|---|---|---|---|---|
| F1 | **Déroulé** | Que fait cette exécution, dans quel ordre ? | colonnes : l'appelant, les composants traversés, puis les ressources ; une ligne par étape avec sa flèche, son effet et sa preuve ; étapes groupées en moments ; refus dans « si ça rate » | moments repliés, sauf celui de la sélection | Points d'entrée, Features, Contrats (vie d'un appel), Déclencheurs |
| F2 | **Trajet asynchrone** | Que devient ce message entre son envoi et son traitement ? | le déroulé F1, coupé par la file : avant, la file (reprises, idempotence, ordre), après | une file par trajet | Messages, Déclencheurs |
| F3 | **Lignée d'une donnée** | D'où vient ce champ, et où va-t-il ? | le champ au centre ; à gauche ceux qui l'écrivent ; à droite ceux qui le lisent, les services et les journaux qui le reçoivent ; en dessous, ce qui l'efface | lecteurs groupés par déployable | Données personnelles, Données |
| F4 | **Chaîne de livraison** | Comment le code arrive-t-il en production ? | flux horizontal : déclencheurs, puis jobs en colonnes selon leurs dépendances | un workflow à la fois | Déploiement |

### Algorithmes : comment ça décide

| Code | Représentation | Question | Forme | À l'échelle | Écrans |
|---|---|---|---|---|---|
| A1 | **Algorithme indexé** | Que fait cette fonction, ligne par ligne ? | trois zones : les étapes numérotées (effets, aiguillages, cadres de cohérence), le code lu sur place avec les mêmes numéros en marge, le voisinage (appelants, appelés) ; choisir une étape surligne ses lignes | le code par passages de 80 lignes ; fonctions internes dépliables | Code, Composant, Features (onglet Code) |
| A2 | **Aiguillage** | Quand cette fonction refuse-t-elle, et que laisse-t-elle ? | chaque condition et ses branches, chaque refus avec son code, ce qui est défait par un rattrapage | branches rares repliées | panneau d'un point d'entrée, Défaillances |

### État et temps : comment ça évolue

| Code | Représentation | Question | Forme | À l'échelle | Écrans |
|---|---|---|---|---|---|
| T1 | **Cycle de vie** | Par quels états passe cette donnée ? | les états en pastilles, reliés par les écritures qui les produisent (fonction, condition de départ, preuve) ; un état jamais écrit en pointillé | états rares regroupés | Données (entité) |
| T2 | **Frise de course** | Que se passe-t-il si deux exécutions se croisent ? | deux couloirs de part et d'autre de la donnée ; lectures et écritures dans l'ordre du temps ; l'état final en conclusion ; la protection, ou son absence | une course par frise | Concurrence, Replays |
| T3 | **Horloge** | Qu'est-ce qui tourne sans personne, et quand ? | une journée sur un axe ; les tâches à leurs heures, multipliées par le nombre d'exemplaires ; les déclenchements par arrivée hors de l'axe | tâches groupées par déployable | Déclencheurs |
| T4 | **Chronologie** | Qu'a-t-on changé, et qui ? | une ligne par session ou par analyse, ses éléments touchés, sa différence signée | par jour, puis par semaine | Agents, Vue d'ensemble |

### Frontières : qui entre, et ce qui en dépend

| Code | Représentation | Question | Forme | À l'échelle | Écrans |
|---|---|---|---|---|---|
| X1 | **Matrice d'accès** | Qui touche quoi ? | lignes : entités ou routes ; colonnes : acteurs ou niveaux ; une marque par accès (lecture, écriture, refus) | colonnes en filtre au-delà de 8 | Données, Accès |
| X2 | **Pile des couches** | Où cet appel est-il vérifié ? | les couches traversées de l'hôte à la base, chacune lue, déclarée ou non lue | — | Accès (panneau) |
| X3 | **Contrat** | Quelle implémentation répond, et que garantit-elle ? | l'interface au centre ; les implémentations en colonnes ; le sélecteur relié à chaque valeur qu'il choisit | — | Contrats |
| X4 | **Étoile de dépendance** | Que devient le système si ceci tombe ? | la dépendance au centre ; les points d'entrée autour ; pour chacun, le chemin d'échec et l'état laissé | points d'entrée groupés par déployable | Défaillances |

### Changement et preuve

| Code | Représentation | Question | Forme | À l'échelle | Écrans |
|---|---|---|---|---|---|
| C1 | **Impact** | Qu'est-ce qui dépend de cet élément ? | quatre colonnes : ce qui le produit, l'élément, ce qui le lit, ce qui en dépend ; une lecture qui décide porte sa marque | colonnes groupées par déployable | Impact, Revues |
| C2 | **Différence signée** | Qu'est-ce qui a changé ? | une liste « + / − » par relation, chaque ligne avec sa preuve | repliée par relation (« +214 `entrypoint` ») | Vue d'ensemble, Revues, Atelier de pack |
| C3 | **Code en place** | Quelle ligne l'établit ? | passage de code sur fond `night`, lignes de la preuve surlignées, secrets masqués | 80 lignes | partout, au clic sur une preuve |
| C4 | **Affirmation ancrée** | Ce que l'équipe a déclaré tient-il encore ? | l'affirmation, son type, son état, son ancre ; le code au moment de l'écriture à côté du code courant | — | Connaissance, Règles et décisions |

## 3. Les styles d'architecture

Un style n'est jamais supposé. VisionLayer lit les points de contact dans le code (routes, bases, files, appels entre services). L'assistant propose un style et donne ses raisons, chacune reliée à une ligne de code ou de configuration. L'humain confirme, et la carte (S1) prend la disposition du style. Plusieurs styles peuvent se cumuler : un monolithe avec une partie événementielle, par exemple.

| Style | Signes lus dans le code | Disposition | Ce qu'on lit d'un coup d'œil |
|---|---|---|---|
| **Client-serveur, monolithe** | un serveur qui expose des routes, des clients qui les appellent, une base derrière | trois couloirs : clients → serveur → données | combien de clients ; qui touche les données sans passer par le serveur ; ce que le serveur expose |
| **Serverless** | des fonctions déclenchées par une plateforme (HTTP, planning, file, stockage) ; des services gérés | déclenche → s'exécute → géré | les accès directs d'une app à la base ; les fonctions que personne n'appelle ; les files et ce qu'elles réveillent |
| **Microservices** | plusieurs déployables qui s'appellent entre eux ; une passerelle | par niveau d'appel depuis l'entrée | la plus longue chaîne d'appels synchrones ; les services dont tout dépend ; qui partage une base avec qui |
| **Événementiel** | des sujets ou des files avec producteurs et consommateurs | les messages au centre ; qui publie au-dessus, qui réagit en dessous | les messages que personne n'écoute ; qui réagit à quoi ; les messages publiés depuis plusieurs endroits |
| **En couches** | des dossiers ou des modules qui ne s'importent que vers le bas | des bandes empilées, une par couche | les appels qui sautent une couche ; les appels qui remontent ; chaque écart avec sa ligne |
| **Hexagonal** | des interfaces (ports) et plusieurs implémentations (adaptateurs) choisies à l'extérieur du domaine | le domaine au centre, les adaptateurs autour | le domaine importe-t-il un adaptateur ; les ports à plusieurs adaptateurs ; les adaptateurs sans port |
| *Monorepo, bibliothèque, app mobile seule* | — | dessinés quand un projet de ce type sera ouvert | — |

Exemple, atelier-api : client-serveur (l'app web appelle l'API Express, qui seule touche Postgres), avec une partie événementielle (la file `emails`, BullMQ, entre l'API et le worker). Son contrat `EmailSender` a trois adaptateurs choisis par `EMAIL_PROVIDER`. C'est un trait hexagonal local, montré par le Contrat (X3), pas par la disposition de la carte.

## 4. Ce qui reste à dessiner

Dans la direction du hackathon :
- le vocabulaire et la miniature de chaque représentation sont sur la page « Langage visuel » du canevas des écrans ;
- S4 et C2 sont dessinées en grand (écrans 01 et 02) ;
- les autres le seront avec l'écran qui les emploie le premier : S1 (Carte), X1 et X2 (Accès), F1, A1, A2 (Vigie et Replays), T2 (Replay).
