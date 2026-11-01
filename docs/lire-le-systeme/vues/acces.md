# Accès

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Qui peut entrer dans le système, et qu'a-t-il le droit d'y faire ? | lecture transversale | `Guard` de chaque point d'entrée (niveau, fonction qui la tient : `by`) ; déroulé de cette fonction (refus, lectures) ; écritures de ce qu'elle lit ; facette `trust` (à remplir) ; affirmations déclarées sur l'accès | codée en partie ; remaquettée le 11/10 (planches 26b à 26e) ; redessinée le 28/10 pour le hackathon (écran 04) |

## 1. Objet

Tout ce qui décide si un appel est accepté :

- les **acteurs** qui appellent le système : un visiteur, une personne connectée, chaque rôle, un autre service du système, un service extérieur qui signe ses appels, une horloge ;
- la façon dont chacun **prouve qui il est** (session, jeton, clé d'API, connexion déléguée à un fournisseur, signature, jeton de service), et la vie de cette preuve : où elle naît, combien de temps elle dure, ce qui la retire ;
- **ce que chacun a le droit d'appeler**, point d'entrée par point d'entrée, et la fonction qui en décide ;
- **ce que chacun a le droit de toucher** dans les données : la réservation d'un autre, les données d'un autre client ;
- **où** ces vérifications ont lieu : devant le système, dans le code, dans la base.

## 2. Fondement

Deux questions différentes, qu'on confond souvent. L'**authentification** répond à « qui es-tu ? ». L'**autorisation** répond à « as-tu le droit ? ». Un système peut reconnaître parfaitement une personne et la laisser lire ce qui ne lui appartient pas.

La vue applique trois principes :

- **la frontière de confiance** : ce qui vient de l'extérieur n'est cru qu'après vérification. Le code d'une app web ou mobile n'est jamais une frontière : la personne qui l'utilise peut le modifier ;
- **le moindre privilège** : chaque acteur n'atteint que ce dont il a besoin ;
- **la défense en profondeur** : une vérification à plusieurs couches tient quand l'une d'elles est oubliée.

Une seule entrée mal gardée suffit à exposer ce qu'elle atteint. C'est pourquoi la vue se lit point d'entrée par point d'entrée, et non par module.

## 3. Ce que la vue établit

- Les acteurs que le code distingue, et comment chacun se présente.
- Pour chaque point d'entrée : qui peut l'appeler, et la ligne qui en décide.
- Les points d'entrée ouverts à tous, et ce qu'ils écrivent.
- Les routes qui vérifient elles-mêmes que la donnée appartient à l'appelant, et celles qui lisent une donnée par son identifiant sans le vérifier.
- Le cycle de vie de la preuve d'identité.
- Ce qu'il faut aller voir : un chemin d'administration sans rôle, une garde écrite deux fois, un rôle exigé que rien n'attribue, une vérification faite seulement dans l'app.

## 4. Représentation

La vue suit la [grammaire visuelle](../grammaire/06-grammaire-visuelle.md) : une représentation par onglet, chaque élément d'une collection en ligne, le détail dans le panneau.

1. **Le bandeau** : combien de points d'entrée et leur répartition par niveau, combien d'acteurs et de quels genres, comment on prouve qui on est, ce qui est vérifié sur la donnée, combien de couches de vérification sont lues.
2. **Onglet « Par acteur »** (par défaut) : une table des acteurs, groupée par genre (personnes, partenaires, services du système, services extérieurs, le système lui-même). Chaque ligne dit avec quoi l'acteur se présente, ce qui le reconnaît, combien de points d'entrée il atteint, s'il est limité à ce qui est à lui, et ce qu'il faut aller voir.
3. **Onglet « Par point d'entrée »** : une table des points d'entrée, groupée par ressource (par service, puis ressource, sur un système qui en a plusieurs). Chaque ligne dit qui passe, ce qui en décide, et si la route compare la donnée à l'appelant. Le filtre « pour » choisit un acteur et estompe ce qu'il ne peut pas appeler.

Le panneau montre l'élément choisi :

- **un acteur** : sa preuve, de la naissance au retrait ; ce qu'il atteint, service par service ; le code qui le reconnaît ; ce que l'équipe a déclaré à son sujet, et si le code le confirme ;
- **un point d'entrée** : qui passe et ce que reçoit chacun ; les couches que l'appel traverse, de l'hébergeur à la base, chacune lue, déclarée ou non lue ; son code ; ce que l'équipe a déclaré ; le lien vers son déroulé.

Les constats vont dans « À savoir » et en marque sur la ligne concernée.

## 5. Selon la taille du projet

La même vue doit tenir pour un petit projet et pour un grand. Ce qui change, c'est la quantité, pas la forme.

| Projet | Ce qu'on y voit | Exemple |
|---|---|---|
| Petit, un service | deux ou trois acteurs, une session, une garde, quelques routes publiques | atelier-api : visiteur, personne connectée, admin, Stripe ; `requireUser` et `requireAdmin` |
| Moyen, une app et ses fonctions | des rôles, une vérification dans le code et une dans la base | une app de cours : élève, élève avec accès, admin, Cloud Tasks ; contrôles dans les fonctions et règles Firestore |
| Grand, plusieurs services | des dizaines d'acteurs (dont des services entre eux), plusieurs fournisseurs d'identité, des clients séparés | une passerelle qui vérifie un jeton, des services qui se font confiance, chaque requête filtrée par client |

Sur un grand système, les groupes se replient (sauf celui de la sélection et ceux qui portent un constat), une recherche et le filtre « pour » apparaissent, et « constats d'abord » range en tête les lignes à aller voir. La vue dit ce qu'elle ne voit pas : une passerelle configurée hors du dépôt n'est pas lue, un service écrit dans un langage non lu n'a pas de garde lue, et les deux sont signalés comme tels.

## 6. D'où viennent les informations

Deux sources, jamais mélangées à l'écran.

**Ce qui est lu dans le code**, sans agent et sans modèle de langage. Les packs reconnaissent les formes documentées de chaque technologie : une fonction qui refuse en 401 ou 403, un intermédiaire posé avant une route, une signature vérifiée. Le moteur de règles en déduit la garde de chaque point d'entrée et la fonction qui la tient. Le reste vient du déroulé déjà extrait : ce que la garde lit, ce que la route vérifie ensuite, qui écrit la preuve. Chaque fait renvoie à sa ligne.

**Ce que l'équipe déclare** : la politique d'accès voulue, les raisons d'un choix, ce qu'il ne faut pas casser. Exemples : « 404 plutôt que 403 : on ne révèle pas qu'une réservation existe », « les sessions vivent en base pour qu'une déconnexion les retire ». Ces affirmations sont écrites par les agents qui travaillent sur le code, avec leur ancrage, et VisionLayer vérifie qu'elles tiennent encore (types `rule`, `decision`, `why`, `guarantee`, `limit`). Un projet ancien qui n'a jamais été suivi n'en a pas : la vue montre alors une fiche manquante, à écrire par le prochain agent qui modifie ce code. Elle ne la remplit jamais elle-même.

Un commentaire de l'auteur juste au-dessus d'une ligne est repris tel quel, marqué « commentaire ».

**Ce qui dépend de la technologie.** La garde ne se lit pas de la même façon partout. Une fonction appelable reçoit une identité déjà vérifiée par sa plateforme, que son code doit encore exiger. Une route ne reçoit d'identité que par un intermédiaire écrit dans le code. Une signature de webhook se vérifie selon l'algorithme du fournisseur. Une règle de base de données ne protège que les accès directs depuis l'app. La vue dit, pour chaque garde, ce que la plateforme garantit et ce qui reste au code.

## 7. Ce qui est lu aujourd'hui, et ce qui manque

| Élément | État |
|---|---|
| Garde de chaque route Express (fonction qui répond 401 ou 403, posée sur la route, sur son routeur, ou appelée par son code) | lu |
| Signature d'un service externe (webhook) | lu |
| Ce que la garde lit, ce que la route vérifie ensuite, qui écrit la preuve | lu (depuis le déroulé) |
| Acteurs nommés, rôles exigés par leur nom (`requireRole("admin")`) | à faire |
| Mécanismes (`trust`) : session, jeton, clé, fournisseur | à faire |
| Route qui lit une donnée par son identifiant sans comparer le propriétaire | à faire |
| Isolement entre clients | à faire |
| Fonctions appelables Firebase (`request.auth`), règles Firestore | à faire, pack Firebase en pause |
| Code de refus écrit par une constante (`httpStatus.UNAUTHORIZED`) | non lu |
| Passerelle, proxy, service d'identité hors du dépôt | non lu, à signaler comme tel |

Une route lue par le pack sans aucune garde devant elle est dite publique. Une entrée qu'aucun pack ne sait garder n'a pas de garde du tout : elle n'est jamais présentée comme ouverte. Quand aucune garde n'est lue sur un projet, l'entrée Accès de la barre latérale est grisée et dit pourquoi.

## 8. Limites

Les comptes réels, les rôles réellement attribués et les secrets ne sont jamais lus : la vue dit ce que le code exige, pas qui possède quoi. Une garde écrite d'une façon qu'aucun pack ne connaît fait paraître sa route publique tant qu'elle n'est pas lue ; la vue le rappelle dans « À savoir ».

## 9. Relations

Vers [Points d'entrée](points-d-entree.md) pour le déroulé d'une route ; vers [Données](donnees.md) pour ce qu'une entrée atteint ; vers [Données personnelles](donnees-personnelles.md) pour ce qu'un acteur peut lire de personnel ; vers [Connaissance](connaissance.md) pour les affirmations déclarées.

## 10. L'écran 04 du hackathon

Le même contenu, dans la direction du hackathon, centré sur ce qui demande d'aller voir.

- **En-tête :** la répartition des 15 points d'entrée d'atelier-api en une phrase : 6 publics, 7 pour une personne connectée, 1 pour le rôle admin, 1 webhook signé. La session vient du pack cookie-parser (écran 03) : le cookie `sid`, vérifié en base, 30 jours, purgé chaque nuit (`src/jobs/purge.ts:7`).
- **Carte noire : le constat principal.** Toute personne connectée peut télécharger l'email, le nom et le téléphone de tous les clients. `GET /admin/export` n'exige que `requireUser` (`src/admin/export.ts:8`) puis lit `users` (`export.ts:9`). Le commentaire de l'auteur dit « pour la compta » (`export.ts:6`). À droite, le chemin d'un appel : qui passe, la garde, ce qui est lu, et la vérification qui manque (`requireAdmin`).
- **Second point :** le rôle `admin` est déclaré (`src/db/schema.ts:15`) et exigé par le remboursement (`src/payments/refund.ts:12`), mais aucun code ne l'attribue. Les inscriptions reçoivent `customer` par défaut. La vue dit « attribué hors du code, ou jamais », sans trancher.
- **Corps :**
  - à gauche, deux onglets, « Par point d'entrée » (par défaut, groupé par ressource) et « Par acteur ». Chaque route dit qui passe, la ligne qui en décide, et si elle compare la donnée à l'appelant ;
  - à droite, le panneau du point d'entrée choisi : qui passe et ce que reçoit chacun, les couches traversées de l'hébergeur à la base, le code indexé avec ses numéros, et les affirmations de l'équipe (aucune ici : fiche manquante).
- **Ce qui vient de Vigie :** rien n'est écrit par le modèle. Le bouton « Demander à Vigie » ouvre l'écran 05 sur la question « Qui peut exporter les données clients ? ».
