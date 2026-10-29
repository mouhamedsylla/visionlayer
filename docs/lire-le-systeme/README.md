# Lire un système avec VisionLayer

## Objet

Ce guide définit **comment VisionLayer représente un système logiciel et comment ses vues se lisent**. Il expose les principes qui gouvernent la lecture, la grammaire visuelle commune à toutes les vues, puis la référence de chaque vue : l'objet du modèle qu'elle représente, la question à laquelle elle répond, ce qu'elle permet d'établir et ses limites.

Il complète [le fonctionnement](../fonctionnement/README.md), qui décrit comment VisionLayer extrait et calcule le modèle. Ici, le modèle est supposé construit : la question est ce qu'on peut en déduire, et avec quel degré de certitude.

## Public

- Un développeur qui découvre un dépôt et doit en comprendre l'architecture d'exécution.
- Un développeur qui diagnostique un comportement et doit savoir où chercher.
- Un relecteur qui évalue la portée d'un changement.
- Un agent de code qui interroge le même modèle par MCP.

Aucune connaissance préalable de VisionLayer n'est supposée. Une connaissance générale de l'architecture logicielle l'est.

## Organisation

| Partie | Contenu |
|---|---|
| **I. Principes** | Ce que VisionLayer considère comme un système, comment il le découpe, ce qu'il tient pour établi |
| **II. Grammaire** | La structure d'un écran, les encodages visuels, les interactions, communs à toutes les vues |
| **III. Référence des vues** | Une fiche par vue, sur un gabarit fixe |
| **IV. Diagnostic** | Des méthodes de recherche par classe de symptôme, qui enchaînent les vues |
| **Glossaire** | Les termes du modèle et du guide |

## Sommaire

**I. Principes**

1. [Le système comme objet de lecture](principes/01-le-systeme.md)
2. [Les niveaux de lecture](principes/02-les-niveaux.md)
3. [La preuve et l'incertitude](principes/03-la-preuve.md)
4. [Faits extraits et connaissance déclarée](principes/04-faits-et-connaissance.md)
5. [Les limites de la lecture statique](principes/05-les-limites.md)

**II. Grammaire**

6. [La grammaire visuelle](grammaire/06-grammaire-visuelle.md)
7. [Les représentations](grammaire/07-les-representations.md) : le vocabulaire commun, le catalogue des représentations, les styles d'architecture

**III. Référence des vues**

| Niveau | Vue | Question | État |
|---|---|---|---|
| Système | [Vue d'ensemble](vues/vue-d-ensemble.md) | Quel est l'état du système, et qu'est-ce qui demande attention ? | codée |
| Système | [Carte du système](vues/carte.md) | Quelles unités s'exécutent, et comment communiquent-elles ? Que change un pack chargé ? | codée ; redessinée pour le hackathon (écran 03) |
| Déployable | [Intérieur d'un bloc](vues/interieur-d-un-bloc.md) | Comment cette unité est-elle composée ? | maquettée |
| Composant | [Composant](vues/composant.md) | Quelle responsabilité ce composant porte-t-il, et pour qui ? | maquettée |
| Point d'entrée | [Points d'entrée et déroulés](vues/points-d-entree.md) | Que produit l'exécution de ce point d'entrée ? | codée, à enrichir |
| Données | [Données](vues/donnees.md) | Qui accède à cette donnée, sous quelle garde, et comment son état évolue-t-il ? | codée |
| Frontière | [Contrats](vues/contrats.md) | Quelle implémentation réalise cette interface, et que garantit-elle ? | codée |
| Frontière | [Accès](vues/acces.md) | Qui peut entrer dans le système, et qu'a-t-il le droit d'y faire ? | codée en partie, à remaquetter |
| Temps | [Déclencheurs](vues/declencheurs.md) | Qu'est-ce qui s'exécute sans action d'un utilisateur ? | codée |
| Propriété | [Concurrence](vues/concurrence.md) | Quelles écritures peuvent se croiser, et qu'est-ce qui les protège ? | maquettée |
| Propriété | [Défaillances](vues/defaillances.md) | Que devient le système quand une dépendance échoue ? | maquettée |
| Propriété | [Données personnelles](vues/donnees-personnelles.md) | Où circulent les données personnelles, et quand sont-elles effacées ? | maquettée |
| Changement | [Impact](vues/impact.md) | Qu'est-ce qui dépend de cet élément ? | maquettée |
| Preuve | [Code](vues/code.md) | Quelle ligne établit ce fait ? | codée |
| Socle | [Technologies](vues/technologies.md) | De quelles technologies le système dépend-il ? | codée |
| Socle | [Déploiement](vues/deploiement.md) | Où le système s'exécute-t-il, et comment y est-il livré ? | codée |
| Suivi | [Revues](vues/revues.md) | Que change réellement cette modification ? | maquettée |
| Suivi | [Agents](vues/agents.md) | Quelle activité les agents ont-ils sur ce système ? | maquettée |
| Suivi | [Connaissance](vues/connaissance.md) | Que sait-on que le code n'exprime pas, et est-ce encore vrai ? | maquettée |
| Suivi | [Couverture](vues/couverture.md) | Jusqu'où la représentation est-elle fiable ? | codée |
| Lecture | [Atelier de pack](vues/atelier-de-pack.md) | Ce pack lit-il bien sa technologie, et que change-t-il à la carte si on le charge ? | maquettée |
| Transversal | [Vigie](vues/vigie.md) | Que dit le code, preuves à l'appui ? | maquettée (écran 05 du hackathon) |

**IV. Diagnostic**

7. [Méthodes de diagnostic](diagnostic/07-methodes.md)

[Glossaire](glossaire.md)

## Règles du guide

1. **Une vue, une question.** Une vue qui ne répond pas à une question précise sur le système n'existe pas. Deux vues qui répondent à la même question sont fusionnées.
2. **Aucune vue sans fiche.** Une vue est spécifiée ici avant d'être maquettée, et sa fiche est tenue à jour avec elle.
3. **Le principe d'abord.** Une fiche dit ce que la vue représente et pourquoi ; un exemple ne vient qu'en illustration.
4. **Neutre entre projets, fidèle à chaque technologie.** Une vue est définie sur les facettes du modèle neutre, jamais pour un dépôt particulier ; elle garde sa structure d'un projet à l'autre et montre ce que chaque technologie change à la lecture, d'après son pack. Sa fiche dit ce qui, dans la vue, dépend de la technologie.
