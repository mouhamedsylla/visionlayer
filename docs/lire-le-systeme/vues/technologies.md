# Technologies

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| De quelles technologies le système dépend-il ? | socle | inventaire des technologies : `Technology`, `TechEvidence`, espaces de travail, langages, avertissements | codée (maquette 08) |

## 1. Objet

L'inventaire des technologies du dépôt, chacune n'existant que par ses preuves : paquet déclaré dans un manifeste, fichier de configuration, image de conteneur, paquet système, version d'exécution, composant d'infrastructure, fichiers d'un langage. Pour chaque technologie : ses versions déclarées et installées, les unités qui la portent, les fichiers qui l'importent, les variables lues dans ces fichiers (par nom).

## 2. Fondement

Les dépendances sont une surface de risque (versions, sécurité, licences) et de compréhension (un service externe impose ses variables et ses modes de défaillance). L'inventaire distingue la **déclaration** (un manifeste mentionne un paquet) de l'**usage** (un fichier l'importe), parce que leurs écarts sont informatifs : un paquet importé mais non déclaré, ou déclaré mais jamais importé, ou présent en deux versions.

## 3. Ce que la vue établit

- La pile technique, rangée par famille, avec les services externes isolés.
- Les écarts entre déclaration et usage, et les divergences de versions.
- Pour un service externe : ses variables et les lignes qui l'appellent.

## 4. Représentation

Des familles de tuiles (logo, versions, preuve principale). Une technologie ouverte dans le panneau : toutes ses preuves, ses porteurs, ses importateurs, ses variables.

## 5. Sources et technologies

Manifestes de paquets et leurs verrous, fichiers de configuration, Dockerfiles et fichiers de composition, catalogue des technologies (qui nomme et range, sans rien masquer : un paquet hors catalogue reste listé sous son nom).

**Ce qui dépend de la technologie.** C'est la vue qui nomme les technologies et dit, pour chacune, si un pack la lit et jusqu'où : formes reconnues seulement, ou sémantique portée.

## 6. Limites

Une version n'est jamais comparée à la dernière publiée ni à une base de vulnérabilités.

## 7. Relations

Vers [Déploiement](deploiement.md), [Contrats](contrats.md) pour un fournisseur, [Défaillances](defaillances.md) pour un service externe.
