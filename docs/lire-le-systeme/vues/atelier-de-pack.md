# Atelier de pack

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Ce pack lit-il bien sa technologie, et que change-t-il à la carte si on le charge ? | lecture | un pack proposé dans son domaine isolé : son inventaire de formes, ses tests, ses déclarations (`requires`, `provides`), la différence entre la carte acceptée et la carte « acceptée + proposée » | maquettée le 20/10 (écran 02 du hackathon) ; rien n'est codé ([ADR 0019](../../decisions/0019-packs-et-vues-evolutifs.md)) |

## 1. Objet

Un pack que VisionLayer n'a pas encore chargé, écrit par l'assistant à partir de la documentation d'une technologie. La vue montre comment il a été construit, ce qui a été vérifié, et ce qu'il ajouterait à la carte du projet ouvert. Elle se termine sur une décision humaine : charger le pack ou le refuser.

## 2. Fondement

Un pack écrit par une machine se juge sur deux choses, dans cet ordre.

1. **Il décrit la technologie, pas le projet.** Chaque forme de l'inventaire vient de la documentation et a son test. Aucun fichier du projet n'a servi à l'écrire. Sinon, le pack ferait passer *ce* projet et se tromperait sur le suivant.
2. **Ce qu'il change est visible et réversible.** Le pack tourne dans un domaine à part. La vue montre faits gagnés, faits perdus et constats nouveaux. Le retirer rend exactement la carte d'avant : c'est un test, pas une promesse.

La vue ne demande donc pas de lire le YAML. Elle demande de juger un inventaire et une différence.

## 3. Ce que la vue établit

- **D'où vient le pack :** la technologie et sa version (lues dans le lockfile), les documents lus, l'auteur (l'assistant et son modèle) et le nombre de fichiers du projet lus pour l'écrire, qui doit valoir zéro.
- **L'inventaire des formes :** chaque forme de l'API, rangée par usage, avec son exemple, le fait qu'elle produit, son test et son état (lu, à faire, hors pack). On voit aussi où elle apparaît dans le projet ouvert. Cette colonne vient du domaine isolé, après l'écriture du pack.
- **Les vérifications :**
  - le schéma strict ;
  - les tests de forme ;
  - « le moteur ne connaît aucune pile » ;
  - les déclarations sans cycle ;
  - « charger puis retirer = jamais chargé » sur le projet ouvert.
- **La différence sur le projet ouvert :** faits ajoutés, faits retirés, constats nouveaux, couverture avant et après. Chaque fait porte sa preuve `fichier:ligne`.
- **L'état du pack :** proposé, en chargement, actif, en retrait, inactif ou en échec, avec l'erreur.

## 4. Représentation

- **En-tête :** le nom du pack, son état, sa provenance en une ligne.
- **Barre des étapes de la recette :** inventaire, tests, règles, vérification, différence. Chacune porte son compte, et la dernière attend la décision.
- **Carte noire :** la décision. À gauche, ce que la carte gagne en une phrase, puis « Charger le pack » et « Voir la carte avec le pack ». À droite, la différence en chiffres.
- **Corps :**
  - à gauche, un tableau groupé par usage : les formes, ou les règles, le YAML et la fiche de l'agent, en onglets ;
  - à droite, les faits ajoutés avec leurs preuves, puis les vérifications.

Un pack refusé disparaît du domaine isolé, et l'écran revient à la Vue d'ensemble avec la technologie toujours marquée « non lue ».

## 5. Selon la taille du projet

| Projet | Ce qu'on y voit | Exemple |
|---|---|---|
| Petit | une bibliothèque, quelques formes employées, une différence de quelques faits | atelier-api et `cookie-parser` : 8 formes, 3 employées, 4 faits ajoutés, 1 point à surveiller |
| Moyen | un pack qui touche plusieurs déployables | un pack de file de messages lu dans l'API et dans le worker : la différence se range par déployable |
| Grand | des centaines de faits ajoutés | la différence se replie par relation (« +214 `entrypoint` ») et par déployable ; on ouvre un groupe pour voir ses exemples ; les constats nouveaux restent en tête |

## 6. D'où viennent les informations

| Information | Source |
|---|---|
| Version de la technologie | le lockfile du projet |
| Formes, exemples, tests | la documentation de la technologie et ses types (`node_modules/<paquet>/README.md`, `*.d.ts`), lus par l'assistant |
| Vérifications | VisionLayer, dans le domaine isolé |
| Différence et constats | le moteur de règles, sur la carte acceptée et sur la carte « acceptée + proposée » |
| Décision | un humain ; VisionLayer n'écrit `.vision/packs/` que sur ce geste |

Le modèle de langage écrit le pack. Il n'écrit aucun fait de la carte : ces faits viennent de l'exécution du pack sur le code.

## 7. Ce qui est lu aujourd'hui, et ce qui manque

| Élément | État |
|---|---|
| Faits marqués par pack, test « charger puis retirer » | à faire (ADR 0019, étape 1) |
| `requires` et `provides` dans le schéma des packs | à faire (étape 2) |
| Domaine isolé et différence de faits | à faire (étape 4) |
| Fiche de l'agent « technologie → inventaire → tests → pack » | à faire (étape 6) |
| Écriture par Muse Spark 1.3 (Model API, sortie contrainte au schéma des packs) | à faire, pendant le hackathon |

## 8. Limites

- **Les formes lues, pas toute la technologie.** Un pack qui passe ses tests lit les formes de son inventaire. Il ne dit rien de celles que l'inventaire a oubliées. Pour les trouver, il faut un projet de contrôle à l'aveugle, que le pack n'a jamais vu.
- **Pas de jugement de gravité.** La différence montre un constat nouveau ; elle ne dit pas si c'est grave. Exemple : le cookie de session d'atelier-api n'est pas signé, mais son identifiant aléatoire est vérifié en base.

## 9. Relations

- Depuis la [Vue d'ensemble](vue-d-ensemble.md) (carte noire « non lu ») et la [Couverture](couverture.md) (technologie sans pack, forme à faire).
- Vers la [Carte](carte.md), avec et sans le pack.
- Vers [Technologies](technologies.md) pour les packs déjà actifs.
- Vers la vue que nomme chaque constat nouveau, ici [Accès](acces.md).
