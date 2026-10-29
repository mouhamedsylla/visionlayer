# Données personnelles

| Question | Niveau | Objet du modèle | État |
|---|---|---|---|
| Où circulent les données personnelles, et quand sont-elles effacées ? | lecture transversale | champs d'entités reconnus comme personnels ; arêtes qui les transportent ; constat `personal_data_logged` | maquettée (45) |

## 1. Objet

Les champs qui contiennent des données personnelles, chaque ligne qui les lit, les écrit, les transmet à un service externe ou les écrit dans un journal, et les mécanismes qui les effacent ou les anonymisent.

## 2. Fondement

La protection des données personnelles impose de savoir **où elles vont** (minimisation, sous-traitants), **combien de temps elles restent** (conservation), et **comment les effacer** (droit à l'effacement). Ces trois questions traversent tout le système : un champ saisi par un point d'entrée peut finir dans un journal, chez un fournisseur d'emails et dans une sauvegarde. Aucune vue centrée sur un élément ne les rassemble.

## 3. Ce que la vue établit

- Les flux sortants de données personnelles : services externes, journaux.
- Les entités personnelles sans mécanisme d'effacement lu.
- Les points d'entrée qui exposent ces champs en lecture.

## 4. Représentation

Un champ personnel au centre, ses lectures et écritures d'un côté, ses sorties (services, journaux) de l'autre, et ce qui l'efface.

## 5. Sources et technologies

Les champs reconnus comme personnels par des formes documentées (nom, type, annotations), les arêtes qui les transportent, les appels de journalisation reconnus par les packs.

**Ce qui dépend de la technologie.** Les endroits où une donnée sort ou persiste dépendent de la technologie : journaux d'une plateforme gérée, sauvegardes et exports d'un stockage, régions déclarées par le déploiement. La vue qualifie chaque sortie par sa technologie ; l'effacement ne vaut que pour les stockages dont le pack sait dire ce qu'ils conservent.

## 6. Limites

La reconnaissance d'un champ personnel repose sur des formes : un champ mal nommé peut échapper, un champ déclaré par une note est pris en compte. Les sauvegardes et copies hors dépôt ne sont pas vues.

## 7. Relations

Vers [Données](donnees.md), [Défaillances](defaillances.md) pour un sous-traitant, [Accès](acces.md) pour qui peut lire.
